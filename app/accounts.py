from flask import Blueprint,g,request
from .core import *
bp=Blueprint('accounts',__name__)

@bp.post('/api/register')
def register():
    b=body();email=text(b.get('email'),'email',5,200).lower();name=text(b.get('name'),'name',2,100);pw=text(b.get('password'),'password',12,128)
    if '@' not in email: fail('Invalid email')
    if b.get('role','customer')!='customer': fail('Privileged roles cannot self-register',403)
    with transaction(True) as db:
        if db.one('SELECT id FROM users WHERE email=?',(email,)): fail('Email already registered',409)
        id=uid('u-');db.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',(id,email,name,generate_password_hash(pw),'customer','active',now()))
    return {'id':id},201

@bp.post('/api/login')
def login():
    b=body();email=text(b.get('email'),'email',3,200).lower();pw=text(b.get('password'),'password',1,128)
    # Commit throttling state even on failed authentication.
    with transaction(True) as db:
        attempt=db.one('SELECT * FROM login_attempts WHERE email=?',(email,))
        if attempt and attempt['reset_at']>now() and attempt['attempts']>=10: fail('Too many attempts. Try again in 15 minutes.',429)
        u=db.one('SELECT * FROM users WHERE email=?',(email,))
        valid=u and u['status']=='active' and check_password_hash(u['password'],pw)
        if valid:
            db.execute('DELETE FROM login_attempts WHERE email=?',(email,))
            token=secrets.token_urlsafe(32);db.execute('INSERT INTO sessions VALUES(?,?,?)',(digest(token),u['id'],now()+3600))
        else:
            attempts=attempt['attempts']+1 if attempt and attempt['reset_at']>now() else 1
            db.execute('INSERT INTO login_attempts VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET attempts=excluded.attempts,reset_at=excluded.reset_at',(email,attempts,now()+900))
    if not valid: fail('Email or password is incorrect',401)
    return {'token':token,'user':public_user(u)}

@bp.get('/api/me')
@auth()
def me(): return public_user(g.user)

@bp.post('/api/logout')
@auth()
def logout():
    with transaction(True) as db: db.execute('DELETE FROM sessions WHERE token=?',(digest(request.headers['Authorization'].removeprefix('Bearer ')),))
    return {'ok':True}

@bp.patch('/api/me')
@auth()
def profile():
    b=body()
    with transaction(True) as db:
        db.execute('UPDATE users SET name=? WHERE id=?',(text(b.get('name'),'name',2,100),g.user['id']))
    return {'ok':True}

@bp.post('/api/me/password')
@auth()
def password_change():
    b=body()
    if not check_password_hash(g.user['password'],str(b.get('current',''))): fail('Current password is incorrect',403)
    new=text(b.get('password'),'new password',12,128)
    with transaction(True) as db:
        db.execute('UPDATE users SET password=? WHERE id=?',(generate_password_hash(new),g.user['id']))
        db.execute('DELETE FROM sessions WHERE user_id=?',(g.user['id'],))
    return {'ok':True}

@bp.route('/api/addresses',methods=['GET','POST'])
@auth()
def addresses():
    with transaction(request.method=='POST') as db:
        if request.method=='GET': return db.all('SELECT * FROM addresses WHERE user_id=?',(g.user['id'],))
        b=body();id=uid();db.execute('INSERT INTO addresses VALUES(?,?,?,?)',(id,g.user['id'],text(b.get('label'),'label',1,40),text(b.get('address'),'address',10,500)))
        return {'id':id},201

@bp.delete('/api/addresses/<id>')
@auth()
def delete_address(id):
    with transaction(True) as db: db.execute('DELETE FROM addresses WHERE id=? AND user_id=?',(id,g.user['id']))
    return {'ok':True}

@bp.route('/api/notifications',methods=['GET','POST'])
@auth()
def notices():
    with transaction(request.method=='POST') as db:
        if request.method=='POST': db.execute('UPDATE notifications SET seen=1 WHERE user_id=?',(g.user['id'],));return {'ok':True}
        return db.all('SELECT * FROM notifications WHERE user_id=? ORDER BY created DESC LIMIT 100',(g.user['id'],))

@bp.route('/api/tickets',methods=['GET','POST'])
@auth()
def tickets():
    with transaction(request.method=='POST') as db:
        if request.method=='GET':
            if g.user['role'] in ('admin','support'): rows=db.all('SELECT * FROM tickets ORDER BY created DESC LIMIT 200')
            else: rows=db.all('SELECT * FROM tickets WHERE user_id=? ORDER BY created DESC',(g.user['id'],))
            for r in rows:r['messages']=json.loads(r['messages'])
            return rows
        b=body();id=uid('t-');messages=[{'by':g.user['name'],'text':text(b.get('message'),'message',3,2000),'at':now()}]
        db.execute('INSERT INTO tickets VALUES(?,?,?,?,?,?)',(id,g.user['id'],text(b.get('subject'),'subject',3,100),'open',json.dumps(messages),now()))
        return {'id':id},201

@bp.post('/api/tickets/<id>')
@auth()
def reply_ticket(id):
    b=body()
    with transaction(True) as db:
        t=db.one('SELECT * FROM tickets WHERE id=?',(id,))
        if not t: fail('Ticket not found',404)
        staff=g.user['role'] in ('admin','support')
        if t['user_id']!=g.user['id'] and not staff: fail('Access denied',403)
        messages=json.loads(t['messages']);messages.append({'by':g.user['name'],'text':text(b.get('message'),'message',1,2000),'at':now()})
        status=b.get('status',t['status']) if staff else 'open'
        if status not in ('open','resolved'): fail('Invalid ticket status')
        db.execute('UPDATE tickets SET messages=?,status=? WHERE id=?',(json.dumps(messages),status,id));notify(db,t['user_id'],'Support updated ticket '+id)
    return {'ok':True}
