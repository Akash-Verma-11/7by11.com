import json, os
from concurrent.futures import ThreadPoolExecutor
import pytest
from app import create_app
from app.db import transaction

@pytest.fixture
def app(tmp_path,monkeypatch):
    monkeypatch.setenv('SQLITE_PATH',str(tmp_path/'test.db'))
    monkeypatch.setenv('SEED_DEMO','true')
    monkeypatch.setenv('DEMO_PASSWORD','7by11Demo!2026')
    monkeypatch.setenv('PAYMENT_MODE','demo')
    # DATABASE_URL is deliberately retained in PostgreSQL CI, with schema reset per test.
    if os.getenv('DATABASE_URL'):
        import psycopg
        with psycopg.connect(os.environ['DATABASE_URL']) as c:
            c.execute('DROP SCHEMA public CASCADE');c.execute('CREATE SCHEMA public')
    a=create_app();a.config['TESTING']=True;return a

def login(app,name='customer'):
    r=app.test_client().post('/api/login',json={'email':name+'@example.com','password':'7by11Demo!2026'})
    assert r.status_code==200,r.json
    return {'Authorization':'Bearer '+r.json['token']}

def call(app,path,method='get',data=None,headers=None):
    return getattr(app.test_client(),method)('/api'+path,json=data,headers=headers or {})

def buy(app,h,pid='p1',quantity=1,key='checkout-key-12345',method='demo',coupon=''):
    r=call(app,'/cart','post',{'product_id':pid,'quantity':quantity},h);assert r.status_code==200,r.json
    c=call(app,'/cart',headers=h).json
    b={'address':'Fictional test address Delhi 110001','method':method,'coupon':coupon,'items':[{'id':p['id'],'quantity':p['quantity'],'price':p['price']} for p in c['items']]}
    r=call(app,'/checkout','post',b,h|{'Idempotency-Key':key});return r,b

def fulfill(app,item,customer,cod=False):
    admin=login(app,'admin');seller=login(app,'seller');rider=login(app,'delivery')
    assert call(app,'/seller/items/'+item+'/pack','post',{},seller).status_code==200
    assert call(app,'/admin/items/'+item+'/assign','post',{'courier_id':'delivery'},admin).status_code==200
    assert call(app,'/delivery/tasks/'+item,'post',{'action':'start'},rider).status_code==200
    code=call(app,'/items/'+item+'/delivery-code','post',{},customer).json['code']
    r=call(app,'/delivery/tasks/'+item,'post',{'action':'complete','code':code,'cod_collected':cod},rider)
    assert r.status_code==200,r.json

def test_registration_privilege_and_password(app):
    assert call(app,'/register','post',{'email':'x@example.com','name':'New user','password':'StrongPass1234','role':'admin'}).status_code==403
    assert call(app,'/register','post',{'email':'x@example.com','name':'New user','password':'StrongPass1234'}).status_code==201
    h=login(app)
    assert call(app,'/me/password','post',{'current':'wrong','password':'StrongPass1234'},h).status_code==403
    assert call(app,'/me/password','post',{'current':'7by11Demo!2026','password':'StrongPass1234'},h).status_code==200
    assert call(app,'/me',headers=h).status_code==401

def test_origin_and_roles(app):
    assert call(app,'/admin/overview',headers=login(app)).status_code==403
    assert call(app,'/login','post',{'email':'customer@example.com','password':'7by11Demo!2026'},{'Origin':'https://attacker.invalid'}).status_code==403
    assert call(app,'/delivery/tasks',headers=login(app,'seller')).status_code==403

def test_seller_isolation_and_version(app):
    a=login(app,'seller');b=login(app,'seller2')
    assert call(app,'/seller/products/p1','patch',{'version':1,'price':100},b).status_code==403
    assert call(app,'/seller/products/p1','patch',{'version':1,'price':200000},a).status_code==200
    assert call(app,'/seller/products/p1','patch',{'version':1,'price':100},a).status_code==409
    assert call(app,'/seller/stores/store-1/finance',headers=b).status_code==403

def test_delist_suppression_and_stale_cart(app):
    c=login(app);s=login(app,'seller');a=login(app,'admin')
    call(app,'/cart','post',{'product_id':'p1','quantity':1},c)
    quote=[{'id':'p1','quantity':1,'price':249900}]
    assert call(app,'/seller/products/p1','patch',{'version':1,'status':'paused'},s).status_code==200
    r=call(app,'/checkout','post',{'address':'Fictional test street Delhi','items':quote},c|{'Idempotency-Key':'long-enough-key'})
    assert r.status_code==409
    assert call(app,'/admin/products/p1','post',{'status':'suppressed','reason':'Moderation test'},a).status_code==200
    assert call(app,'/seller/products/p1','patch',{'version':3,'status':'active'},s).status_code==409

def test_checkout_retry_price_and_stock(app):
    h=login(app);r,b=buy(app,h,quantity=2);assert r.status_code==201,r.json
    oid=r.json['id'];assert r.json['total']==499800
    repeat=call(app,'/checkout','post',b,h|{'Idempotency-Key':'checkout-key-12345'});assert repeat.json['id']==oid
    assert call(app,'/products/p1').json['stock']==28
    b['address']='Changed address Delhi 110002'
    assert call(app,'/checkout','post',b,h|{'Idempotency-Key':'checkout-key-12345'}).status_code==409

def test_concurrent_same_intent(app):
    h=login(app);call(app,'/cart','post',{'product_id':'p1','quantity':1},h)
    b={'address':'Fictional test street Delhi','items':[{'id':'p1','quantity':1,'price':249900}]}
    def send(_):return call(app,'/checkout','post',b,h|{'Idempotency-Key':'same-parallel-key'})
    with ThreadPoolExecutor(max_workers=6) as pool:rs=list(pool.map(send,range(6)))
    assert all(r.status_code in (200,201) for r in rs),[r.json for r in rs]
    assert len({r.json['id'] for r in rs})==1
    assert call(app,'/products/p1').json['stock']==29

def test_competing_last_unit(app):
    with transaction(True) as db:db.execute("UPDATE products SET stock=1 WHERE id='p1'")
    headers=[]
    for n in range(6):
        email=f'test{n}@example.com';call(app,'/register','post',{'email':email,'name':'Test Buyer','password':'StrongPass1234'})
        token=call(app,'/login','post',{'email':email,'password':'StrongPass1234'}).json['token'];h={'Authorization':'Bearer '+token};headers.append(h);call(app,'/cart','post',{'product_id':'p1','quantity':1},h)
    b={'address':'Fictional test street Delhi','items':[{'id':'p1','quantity':1,'price':249900}]}
    def send(h):return call(app,'/checkout','post',b,h|{'Idempotency-Key':'compete-last-unit'}).status_code
    with ThreadPoolExecutor(max_workers=6) as pool:codes=list(pool.map(send,headers))
    assert codes.count(201)==1 and codes.count(409)==5,codes

def test_split_sellers_and_line_cancellation(app):
    h=login(app);call(app,'/cart','post',{'product_id':'p3','quantity':1},h);r,_=buy(app,h);assert r.status_code==201,r.json
    assert len({i['store_id'] for i in r.json['items']})==2
    a=call(app,'/seller/orders',headers=login(app,'seller')).json;b=call(app,'/seller/orders',headers=login(app,'seller2')).json
    assert len(a)==len(b)==1
    iid=a[0]['id'];assert call(app,'/items/'+iid+'/cancel','post',{},h).status_code==200
    assert call(app,'/items/'+iid+'/cancel','post',{},h).status_code==200
    assert call(app,'/products/p1').json['stock']==30

def test_delivery_codes_assignment_and_refund(app):
    h=login(app);r,_=buy(app,h);iid=r.json['items'][0]['id'];rider=login(app,'delivery')
    assert call(app,'/delivery/tasks/'+iid,'post',{'action':'complete','code':'123456'},rider).status_code==404
    fulfill(app,iid,h)
    assert call(app,'/items/'+iid+'/return','post',{'reason':'Not suitable for me'},h).status_code==200
    seller=login(app,'seller');rid=call(app,'/seller/returns',headers=seller).json[0]['id']
    assert call(app,'/returns/'+rid+'/resolve','post',{'action':'refund','disposition':'restock'},seller).status_code==409
    assert call(app,'/returns/'+rid+'/resolve','post',{'action':'receive'},seller).status_code==200
    for _ in range(2):assert call(app,'/returns/'+rid+'/resolve','post',{'action':'refund','disposition':'restock'},seller).status_code==200
    assert call(app,'/products/p1').json['stock']==30
    assert call(app,'/seller/stores/store-1/finance',headers=seller).json['earned']==0

def test_coupon_once_and_discount_allocation(app):
    h=login(app);call(app,'/cart','post',{'product_id':'p3','quantity':1},h);r,_=buy(app,h,coupon='WELCOME10');assert r.status_code==201,r.json
    assert sum(i['total'] for i in r.json['items'])==r.json['total']
    r,_=buy(app,h,key='another-long-key',coupon='WELCOME10');assert r.status_code==409

def test_seller_application_and_staff_scope(app):
    c=login(app);a=login(app,'admin');sid=call(app,'/seller/stores','post',{'name':'New shop','description':'A new independent store'},c).json['id']
    assert call(app,'/admin/stores/'+sid,'post',{'status':'active','reason':'Reviewed application'},a).status_code==200
    s=login(app,'seller');assert call(app,'/seller/stores/store-1/members','post',{'email':'customer@example.com','permission':'catalog'},s).status_code==200
    assert call(app,'/seller/products/p1','patch',{'version':1,'price':249000},c).status_code==200
    assert call(app,'/seller/stores/store-1/finance',headers=c).status_code==403

def test_addresses_wishlist_tickets_and_reviews(app):
    c=login(app);s=login(app,'seller')
    aid=call(app,'/addresses','post',{'label':'Home','address':'Fictional street Delhi 110001'},c).json['id']
    call(app,'/addresses/'+aid,'delete',headers=s);assert len(call(app,'/addresses',headers=c).json)==1
    assert call(app,'/wishlist','post',{'product_id':'p1'},c).status_code==200
    assert len(call(app,'/wishlist',headers=c).json)==1
    tid=call(app,'/tickets','post',{'subject':'Need help','message':'Please explain delivery'},c).json['id']
    assert call(app,'/tickets/'+tid,'post',{'message':'Unauthorized'},s).status_code==403
    assert call(app,'/tickets/'+tid,'post',{'message':'We can help','status':'resolved'},login(app,'support')).status_code==200
    assert call(app,'/products/p1/reviews','post',{'rating':5,'body':'Unverified review'},c).status_code==403

def test_payout_revalidation_after_return(app):
    c=login(app);s=login(app,'seller');r,_=buy(app,c);iid=r.json['items'][0]['id'];fulfill(app,iid,c)
    pid=call(app,'/seller/stores/store-1/payouts','post',{},s).json['id']
    assert call(app,'/finance/payouts/'+pid,'post',{'status':'paid_demo'},s).status_code==403
    call(app,'/items/'+iid+'/return','post',{'reason':'Changed my mind'},c);rid=call(app,'/seller/returns',headers=s).json[0]['id']
    call(app,'/returns/'+rid+'/resolve','post',{'action':'receive'},s);call(app,'/returns/'+rid+'/resolve','post',{'action':'refund','disposition':'quarantine'},s)
    assert call(app,'/finance/payouts/'+pid,'post',{'status':'paid_demo'},login(app,'finance')).status_code==409
    assert call(app,'/products/p1').json['stock']==29

def test_media_upload_and_pending_moderation(app):
    import io
    from PIL import Image
    content=io.BytesIO();Image.new('RGB',(10,10),'red').save(content,'PNG');content.seek(0)
    r=app.test_client().post('/api/seller/products/p1/image',data={'image':(content,'sample.png')},headers=login(app,'seller'))
    assert r.status_code==200,r.json
    assert call(app,'/products/p1').status_code==404

def test_new_product_and_cod(app):
    s=login(app,'seller');r=call(app,'/seller/products','post',{'store_id':'store-1','name':'New desk lamp','sku':'LAMP-1','category':'Home','brand':'Example','description':'A useful adjustable lamp','price':10000,'mrp':15000,'stock':5},s)
    assert r.status_code==201,r.json
    id=r.json['id'];assert call(app,'/seller/products/'+id,'patch',{'version':1,'status':'active'},s).status_code==409
    call(app,'/admin/products/'+id,'post',{'status':'approved','reason':'Listing checked'},login(app,'admin'))
    assert call(app,'/seller/products/'+id,'patch',{'version':2,'status':'active'},s).status_code==200
    c=login(app);r,_=buy(app,c,method='cod');assert r.status_code==201;fulfill(app,r.json['items'][0]['id'],c,True)

def test_finance_cannot_pack_and_seller_can_shop(app):
    customer=login(app);r,_=buy(app,customer)
    iid=r.json['items'][0]['id']
    assert call(app,'/seller/items/'+iid+'/pack','post',{},login(app,'finance')).status_code==403
    seller=login(app,'seller')
    assert call(app,'/cart',headers=seller).status_code==200
    assert call(app,'/orders',headers=seller).status_code==200

def test_delivery_code_lock_and_renewal(app):
    c=login(app);r,_=buy(app,c);iid=r.json['items'][0]['id']
    s=login(app,'seller');a=login(app,'admin');d=login(app,'delivery')
    call(app,'/seller/items/'+iid+'/pack','post',{},s)
    call(app,'/admin/items/'+iid+'/assign','post',{'courier_id':'delivery'},a)
    call(app,'/delivery/tasks/'+iid,'post',{'action':'start'},d)
    code=call(app,'/items/'+iid+'/delivery-code','post',{},c).json['code']
    for _ in range(5):
        assert call(app,'/delivery/tasks/'+iid,'post',{'action':'complete','code':'000000'},d).status_code==409
    assert call(app,'/delivery/tasks/'+iid,'post',{'action':'complete','code':code},d).status_code==409
    fresh=call(app,'/items/'+iid+'/delivery-code','post',{},c).json['code']
    assert call(app,'/delivery/tasks/'+iid,'post',{'action':'complete','code':fresh},d).status_code==200

def test_login_throttle_is_persistent(app):
    for _ in range(10):
        assert call(app,'/login','post',{'email':'customer@example.com','password':'wrong'}).status_code==401
    assert call(app,'/login','post',{'email':'customer@example.com','password':'7by11Demo!2026'}).status_code==429
