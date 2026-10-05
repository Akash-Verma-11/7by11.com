from flask import Blueprint,g,request
from .core import *
bp=Blueprint('commerce',__name__)

def cart_rows(db,user):
    return db.all('SELECT p.*,c.quantity,s.name AS store_name,s.status AS store_status FROM carts c JOIN products p ON c.product_id=p.id JOIN stores s ON p.store_id=s.id WHERE c.user_id=? ORDER BY p.id',(user,))

def order_view(db,id,user=None):
    o=db.one('SELECT * FROM orders WHERE id=?',(id,))
    if not o or (user and o['user_id']!=user):fail('Order not found',404)
    o['items']=db.all('SELECT id,product_id,store_id,name,quantity,price,total,status,courier_id,cod_collected FROM order_items WHERE order_id=? ORDER BY id',(id,))
    return o

@bp.route('/api/cart',methods=['GET','POST'])
@auth('customer','seller')
def cart():
    with transaction(request.method=='POST') as db:
        if request.method=='POST':
            b=body();id=text(b.get('product_id'),'product');qty=integer(b.get('quantity'),'quantity',0,20)
            p=db.one('SELECT p.*,s.status AS store_status FROM products p JOIN stores s ON p.store_id=s.id WHERE p.id=?',(id,))
            if not p:fail('Product not found',404)
            if qty:
                if p['status']!='active' or p['moderation']!='approved' or p['store_status']!='active':fail('Product is unavailable',409)
                if qty>p['stock']:fail('Not enough stock',409)
                db.execute('INSERT INTO carts VALUES(?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=excluded.quantity',(g.user['id'],id,qty))
            else:db.execute('DELETE FROM carts WHERE user_id=? AND product_id=?',(g.user['id'],id))
        rows=cart_rows(db,g.user['id']);return {'items':rows,'total':sum(p['price']*p['quantity'] for p in rows)}

@bp.post('/api/checkout')
@auth('customer','seller')
def checkout():
    b=body();address=text(b.get('address'),'address',10,500);method=b.get('method','demo');code=str(b.get('coupon','')).strip().upper()
    if method not in ('demo','cod'):fail('Live payment provider is not configured',503)
    if os.getenv('PAYMENT_MODE','demo')!='demo':fail('Live payments are not enabled in this release',503)
    key=text(request.headers.get('Idempotency-Key'),'idempotency key',8,100)
    # Client sends expected item IDs/quantities/prices to explicitly accept the quote.
    expected=b.get('items')
    if not isinstance(expected,list) or not expected:fail('Cart quote required')
    fingerprint=digest(json.dumps({'address':address,'method':method,'coupon':code,'items':expected},sort_keys=True))
    with transaction(True) as db:
        previous=db.one('SELECT * FROM checkout_keys WHERE user_id=? AND key=?',(g.user['id'],key))
        if previous:
            if previous['fingerprint']!=fingerprint:fail('Idempotency key belongs to a different checkout',409)
            return order_view(db,previous['order_id'],g.user['id'])
        rows=cart_rows(db,g.user['id'])
        quote=[{'id':p['id'],'quantity':p['quantity'],'price':p['price']} for p in rows]
        if quote!=expected:fail('Cart or prices changed. Refresh your bag.',409)
        for p in rows:
            if p['status']!='active' or p['moderation']!='approved' or p['store_status']!='active':fail('An item is no longer available',409)
        subtotal=sum(p['price']*p['quantity'] for p in rows);discount=0
        if code:
            c=db.one('SELECT * FROM coupons WHERE code=?',(code,))
            if not c or not c['active'] or c['expires']<now() or c['uses']>=c['max_uses'] or subtotal<c['minimum']:fail('Coupon is not eligible',409)
            if db.one('SELECT code FROM coupon_uses WHERE user_id=? AND code=?',(g.user['id'],code)):fail('Coupon already used by this account',409)
            discount=min(subtotal*c['percent']//100,c['max_discount']);db.execute('UPDATE coupons SET uses=uses+1 WHERE code=?',(code,))
        oid=uid('711-');db.execute('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)',(oid,g.user['id'],address,subtotal-discount,discount,code,'cod_due' if method=='cod' else 'paid_demo',now()))
        allocated=0
        for n,p in enumerate(rows):
            gross=p['price']*p['quantity'];deduction=discount-allocated if n==len(rows)-1 else discount*gross//subtotal;allocated+=deduction
            stock(db,p['id'],-p['quantity'],g.user['id'],'checkout '+oid)
            db.execute('INSERT INTO order_items VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(uid('item-'),oid,p['store_id'],p['id'],p['name'],p['quantity'],p['price'],gross-deduction,'confirmed',None,'',0,0,0,now()))
        db.execute('INSERT INTO checkout_keys VALUES(?,?,?,?)',(g.user['id'],key,fingerprint,oid))
        if code:db.execute('INSERT INTO coupon_uses VALUES(?,?,?)',(g.user['id'],code,oid))
        db.execute('DELETE FROM carts WHERE user_id=?',(g.user['id'],));notify(db,g.user['id'],'Order '+oid+' confirmed.');audit(db,g.user['id'],'checkout',oid)
        return order_view(db,oid),201

@bp.get('/api/orders')
@auth('customer','seller')
def orders():
    with transaction() as db:return [order_view(db,r['id']) for r in db.all('SELECT id FROM orders WHERE user_id=? ORDER BY created DESC',(g.user['id'],))]

@bp.get('/api/orders/<id>/invoice')
@auth('customer','seller')
def invoice(id):
    with transaction() as db:o=order_view(db,id,g.user['id'])
    return {'brand':'7by11','type':'Demo purchase receipt — not a tax invoice','currency':'INR','order':o}

@bp.post('/api/items/<id>/cancel')
@auth('customer','seller')
def cancel(id):
    with transaction(True) as db:
        i=db.one('SELECT i.*,o.user_id FROM order_items i JOIN orders o ON i.order_id=o.id WHERE i.id=?',(id,))
        if not i or i['user_id']!=g.user['id']:fail('Item not found',404)
        if i['status']=='cancelled':return {'ok':True}
        if i['status']!='confirmed':fail('Cancellation is available before packing',409)
        stock(db,i['product_id'],i['quantity'],g.user['id'],'cancellation '+id)
        db.execute("UPDATE order_items SET status='cancelled' WHERE id=?",(id,));audit(db,g.user['id'],'cancel.demo',id);notify(db,g.user['id'],'Cancellation and demo refund recorded for '+i['name'])
    return {'ok':True}

@bp.post('/api/items/<id>/return')
@auth('customer','seller')
def return_request(id):
    b=body()
    with transaction(True) as db:
        i=db.one('SELECT i.*,o.user_id FROM order_items i JOIN orders o ON i.order_id=o.id WHERE i.id=?',(id,))
        if not i or i['user_id']!=g.user['id']:fail('Item not found',404)
        if db.one('SELECT id FROM returns WHERE item_id=?',(id,)):fail('Return already requested',409)
        if i['status']!='delivered':fail('Only delivered items can be returned',409)
        db.execute('INSERT INTO returns VALUES(?,?,?,?,?,?,?)',(uid('return-'),id,text(b.get('reason'),'reason',5,500),'requested','pending',i['total'],now()))
        db.execute("UPDATE order_items SET status='return_requested' WHERE id=?",(id,));audit(db,g.user['id'],'return.request',id)
    return {'ok':True}

@bp.post('/api/items/<id>/delivery-code')
@auth('customer','seller')
def delivery_code(id):
    with transaction(True) as db:
        i=db.one('SELECT i.*,o.user_id FROM order_items i JOIN orders o ON i.order_id=o.id WHERE i.id=?',(id,))
        if not i or i['user_id']!=g.user['id']:fail('Item not found',404)
        if i['status']!='out_for_delivery':fail('Delivery has not started',409)
        code=str(secrets.randbelow(900000)+100000)
        db.execute('UPDATE order_items SET otp_hash=?,otp_attempts=0,otp_expires=? WHERE id=?',(digest(code),now()+600,id))
        return {'code':code,'expires_in_seconds':600}

@bp.get('/api/seller/orders')
@auth()
def seller_orders():
    with transaction() as db:
        return db.all("SELECT DISTINCT i.id,i.order_id,i.store_id,i.name,i.quantity,i.total,i.status,i.courier_id FROM order_items i JOIN stores s ON i.store_id=s.id LEFT JOIN members m ON s.id=m.store_id WHERE s.owner_id=? OR (m.user_id=? AND m.permission='fulfillment') ORDER BY i.created DESC",(g.user['id'],g.user['id']))

@bp.post('/api/seller/items/<id>/pack')
@auth()
def pack(id):
    with transaction(True) as db:
        i=item_access(db,id)
        if i['status']!='confirmed':fail('Only confirmed items can be packed',409)
        db.execute("UPDATE order_items SET status='packed' WHERE id=?",(id,));audit(db,g.user['id'],'item.pack',id);notify(db,i['user_id'],i['name']+' has been packed.')
    return {'ok':True}

@bp.get('/api/seller/returns')
@auth()
def seller_returns():
    with transaction() as db:return db.all("SELECT DISTINCT r.*,i.name,i.store_id FROM returns r JOIN order_items i ON r.item_id=i.id JOIN stores s ON i.store_id=s.id LEFT JOIN members m ON s.id=m.store_id WHERE s.owner_id=? OR (m.user_id=? AND m.permission='fulfillment') ORDER BY r.created DESC",(g.user['id'],g.user['id']))

@bp.post('/api/returns/<id>/resolve')
@auth()
def resolve_return(id):
    b=body();action=b.get('action');disposition=b.get('disposition','quarantine')
    with transaction(True) as db:
        r=db.one('SELECT * FROM returns WHERE id=?',(id,))
        if not r:fail('Return not found',404)
        i=item_access(db,r['item_id'])
        if action=='receive':
            if r['status']!='requested':fail('Return is not awaiting receipt',409)
            db.execute("UPDATE returns SET status='received' WHERE id=?",(id,))
        elif action=='refund':
            if r['status']=='refunded':return {'ok':True}
            if r['status']!='received':fail('Confirm physical receipt first',409)
            if disposition not in ('restock','quarantine'):fail('Choose stock disposition')
            if disposition=='restock':stock(db,i['product_id'],i['quantity'],g.user['id'],'return '+id)
            db.execute("UPDATE returns SET status='refunded',disposition=? WHERE id=?",(disposition,id));db.execute("UPDATE order_items SET status='refunded' WHERE id=?",(i['id'],))
            earned=db.one("SELECT amount FROM ledger WHERE item_id=? AND kind='sale'",(i['id'],))
            if earned:db.execute('INSERT INTO ledger VALUES(?,?,?,?,?,?) ON CONFLICT(item_id,kind) DO NOTHING',(uid(),i['store_id'],i['id'],'refund',-earned['amount'],now()))
            notify(db,i['user_id'],'Demo refund recorded for '+i['name'])
        else:fail('Invalid return action')
        audit(db,g.user['id'],'return.'+str(action),id,disposition)
    return {'ok':True}
