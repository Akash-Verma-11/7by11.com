import base64, csv, io
from flask import Blueprint,g,request,Response
from .core import *
bp=Blueprint('catalog',__name__)

def unpack(p):
    p['attributes']=json.loads(p['attributes']);return p

@bp.get('/api/products')
def products():
    term=request.args.get('q','').lower()[:100];category=request.args.get('category','');sort=request.args.get('sort','new')
    try: page=max(1,int(request.args.get('page','1')))
    except ValueError: fail('Invalid page')
    sql="SELECT p.*,s.name AS store_name FROM products p JOIN stores s ON p.store_id=s.id WHERE p.status='active' AND p.moderation='approved' AND s.status='active'"
    args=[]
    if term:sql+=' AND (LOWER(p.name) LIKE ? OR LOWER(p.brand) LIKE ?)';args+=['%'+term+'%']*2
    if category:sql+=' AND p.category=?';args.append(category)
    sql+=' ORDER BY '+{'price_asc':'p.price ASC','price_desc':'p.price DESC','new':'p.created DESC,p.id'}.get(sort,'p.created DESC,p.id')+' LIMIT 24 OFFSET ?';args.append((page-1)*24)
    with transaction() as db:return [unpack(p) for p in db.all(sql,args)]

@bp.get('/api/products/<id>')
def product(id):
    with transaction() as db:
        p=db.one("SELECT p.*,s.name AS store_name FROM products p JOIN stores s ON p.store_id=s.id WHERE p.id=? AND p.status='active' AND p.moderation='approved' AND s.status='active'",(id,))
        if not p:fail('Product is unavailable',404)
        p=unpack(p);p['reviews']=db.all("SELECT r.rating,r.body,u.name FROM reviews r JOIN users u ON r.user_id=u.id WHERE r.product_id=? AND r.status='approved' ORDER BY r.created DESC LIMIT 100",(id,))
        return p

@bp.route('/api/wishlist',methods=['GET','POST'])
@auth()
def wishlist():
    with transaction(request.method=='POST') as db:
        if request.method=='GET':return [unpack(p) for p in db.all('SELECT p.* FROM products p JOIN wishlist w ON p.id=w.product_id WHERE w.user_id=?',(g.user['id'],))]
        b=body();pid=text(b.get('product_id'),'product')
        if not db.one('SELECT id FROM products WHERE id=?',(pid,)):fail('Product not found',404)
        if b.get('remove'):db.execute('DELETE FROM wishlist WHERE user_id=? AND product_id=?',(g.user['id'],pid))
        else:db.execute('INSERT INTO wishlist VALUES(?,?) ON CONFLICT DO NOTHING',(g.user['id'],pid))
        return {'ok':True}

@bp.post('/api/products/<id>/reviews')
@auth('customer','seller')
def review(id):
    b=body()
    with transaction(True) as db:
        if not db.one("SELECT i.id FROM order_items i JOIN orders o ON i.order_id=o.id WHERE o.user_id=? AND i.product_id=? AND i.status IN ('delivered','return_requested','refunded')",(g.user['id'],id)):fail('A delivered purchase is required',403)
        db.execute('INSERT INTO reviews VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET rating=excluded.rating,body=excluded.body,status=excluded.status',(uid(),g.user['id'],id,integer(b.get('rating'),'rating',1,5),text(b.get('body'),'review',3,1000),'pending',now()))
    return {'ok':True,'message':'Review submitted for moderation'}

@bp.route('/api/seller/stores',methods=['GET','POST'])
@auth()
def stores():
    with transaction(request.method=='POST') as db:
        if request.method=='GET':return db.all('SELECT DISTINCT s.* FROM stores s LEFT JOIN members m ON m.store_id=s.id WHERE s.owner_id=? OR m.user_id=?',(g.user['id'],g.user['id']))
        b=body();id=uid('store-');db.execute('INSERT INTO stores VALUES(?,?,?,?,?,?,?)',(id,g.user['id'],text(b.get('name'),'store name',3,100),text(b.get('description'),'description',5,1000),'pending','',1));audit(db,g.user['id'],'store.application',id)
        return {'id':id},201

@bp.patch('/api/seller/stores/<id>')
@auth()
def edit_store(id):
    b=body()
    with transaction(True) as db:
        s=store_access(db,id,'owner')
        db.execute('UPDATE stores SET name=?,description=?,version=version+1 WHERE id=?',(text(b.get('name',s['name']),'name',3,100),text(b.get('description',s['description']),'description',5,1000),id));audit(db,g.user['id'],'store.edit',id)
    return {'ok':True}

@bp.route('/api/seller/stores/<id>/members',methods=['GET','POST'])
@auth()
def members(id):
    with transaction(request.method=='POST') as db:
        store_access(db,id,'owner')
        if request.method=='GET':return db.all('SELECT m.*,u.email FROM members m JOIN users u ON m.user_id=u.id WHERE store_id=?',(id,))
        b=body();u=db.one('SELECT * FROM users WHERE email=?',(text(b.get('email'),'email').lower(),))
        if not u:fail('The staff member must create an account first',404)
        permission=b.get('permission')
        if permission not in ('catalog','fulfillment','finance','remove'):fail('Invalid permission')
        if permission=='remove':db.execute('DELETE FROM members WHERE store_id=? AND user_id=?',(id,u['id']))
        else:db.execute('INSERT INTO members VALUES(?,?,?) ON CONFLICT(store_id,user_id) DO UPDATE SET permission=excluded.permission',(id,u['id'],permission))
        audit(db,g.user['id'],'membership.'+permission,id)
        return {'ok':True}

@bp.route('/api/seller/products',methods=['GET','POST'])
@auth()
def seller_products():
    with transaction(request.method=='POST') as db:
        if request.method=='GET':return [unpack(p) for p in db.all("SELECT DISTINCT p.* FROM products p JOIN stores s ON p.store_id=s.id LEFT JOIN members m ON m.store_id=s.id WHERE s.owner_id=? OR (m.user_id=? AND m.permission='catalog') ORDER BY p.created DESC",(g.user['id'],g.user['id']))]
        b=body();sid=text(b.get('store_id'),'store');s=store_access(db,sid)
        if s['status']!='active':fail('Store must be approved and active',409)
        category=b.get('category')
        if category not in ('Electronics','Fashion','Home'):fail('Invalid category')
        price=integer(b.get('price'),'price',1);mrp=integer(b.get('mrp'),'MRP',price);quantity=integer(b.get('stock'),'stock',0,100000)
        attrs=b.get('attributes',{})
        if not isinstance(attrs,dict) or len(json.dumps(attrs))>2000:fail('Invalid attributes')
        sku=text(b.get('sku'),'SKU',1,80)
        if db.one('SELECT id FROM products WHERE store_id=? AND sku=?',(sid,sku)):fail('SKU already exists in this store',409)
        id=uid('p-');db.execute('INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(id,sid,text(b.get('name'),'name',3,150),category,text(b.get('brand','Independent'),'brand',1,100),text(b.get('description'),'description',5,2000),json.dumps(attrs),sku,price,mrp,quantity,'draft','pending','p3',1,now()))
        db.execute('INSERT INTO stock_moves VALUES(?,?,?,?,?,?)',(uid(),id,quantity,'initial stock',g.user['id'],now()));audit(db,g.user['id'],'product.create',id)
        return {'id':id},201

@bp.patch('/api/seller/products/<id>')
@auth()
def update_product(id):
    b=body()
    with transaction(True) as db:
        p=product_access(db,id)
        if integer(b.get('version'),'version',1)!=p['version']:fail('This product changed. Refresh before editing.',409)
        price=integer(b.get('price',p['price']),'price',1);mrp=integer(b.get('mrp',p['mrp']),'MRP',price)
        status=b.get('status',p['status'])
        if status not in ('draft','active','paused','archived'):fail('Invalid listing status')
        if status=='active' and p['moderation']!='approved':fail('Admin approval is required before activation',409)
        name=text(b.get('name',p['name']),'name',3,150);description=text(b.get('description',p['description']),'description',5,2000)
        moderation='pending' if name!=p['name'] or description!=p['description'] else p['moderation']
        db.execute('UPDATE products SET name=?,description=?,price=?,mrp=?,status=?,moderation=?,version=version+1 WHERE id=?',(name,description,price,mrp,status,moderation,id));audit(db,g.user['id'],'product.edit',id,json.dumps({'old_price':p['price'],'new_price':price,'status':status}))
    return {'ok':True}

@bp.post('/api/seller/products/<id>/stock')
@auth()
def update_stock(id):
    b=body()
    with transaction(True) as db:
        p=product_access(db,id,'fulfillment')
        if integer(b.get('version'),'version',1)!=p['version']:fail('Stock changed. Refresh and retry.',409)
        stock(db,id,integer(b.get('delta'),'stock adjustment',-100000,100000),g.user['id'],text(b.get('reason'),'reason',3,150))
        audit(db,g.user['id'],'stock.adjust',id)
    return {'ok':True}

@bp.post('/api/seller/products/<id>/image')
@auth()
def upload(id):
    # Decode and re-encode raster images to strip metadata and reject SVG/active files.
    from PIL import Image,UnidentifiedImageError
    f=request.files.get('image')
    if not f:fail('Image file required')
    data=f.read(1500001)
    if len(data)>1500000:fail('Image must be under 1.5 MB')
    try:
        im=Image.open(io.BytesIO(data))
        if im.width*im.height>16000000:fail('Image dimensions are too large')
        im=im.convert('RGB');im.thumbnail((1200,1200));out=io.BytesIO();im.save(out,'JPEG',quality=85)
    except (UnidentifiedImageError,OSError):fail('Choose a valid raster image')
    with transaction(True) as db:
        product_access(db,id);mid=uid('img-')
        db.execute('INSERT INTO media VALUES(?,?,?,?)',(mid,g.user['id'],'image/jpeg',base64.b64encode(out.getvalue()).decode()))
        db.execute("UPDATE products SET image=?,moderation='pending',version=version+1 WHERE id=?",(mid,id));audit(db,g.user['id'],'product.image',id)
    return {'ok':True}

@bp.get('/api/media/<id>')
def media(id):
    with transaction() as db:m=db.one('SELECT * FROM media WHERE id=?',(id,))
    if not m:fail('Image not found',404)
    return Response(base64.b64decode(m['data']),mimetype=m['mime'])

@bp.get('/api/stores')
def public_stores():
    with transaction() as db:return db.all("SELECT id,name,description FROM stores WHERE status='active'")
