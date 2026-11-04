from flask import Blueprint,g,request
from .core import *
bp=Blueprint('operations',__name__)

@bp.get('/api/admin/overview')
@auth('admin')
def overview():
    with transaction() as db:
        return {'users':db.one('SELECT COUNT(*) AS n FROM users')['n'],'stores':db.one('SELECT COUNT(*) AS n FROM stores')['n'],'orders':db.one('SELECT COUNT(*) AS n FROM orders')['n'],'ordered_value':db.one('SELECT COALESCE(SUM(total),0) AS n FROM orders')['n'],'stores_list':db.all('SELECT * FROM stores ORDER BY id'),'products':db.all('SELECT id,name,store_id,status,moderation FROM products ORDER BY created DESC'),'users_list':db.all('SELECT id,email,name,role,status FROM users'),'items':db.all('SELECT id,order_id,store_id,name,status,courier_id FROM order_items ORDER BY created DESC LIMIT 200'),'reviews':db.all('SELECT * FROM reviews ORDER BY created DESC LIMIT 100'),'coupons':db.all('SELECT * FROM coupons'),'audit':db.all('SELECT * FROM audit ORDER BY created DESC LIMIT 100')}


@bp.get('/api/admin/delivery-exceptions')
@auth('admin')
def delivery_exceptions():
    with transaction() as db:
        rows = db.all(
            """
            SELECT
                a.entity AS item_id,
                a.detail,
                a.created,
                actor.name AS attempt_by,
                i.order_id,
                i.name,
                i.quantity,
                i.status,
                i.courier_id,
                courier.name AS courier_name,
                o.address,
                o.payment
            FROM audit a
            JOIN order_items i ON i.id = a.entity
            JOIN orders o ON o.id = i.order_id
            LEFT JOIN users actor ON actor.id = a.actor
            LEFT JOIN users courier ON courier.id = i.courier_id
            WHERE a.action = 'delivery.attempt_failed'
              AND a.detail <> ''
            ORDER BY a.created DESC, a.id DESC
            """
        )

        exceptions = {}
        for row in rows:
            item_id = row['item_id']

            if item_id not in exceptions:
                exceptions[item_id] = {
                    'item_id': item_id,
                    'order_id': row['order_id'],
                    'name': row['name'],
                    'quantity': row['quantity'],
                    'status': row['status'],
                    'courier_id': row['courier_id'],
                    'courier_name': row['courier_name'],
                    'address': row['address'],
                    'payment': row['payment'],
                    'attempt_count': 0,
                    'latest_reason': row['detail'],
                    'last_attempt_at': row['created'],
                    'last_attempt_by': row['attempt_by'],
                    'needs_action': row['status'] in (
                        'packed', 'out_for_delivery'
                    ),
                }

            exceptions[item_id]['attempt_count'] += 1

        return list(exceptions.values())



@bp.get('/api/admin/delivery-operations')
@auth('admin')
def delivery_operations():
    with transaction() as db:
        current = now()
        warning_seconds = 24 * 3600
        critical_seconds = 48 * 3600

        pending = db.all(
            """
            SELECT
                i.id, i.order_id, i.name, i.quantity, i.status,
                i.courier_id, i.created,
                courier.name AS courier_name,
                o.address, o.payment
            FROM order_items i
            JOIN orders o ON o.id = i.order_id
            LEFT JOIN users courier ON courier.id = i.courier_id
            WHERE i.status IN ('packed', 'out_for_delivery')
            ORDER BY i.created ASC
            """
        )

        events_by_item = {}
        if pending:
            item_ids = [item['id'] for item in pending]
            placeholders = ','.join('?' for _ in item_ids)
            events = db.all(
                f"""
                SELECT
                    a.id, a.entity, a.action, a.detail, a.created,
                    a.actor, u.name AS actor_name
                FROM audit a
                LEFT JOIN users u ON u.id = a.actor
                WHERE a.entity IN ({placeholders})
                  AND a.action IN (
                    'item.pack',
                    'delivery.assign',
                    'delivery.start',
                    'delivery.attempt_failed'
                  )
                ORDER BY a.created ASC, a.id ASC
                """,
                item_ids
            )
            for event in events:
                events_by_item.setdefault(event['entity'], []).append(event)

        items = []
        for item in pending:
            events = events_by_item.get(item['id'], [])
            failures = [
                event for event in events
                if event['action'] == 'delivery.attempt_failed'
            ]

            if item['status'] == 'packed':
                stage_events = [
                    event for event in events
                    if event['action'] in ('item.pack', 'delivery.assign')
                ]
                stage_label = 'Awaiting delivery pickup'
                # Assignment is the latest entry into packed when an item
                # is reassigned after a failed delivery.
                stage_priority = {
                    'item.pack': 0,
                    'delivery.assign': 1,
                }
            else:
                stage_events = [
                    event for event in events
                    if event['action'] == 'delivery.start'
                ]
                stage_label = 'Out for delivery'
                stage_priority = {'delivery.start': 1}

            stage_event = max(
                stage_events,
                key=lambda event: (
                    event['created'],
                    stage_priority.get(event['action'], 0),
                    event['id'],
                ),
                default=None,
            )
            stage_since = (
                stage_event['created'] if stage_event else item['created']
            )
            age_seconds = max(0, current - stage_since)

            if age_seconds >= critical_seconds:
                ageing_bucket = 'critical_48h'
            elif age_seconds >= warning_seconds:
                ageing_bucket = 'watch_24h'
            else:
                ageing_bucket = 'on_track'

            latest_failure = max(
                failures,
                key=lambda event: (event['created'], event['id']),
                default=None,
            )

            items.append({
                'item_id': item['id'],
                'order_id': item['order_id'],
                'name': item['name'],
                'quantity': item['quantity'],
                'status': item['status'],
                'courier_id': item['courier_id'],
                'courier_name': item['courier_name'],
                'address': item['address'],
                'payment': item['payment'],
                'stage_label': stage_label,
                'stage_since': stage_since,
                'age_seconds': age_seconds,
                'age_hours': round(age_seconds / 3600, 1),
                'ageing_bucket': ageing_bucket,
                'attempt_count': len(failures),
                'repeat_failure': len(failures) >= 2,
                'latest_reason': latest_failure['detail'] if latest_failure else '',
                'last_attempt_at': latest_failure['created'] if latest_failure else None,
                'last_attempt_by': latest_failure['actor_name'] if latest_failure else None,
                'needs_action': True,
            })

        priority = {
            'critical_48h': 0,
            'watch_24h': 1,
            'on_track': 2,
        }
        items.sort(
            key=lambda item: (
                priority[item['ageing_bucket']],
                -item['age_seconds'],
            )
        )

        completions = db.all(
            """
            SELECT
                a.entity,
                a.created AS completed_at,
                (
                    SELECT MAX(start_event.created)
                    FROM audit start_event
                    WHERE start_event.entity = a.entity
                      AND start_event.action = 'delivery.start'
                      AND start_event.created <= a.created
                ) AS started_at
            FROM audit a
            WHERE a.action = 'delivery.complete'
              AND a.created >= ?
            ORDER BY a.created DESC
            """,
            (current - 7 * 86400,)
        )

        completed_durations = [
            max(0, row['completed_at'] - row['started_at'])
            for row in completions
            if row['started_at'] is not None
        ]

        summary = {
            'packed_pending': sum(
                item['status'] == 'packed' for item in items
            ),
            'out_for_delivery': sum(
                item['status'] == 'out_for_delivery' for item in items
            ),
            'overdue_24h': sum(
                item['age_seconds'] >= warning_seconds for item in items
            ),
            'critical_48h': sum(
                item['age_seconds'] >= critical_seconds for item in items
            ),
            'repeat_failure_items': sum(
                item['repeat_failure'] for item in items
            ),
            'unassigned_packed': sum(
                item['status'] == 'packed' and not item['courier_id']
                for item in items
            ),
            'delivered_last_7d': len(completions),
            'avg_out_for_delivery_hours_7d': (
                round(
                    sum(completed_durations) / len(completed_durations) / 3600,
                    1,
                )
                if completed_durations else None
            ),
        }

        return {
            'generated_at': current,
            'thresholds': {
                'warning_hours': 24,
                'critical_hours': 48,
                'performance_window_days': 7,
            },
            'summary': summary,
            'items': items,
        }


@bp.post('/api/admin/stores/<id>')
@auth('admin')
def moderate_store(id):
    b=body();status=b.get('status');reason=text(b.get('reason'),'reason',3,300)
    if status not in ('active','suspended','rejected'):fail('Invalid store status')
    with transaction(True) as db:
        s=db.one('SELECT * FROM stores WHERE id=?',(id,))
        if not s:fail('Store not found',404)
        db.execute('UPDATE stores SET status=?,reason=?,version=version+1 WHERE id=?',(status,reason,id))
        if status=='active':db.execute("UPDATE users SET role='seller' WHERE id=? AND role='customer'",(s['owner_id'],))
        audit(db,g.user['id'],'store.'+status,id,reason);notify(db,s['owner_id'],'Store '+s['name']+': '+status+' — '+reason)
    return {'ok':True}

@bp.post('/api/admin/products/<id>')
@auth('admin')
def moderate_product(id):
    b=body();status=b.get('status');reason=text(b.get('reason'),'reason',3,300)
    if status not in ('approved','suppressed','rejected'):fail('Invalid moderation status')
    with transaction(True) as db:
        if not db.one('SELECT id FROM products WHERE id=?',(id,)):fail('Product not found',404)
        db.execute('UPDATE products SET moderation=?,version=version+1 WHERE id=?',(status,id));audit(db,g.user['id'],'moderation.'+status,id,reason)
    return {'ok':True}

@bp.post('/api/admin/users/<id>')
@auth('admin')
def moderate_user(id):
    b=body();status=b.get('status')
    if id==g.user['id']:fail('Cannot suspend your own account')
    if status not in ('active','suspended'):fail('Invalid status')
    with transaction(True) as db:
        u=db.one('SELECT * FROM users WHERE id=?',(id,))
        if not u:fail('User not found',404)
        if u['role']=='admin':fail('Admin accounts require the account management CLI',403)
        db.execute('UPDATE users SET status=? WHERE id=?',(status,id));db.execute('DELETE FROM sessions WHERE user_id=?',(id,));audit(db,g.user['id'],'user.'+status,id,text(b.get('reason'),'reason',3,300))
    return {'ok':True}

@bp.post('/api/admin/reviews/<id>')
@auth('admin')
def moderate_review(id):
    b=body();status=b.get('status')
    if status not in ('approved','rejected'):fail('Invalid review status')
    with transaction(True) as db:db.execute('UPDATE reviews SET status=? WHERE id=?',(status,id));audit(db,g.user['id'],'review.'+status,id)
    return {'ok':True}

@bp.post('/api/admin/coupons')
@auth('admin')
def coupon():
    b=body();code=text(b.get('code'),'code',3,40).upper()
    with transaction(True) as db:
        if db.one('SELECT code FROM coupons WHERE code=?',(code,)):fail('Coupon exists; use a new code',409)
        db.execute('INSERT INTO coupons VALUES(?,?,?,?,?,?,?,?)',(code,integer(b.get('percent'),'percent',1,80),integer(b.get('max_discount'),'maximum discount',1),integer(b.get('minimum',0),'minimum'),integer(b.get('max_uses',100),'usage limit',1),0,1,now()+integer(b.get('days',30),'days',1,365)*86400));audit(db,g.user['id'],'coupon.create',code)
    return {'ok':True}

@bp.post('/api/admin/items/<id>/assign')
@auth('admin')
def assign(id):
    b=body();courier=text(b.get('courier_id'),'courier')
    with transaction(True) as db:
        i=item_access(db,id)
        if i['status'] not in ('packed','out_for_delivery'):fail('Pack the item before assigning delivery',409)
        if not db.one("SELECT id FROM users WHERE id=? AND role='delivery' AND status='active'",(courier,)):fail('Invalid active delivery partner')
        db.execute("UPDATE order_items SET courier_id=?,status='packed',otp_hash='',otp_attempts=0,otp_expires=0 WHERE id=?",(courier,id));audit(db,g.user['id'],'delivery.assign',id,courier)
    return {'ok':True}

@bp.get('/api/delivery/tasks')
@auth('delivery')
def tasks():
    with transaction() as db:return db.all("SELECT i.id,i.name,i.quantity,i.total,i.status,i.order_id,o.address,o.payment FROM order_items i JOIN orders o ON i.order_id=o.id WHERE i.courier_id=? AND i.status IN ('packed','out_for_delivery') ORDER BY i.created",(g.user['id'],))

@bp.post('/api/delivery/tasks/<id>')
@auth('delivery')
def delivery_task(id):
    b=body();action=b.get('action');error=None;audit_detail='';audit_id=None
    with transaction(True) as db:
        i=db.one('SELECT i.*,o.user_id,o.payment FROM order_items i JOIN orders o ON i.order_id=o.id WHERE i.id=? AND i.courier_id=?',(id,g.user['id']))
        if not i:fail('Task not found',404)
        if action=='start':
            if i['status']!='packed':fail('Task is not ready for pickup',409)
            db.execute("UPDATE order_items SET status='out_for_delivery' WHERE id=?",(id,));notify(db,i['user_id'],i['name']+' is out for delivery. Generate your delivery code in Orders.')
        elif action=='attempt_failed':
            if i['status']!='out_for_delivery':fail('Task is not out for delivery',409)
            audit_detail = text(b.get('reason'), 'reason', 3, 300)
            previous = db.one(
                "SELECT COUNT(*) AS n FROM audit WHERE action=? AND entity=?",
                ('delivery.attempt_failed', id)
            )['n']
            audit_id = f"delivery-attempt-{id}-{previous + 1:08d}"
            notify(db, i['user_id'], 'Delivery attempt failed for ' + i['name'])
        elif action=='complete':
            if i['status']!='out_for_delivery':fail('Task cannot be completed',409)
            if i['otp_attempts']>=5 or i['otp_expires']<now() or digest(str(b.get('code','')))!=i['otp_hash']:
                db.execute('UPDATE order_items SET otp_attempts=otp_attempts+1 WHERE id=?',(id,));error='Invalid or expired code. Customer can generate a fresh code.'
            elif i['payment']=='cod_due' and b.get('cod_collected') is not True:error='Confirm exact cash collection before delivery'
            else:
                db.execute("UPDATE order_items SET status='delivered',otp_hash='',cod_collected=? WHERE id=?",(1 if i['payment']=='cod_due' else 0,id))
                # Immutable illustrative 10% commission snapshot; no provider/bank transfer.
                net=i['total']-(i['total']*10//100)
                db.execute('INSERT INTO ledger VALUES(?,?,?,?,?,?) ON CONFLICT(item_id,kind) DO NOTHING',(uid(),i['store_id'],id,'sale',net,now()));notify(db,i['user_id'],i['name']+' delivered. Thank you for shopping with 7by11.')
        else:fail('Invalid delivery action')
        if not error:
            if audit_id:
                db.execute(
                    'INSERT INTO audit VALUES(?,?,?,?,?,?)',
                    (audit_id, g.user['id'], 'delivery.' + action,
                     id, audit_detail, now())
                )
            else:
                audit(db, g.user['id'], 'delivery.' + action, id, audit_detail)
    if error:fail(error,409)
    return {'ok':True}

@bp.get('/api/warehouse/tasks')
@auth('warehouse','admin')
def warehouse_tasks():
    with transaction() as db:return {'items':db.all("SELECT id,name,quantity,store_id,status FROM order_items WHERE status='confirmed'"),'returns':db.all("SELECT r.*,i.name FROM returns r JOIN order_items i ON r.item_id=i.id WHERE r.status IN ('requested','received')")}

@bp.get('/api/seller/stores/<id>/finance')
@auth()
def store_finance(id):
    with transaction() as db:
        store_access(db,id,'finance');earned=db.one('SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE store_id=?',(id,))['total'];allocated=db.one("SELECT COALESCE(SUM(amount),0) AS total FROM payouts WHERE store_id=? AND status IN ('pending','paid_demo')",(id,))['total']
        return {'earned':earned,'available':earned-allocated,'ledger':db.all('SELECT * FROM ledger WHERE store_id=? ORDER BY created DESC',(id,)),'payouts':db.all('SELECT * FROM payouts WHERE store_id=? ORDER BY created DESC',(id,))}

@bp.post('/api/seller/stores/<id>/payouts')
@auth()
def request_payout(id):
    with transaction(True) as db:
        store_access(db,id,'finance');earned=db.one('SELECT COALESCE(SUM(amount),0) AS n FROM ledger WHERE store_id=?',(id,))['n'];allocated=db.one("SELECT COALESCE(SUM(amount),0) AS n FROM payouts WHERE store_id=? AND status IN ('pending','paid_demo')",(id,))['n'];amount=earned-allocated
        if amount<=0:fail('No payable balance',409)
        pid=uid('pay-');db.execute('INSERT INTO payouts VALUES(?,?,?,?,?,?,?)',(pid,id,amount,g.user['id'],'pending',None,now()));audit(db,g.user['id'],'payout.request',pid)
    return {'id':pid}

@bp.get('/api/finance/payouts')
@auth('admin','finance')
def payouts():
    with transaction() as db:return db.all('SELECT p.*,s.name AS store_name FROM payouts p JOIN stores s ON p.store_id=s.id ORDER BY p.created DESC')

@bp.post('/api/finance/payouts/<id>')
@auth('admin','finance')
def payout_approval(id):
    b=body();status=b.get('status')
    if status not in ('paid_demo','rejected'):fail('Invalid approval status')
    with transaction(True) as db:
        p=db.one('SELECT * FROM payouts WHERE id=?',(id,))
        if not p or p['status']!='pending':fail('Payout is not pending',409)
        if p['requested_by']==g.user['id']:fail('A different person must approve',403)
        earned=db.one('SELECT COALESCE(SUM(amount),0) AS n FROM ledger WHERE store_id=?',(p['store_id'],))['n'];paid=db.one("SELECT COALESCE(SUM(amount),0) AS n FROM payouts WHERE store_id=? AND status='paid_demo'",(p['store_id'],))['n']
        if status=='paid_demo' and p['amount']>earned-paid:fail('Balance changed after refunds. Reject and request again.',409)
        db.execute('UPDATE payouts SET status=?,approved_by=? WHERE id=?',(status,g.user['id'],id));audit(db,g.user['id'],'payout.'+status,id)
    return {'ok':True}
