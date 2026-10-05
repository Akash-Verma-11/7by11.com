import hashlib, json, os, secrets, time
from functools import wraps
from flask import request, g, abort
from werkzeug.security import generate_password_hash, check_password_hash
from .db import transaction

def now(): return int(time.time())
def uid(prefix=''): return prefix + secrets.token_hex(10)
def digest(s): return hashlib.sha256(s.encode()).hexdigest()
def fail(message, code=422): abort(code, description=message)
def text(value, label, low=1, high=500):
    if not isinstance(value,str) or not low <= len(value.strip()) <= high: fail('Invalid '+label)
    return value.strip()
def integer(value,label,low=0,high=10000000):
    if type(value) is not int or not low<=value<=high: fail('Invalid '+label)
    return value
def body():
    value=request.get_json(silent=True)
    if not isinstance(value,dict): fail('Expected a JSON object')
    return value
def audit(db,actor,action,entity,detail=''):
    db.execute('INSERT INTO audit VALUES(?,?,?,?,?,?)',(uid(),actor,action,entity,detail,now()))
def notify(db,user,message):
    db.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid(),user,message,0,now()))
def public_user(u): return {k:u[k] for k in ('id','name','email','role','status')}
def auth(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapped(*a,**kw):
            token=request.headers.get('Authorization','').removeprefix('Bearer ')
            with transaction() as db:
                u=db.one('SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires>?',(digest(token),now()))
            if not u or u['status']!='active': fail('Please sign in again',401)
            if roles and u['role'] not in roles: fail('You do not have permission',403)
            g.user=u
            return fn(*a,**kw)
        return wrapped
    return decorator

def store_access(db,store_id,permission='catalog'):
    s=db.one('SELECT * FROM stores WHERE id=?',(store_id,))
    if not s: fail('Store not found',404)
    if s['owner_id']==g.user['id']: return s
    m=db.one('SELECT * FROM members WHERE store_id=? AND user_id=?',(store_id,g.user['id']))
    if not m or m['permission'] not in ('owner',permission): fail('Store access denied',403)
    return s

def product_access(db,pid,permission='catalog'):
    p=db.one('SELECT * FROM products WHERE id=?',(pid,))
    if not p: fail('Product not found',404)
    store_access(db,p['store_id'],permission)
    return p

def item_access(db,iid,permission='fulfillment'):
    item=db.one('SELECT i.*,o.user_id,o.payment,o.address FROM order_items i JOIN orders o ON i.order_id=o.id WHERE i.id=?',(iid,))
    if not item: fail('Order item not found',404)
    if g.user['role'] not in ('admin','warehouse'): store_access(db,item['store_id'],permission)
    return item

def stock(db,pid,delta,actor,reason):
    if db.execute('UPDATE products SET stock=stock+?,version=version+1 WHERE id=? AND stock+?>=0',(delta,pid,delta)).rowcount!=1: fail('Insufficient stock',409)
    db.execute('INSERT INTO stock_moves VALUES(?,?,?,?,?,?)',(uid(),pid,delta,reason,actor,now()))

def seed_database():
    from pathlib import Path
    with transaction(True) as db:
        for statement in Path(__file__).with_name('schema.sql').read_text().split(';'):
            if statement.strip(): db.execute(statement)
        db.execute('INSERT INTO migrations VALUES(1,?) ON CONFLICT(version) DO NOTHING',(now(),))
        if os.getenv('SEED_DEMO','true').lower()!='true': return
        password=os.getenv('DEMO_PASSWORD','7by11Demo!2026')
        for role,name in [('customer','Akash'),('seller','Everyday Studio'),('seller2','Home Collective'),('admin','Marketplace Admin'),('delivery','Delivery Partner'),('warehouse','Warehouse Team'),('support','Customer Care'),('finance','Finance Team')]:
            db.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',(role,role+'@example.com',name,generate_password_hash(password),'seller' if role=='seller2' else role,'active',now()))
        for sid,owner,name in [('store-1','seller','Everyday Studio'),('store-2','seller2','Home Collective')]:
            db.execute('INSERT INTO stores VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',(sid,owner,name,'Thoughtful essentials, selected for everyday life.','active','',1))
        products=json.loads((Path(__file__).parent/'seed.json').read_text())
        for index,p in enumerate(products):
            sid='store-2' if index in (2,5) else 'store-1'
            db.execute('INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',(p['id'],sid,p['name'],p['category'],'7by11 Select','Everyday essentials with clear pricing and simple returns.',json.dumps(p['attributes']),p['id'].upper(),p['price'],p['mrp'],p['stock'],'active','approved',p['id'],1,now()))
        db.execute('INSERT INTO coupons VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(code) DO NOTHING',('WELCOME10',10,50000,100000,10000,0,1,now()+365*86400))
