'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(n/100);
let page=1;
let token='',user=null,view='shop',category='',sort='new',query='',checkoutIntent=null,workspaceTab='catalog';
async function api(path,method='GET',data,headers={}){const r=await fetch('/api'+path,{method,headers:{...(data instanceof FormData?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{}),...headers},...(data===undefined?{}:{body:data instanceof FormData?data:JSON.stringify(data)})});const b=await r.json();if(!r.ok)throw Error(b.error||'Request failed');return b;}
let toastTimer;function toast(s){$('#toast').textContent=s;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function modal(html){$('#modal-content').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();}
function close(){ $('#modal').close(); }
function badge(s){return '<span class="badge">'+esc(s.replaceAll('_',' '))+'</span>';}
function photo(p){return p.image.startsWith('img-')?`<img class="photo" src="/api/media/${esc(p.image)}" alt="${esc(p.name)}">`:`<div class="photo photo-${/^p[1-6]$/.test(p.image)?p.image:'p3'}" role="img" aria-label="${esc(p.name)}"></div>`;}
function field(label,name,type='text',value='',required=true){return `<label>${esc(label)}<input name="${name}" type="${type}" ${type==='number'?'step="any"':''} value="${esc(value)}" ${required?'required':''}></label>`;}
function area(label,name,value=''){return `<label>${esc(label)}<textarea name="${name}" required>${esc(value)}</textarea></label>`;}
function formError(form,e){let target=form.querySelector('.error');if(!target){target=document.createElement('p');target.className='error';form.append(target);}target.textContent=e.message;}
function requireUser(){if(user)return true;login();return false;}
async function go(next){if(next!=='shop'&&!requireUser())return;view=next;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===next));$('#main').innerHTML='<div class="empty">Loading…</div>';try{await ({shop,wishlist,orders,profile,workspace,support,notifications}[next])();}catch(e){$('#main').innerHTML=`<div class="empty">${esc(e.message)}</div>`;}}
function cards(products,saved=false){return products.length?`<div class="products">${products.map(p=>`<article class="product">${photo(p)}<div class="product-body"><span class="eyebrow">${esc(p.category)}</span><h3><button data-detail="${esc(p.id)}">${esc(p.name)}</button></h3><span class="price">${money(p.price)}</span><del>${money(p.mrp)}</del><span class="discount">${Math.round((1-p.price/p.mrp)*100)}% off</span><div class="product-bottom"><button type="button" class="store-link" data-store="${esc(p.store_id)}">${esc(p.store_name||'Independent store')}</button><button data-save="${esc(p.id)}" data-remove="${saved}">${saved?'Remove':'Save'}</button><button data-add="${esc(p.id)}">Add to bag</button></div></div></article>`).join('')}</div>`:'<div class="empty">No products found.</div>';}
async function shop(){const products=await api('/products?q='+encodeURIComponent(query)+'&category='+encodeURIComponent(category)+'&sort='+sort+'&page='+page);$('#main').innerHTML=`${query?'':`<section class="hero"><div><span class="eyebrow">THE EVERYDAY COLLECTION</span><h1>Good finds.<br>Great everyday.</h1><p>Small upgrades for your home, your desk, and wherever life takes you.</p><button class="primary" id="explore">Explore the collection ↗</button></div><div class="hero-photo" role="img" aria-label="Wireless headphones"></div></section>`}<div class="section-head" id="collection"><div><span class="eyebrow">CURATED BY INDEPENDENT STORES</span><h2>${query?'Results for '+esc(query):'Your next favorites'}</h2></div><div class="filters"><select id="category" aria-label="Category">${['','Electronics','Fashion','Home'].map(x=>`<option ${category===x?'selected':''} value="${x}">${x||'All essentials'}</option>`).join('')}</select><select id="sort" aria-label="Sort"><option value="new" ${sort==='new'?'selected':''}>Newest first</option><option value="price_asc" ${sort==='price_asc'?'selected':''}>Price: low to high</option><option value="price_desc" ${sort==='price_desc'?'selected':''}>Price: high to low</option></select></div></div>${cards(products)}<div class="row"><button id="prev-page" ${page===1?'disabled':''}>Previous page</button><span>Page ${page}</span><button id="next-page" ${products.length<24?'disabled':''}>Next page</button></div><div class="service-line"><span>Independent stores</span><span>Clear pricing</span><span>Order updates</span><span>Item-level returns</span></div>`;$('#prev-page').onclick=()=>{page--;go('shop');};$('#next-page').onclick=()=>{page++;go('shop');};$('#category').onchange=e=>{page=1;category=e.target.value;go('shop');};$('#sort').onchange=e=>{page=1;sort=e.target.value;go('shop');};if($('#explore'))$('#explore').onclick=()=>$('#collection').scrollIntoView({behavior:'smooth'});}
async function openStore(id){
  view='storefront';
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));
  $('#main').innerHTML='<div class="empty">Loading store…</div>';

  try {
    const [store, products] = await Promise.all([
      api('/stores/'+encodeURIComponent(id)),
      api('/products?store_id='+encodeURIComponent(id)+'&sort='+sort+'&page='+page)
    ]);

    $('#main').innerHTML=`<section class="storefront-header">
      <button type="button" data-view="shop">← Back to marketplace</button>
      <span class="eyebrow">INDEPENDENT SELLER</span>
      <h1>${esc(store.name)}</h1>
      <p>${esc(store.description)}</p>
    </section>
    <div class="section-head">
      <div><span class="eyebrow">STORE COLLECTION</span>
      <h2>Products from ${esc(store.name)}</h2></div>
      <span>${products.length} products shown</span>
    </div>
    ${cards(products)}
    <div class="row">
      <button id="store-prev-page" ${page===1?'disabled':''}>Previous page</button>
      <span>Page ${page}</span>
      <button id="store-next-page" ${products.length<24?'disabled':''}>Next page</button>
    </div>`;

    $('#store-prev-page').onclick=()=>{page--;openStore(id);};
    $('#store-next-page').onclick=()=>{page++;openStore(id);};
  } catch(e) {
    $('#main').innerHTML=`<div class="empty">${esc(e.message)}
      <p><button data-view="shop">Back to marketplace</button></p>
    </div>`;
  }
}

function login(register=false){modal(`<span class="eyebrow">WELCOME TO 7BY11</span><h2>${register?'Create your account':'Good to see you'}</h2><form id="login-form">${register?field('Your name','name'):''}${field('Email','email','email')}${field('Password','password','password')}<button class="primary wide">${register?'Create account':'Sign in'}</button><p class="error"></p></form><button id="toggle-register">${register?'Already registered? Sign in':'Create a customer account'}</button><div class="demo">Local demo accounts: customer, seller, seller2, admin, delivery, warehouse, support, finance @example.com.<br>Default password: 7by11Demo!2026</div>`);$('#toggle-register').onclick=()=>login(!register);$('#login-form').onsubmit=async e=>{e.preventDefault();const f=e.target,b=Object.fromEntries(new FormData(f));try{if(register)await api('/register','POST',b);const r=await api('/login','POST',b);token=r.token;user=r.user;$('#account').textContent=user.name+' · Sign out';close();checkoutIntent=null;toast('Welcome, '+user.name);await refreshBagCount();await go(user.role==='customer'?'shop':'workspace');}catch(err){formError(f,err);}};}
async function refreshBagCount(){if(!['customer','seller'].includes(user?.role)){$('#bag-count').textContent='0';return;}const c=await api('/cart');$('#bag-count').textContent=c.items.reduce((n,i)=>n+i.quantity,0);}
async function details(id){const p=await api('/products/'+id);modal(`${photo(p)}<button type="button" class="store-link" data-store="${esc(p.store_id)}">Visit ${esc(p.store_name)}</button><h2>${esc(p.name)}</h2><p>${esc(p.description)}</p><p>${Object.entries(p.attributes).map(([k,v])=>esc(k)+': '+esc(v)).join(' · ')}</p><p class="price">${money(p.price)} <del>${money(p.mrp)}</del></p><p>${p.stock} available</p><button class="primary" data-add="${esc(p.id)}" ${p.stock?'':'disabled'}>Add to bag</button><h3>Customer reviews</h3>${p.reviews.map(r=>`<p><strong>${esc(r.name)} · ${r.rating}/5</strong><br>${esc(r.body)}</p>`).join('')||'<p class="muted">No approved reviews yet.</p>'}`);}
async function add(id){if(!requireUser())return;if(!['customer','seller'].includes(user.role))throw Error('Use a customer account to shop.');const c=await api('/cart');const p=c.items.find(i=>i.id===id);await api('/cart','POST',{product_id:id,quantity:(p?.quantity||0)+1});checkoutIntent=null;await refreshBagCount();toast('Added to your bag');}
async function bag(){if(!requireUser())return;if(!['customer','seller'].includes(user.role))throw Error('Shopping bag is available to customer accounts.');const [c,addresses]=await Promise.all([api('/cart'),api('/addresses')]);modal(`<h2>Your shopping bag</h2>${c.items.map(i=>`<div class="order-item row between"><div><strong>${esc(i.name)}</strong><br>${money(i.price*i.quantity)}</div><div class="row"><button data-qty="${i.id}" data-value="${i.quantity-1}">−</button>${i.quantity}<button data-qty="${i.id}" data-value="${i.quantity+1}">+</button></div></div>`).join('')||'<p>Your bag is empty.</p>'}${c.items.length?`<h3>Subtotal ${money(c.total)}</h3><form id="checkout-form">${addresses.length?`<label>Saved address<select id="saved-address"><option value="">Enter a new address</option>${addresses.map(a=>`<option value="${esc(a.address)}">${esc(a.label)}</option>`).join('')}</select></label>`:''}${area('Delivery address','address')}${field('Coupon code optional','coupon','text','',false)}<label>Payment<select name="method"><option value="demo">Demo prepaid</option><option value="cod">Cash on delivery demo</option></select></label><p class="demo">No real charge. WELCOME10 gives 10% off orders from ₹1,000, up to ₹500, once per customer.</p><button class="primary wide">Place demo order</button><p class="error"></p></form>`:''}`);if($('#saved-address'))$('#saved-address').onchange=e=>$('#checkout-form textarea').value=e.target.value;if($('#checkout-form'))$('#checkout-form').onsubmit=async e=>{e.preventDefault();const f=e.target,b=Object.fromEntries(new FormData(f));b.items=c.items.map(p=>({id:p.id,quantity:p.quantity,price:p.price}));const fingerprint=JSON.stringify(b);if(!checkoutIntent||checkoutIntent.fingerprint!==fingerprint)checkoutIntent={key:crypto.randomUUID(),fingerprint};const button=f.querySelector('button');button.disabled=true;try{await api('/checkout','POST',b,{'Idempotency-Key':checkoutIntent.key});checkoutIntent=null;close();await refreshBagCount();toast('Order placed');await go('orders');}catch(err){formError(f,err);}finally{button.disabled=false;}};}
async function wishlist(){$('#main').innerHTML='<h1>Saved for later</h1>'+cards(await api('/wishlist'),true);}
const stages=['confirmed','packed','out_for_delivery','delivered'];

const trackingLabels = {
  'order.confirmed': 'Order confirmed',
  'cancel.demo': 'Item cancelled',
  'item.pack': 'Packed by seller',
  'delivery.start': 'Out for delivery',
  'delivery.attempt_failed': 'Delivery attempt failed',
  'delivery.complete': 'Delivered',
  'return.request': 'Return requested',
  'return.receive': 'Return received',
  'return.refund': 'Refund recorded'
};

async function trackItem(id) {
  const tracking = await api('/items/' + encodeURIComponent(id) + '/tracking');
  const events = tracking.events || [];

  modal(`
    <div class="tracking-modal">
      <span class="eyebrow">ORDER ITEM TIMELINE</span>
      <h2>Track your item</h2>
      <p class="muted">Item ID: ${esc(tracking.item_id)}</p>
      <div class="tracking-current">
        <span>Current status</span>
        ${badge(tracking.status)}
      </div>
      <ol class="tracking-timeline">
        ${events.map(event => {
          const date = new Date(Number(event.created) * 1000);
          const timestamp = Number.isNaN(date.getTime())
            ? 'Time unavailable'
            : date.toLocaleString();
          const label = trackingLabels[event.event] ||
            event.event.replaceAll('.', ' ').replaceAll('_', ' ');

          return `
            <li class="tracking-event">
              <span class="tracking-marker" aria-hidden="true"></span>
              <div class="tracking-event-head">
                <strong>${esc(label)}</strong>
                ${badge(event.status)}
              </div>
              <time>${esc(timestamp)}</time>
              ${event.detail ? `<p>${esc(event.detail)}</p>` : ''}
              <small>Updated by ${esc(event.actor_name)}</small>
            </li>
          `;
        }).join('') || '<li class="muted">No tracking events recorded.</li>'}
      </ol>
    </div>
  `);
}

async function orders(){if(!['customer','seller'].includes(user.role)){$('#main').innerHTML='<div class="empty">Use Workspace for your operational orders.</div>';return;}const os=await api('/orders');$('#main').innerHTML=`<div class="section-head"><div><span class="eyebrow">YOUR PURCHASES</span><h1>Order history</h1></div><button data-view="orders">Refresh</button></div>${os.map(o=>`<article class="order"><div class="row between"><strong>${esc(o.id)}</strong>${badge(o.payment)}<strong>${money(o.total)}</strong><button data-invoice="${o.id}">Receipt</button></div><p class="muted">${esc(o.address)} · ${new Date(o.created*1000).toLocaleDateString()}</p>${o.discount?`<p>Coupon savings ${money(o.discount)}</p>`:''}${o.items.map(i=>`<div class="order-item"><div class="row between"><strong>${esc(i.name)} × ${i.quantity}</strong>${badge(i.status)}<span>${money(i.total)}</span></div><div class="progress">${stages.map((s,n)=>`<span class="${n<=stages.indexOf(i.status)?'done':''}">${s.replaceAll('_',' ')}</span>`).join('')}</div><div class="row"><button data-track="${i.id}">Track item</button>${i.status==='confirmed'?`<button data-cancel="${i.id}">Cancel item</button>`:''}${i.status==='out_for_delivery'?`<button data-code="${i.id}">Show delivery code</button>`:''}${i.status==='delivered'?`<button data-return="${i.id}">Request return</button><button data-review="${i.product_id}">Write review</button>`:''}</div></div>`).join('')}</article>`).join('')||'<div class="empty">Your first find is waiting in the store.</div>'}`;}
async function profile(){const addresses=await api('/addresses');$('#main').innerHTML=`<h1>My account</h1><div class="grid2"><section class="panel"><h3>Profile</h3><form data-form="profile">${field('Name','name','text',user.name)}<p>${esc(user.email)} · ${esc(user.role)}</p><button class="primary">Save profile</button></form><h3>Change password</h3><form data-form="password">${field('Current password','current','password')}${field('New password at least 12 characters','password','password')}<button>Change password and sign out</button></form></section><section class="panel"><h3>Address book</h3>${addresses.map(a=>`<p><strong>${esc(a.label)}</strong><br>${esc(a.address)} <button data-address-delete="${a.id}">Remove</button></p>`).join('')}<form data-form="address">${field('Label','label')}${area('Address','address')}<button class="primary">Save address</button></form></section></div><section class="panel"><h3>Open your store</h3><p>Apply to sell. An administrator reviews the application before products can go live.</p><form data-form="store">${field('Store name','name')}${area('Store description','description')}<button>Submit application</button></form></section>`;}
async function support(){const ts=await api('/tickets');$('#main').innerHTML=`<h1>Help & support</h1><section class="panel"><form data-form="ticket">${field('Subject','subject')}${area('How can we help','message')}<button class="primary">Create ticket</button></form></section>${ts.map(t=>`<section class="panel"><div class="row between"><h3>${esc(t.subject)}</h3>${badge(t.status)}</div>${t.messages.map(m=>`<p><strong>${esc(m.by)}</strong><br>${esc(m.text)}</p>`).join('')}<button data-reply="${t.id}">Reply${['admin','support'].includes(user.role)?' or resolve':''}</button></section>`).join('')}`;}
async function notifications(){const ns=await api('/notifications');$('#main').innerHTML=`<div class="section-head"><h1>Your updates</h1><button id="read-updates">Mark all read</button></div>${ns.map(n=>`<section class="panel">${!n.seen?'<strong>New · </strong>':''}${esc(n.message)}<p class="muted">${new Date(n.created*1000).toLocaleString()}</p></section>`).join('')||'<div class="empty">No updates yet.</div>'}`;$('#read-updates').onclick=async()=>{await api('/notifications','POST',{});go('notifications');};}
async function workspace(){if(user.role==='admin')return admin();if(user.role==='delivery')return delivery();if(user.role==='support')return support();if(user.role==='warehouse')return warehouse();if(user.role==='finance')return finance();return seller();}
async function seller(){const stores=await api('/seller/stores');$('#main').innerHTML=`<span class="eyebrow">7BY11 SELLER STUDIO</span><h1>Your business, in view.</h1><div class="tabs">${['catalog','inventory','orders','returns','finance','staff'].map(t=>`<button data-tab="${t}" class="${workspaceTab===t?'selected':''}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div><div id="workspace-content"></div>`;const el=$('#workspace-content');if(!stores.length){el.innerHTML='<div class="empty">Apply for a store in My account, or ask your store owner for staff access.</div>';return;}const storeOptions=stores.map(s=>`<option value="${s.id}">${esc(s.name)} (${s.status})</option>`).join('');if(workspaceTab==='catalog'){const ps=await api('/seller/products');el.innerHTML=`<div class="stats"><div class="stat">Your stores<strong>${stores.length}</strong></div><div class="stat">Listings<strong>${ps.length}</strong></div><div class="stat">Active offers<strong>${ps.filter(p=>p.status==='active'&&p.moderation==='approved').length}</strong></div></div><div class="grid2"><section class="panel"><h3>New listing</h3><form data-form="product"><label>Store<select name="store_id">${storeOptions}</select></label>${field('Product name','name')}${field('Seller SKU','sku')}<label>Category<select name="category"><option>Electronics</option><option>Fashion</option><option>Home</option></select></label>${field('Brand','brand','text','Independent')}${field('Price in rupees','price','number')}${field('MRP in rupees','mrp','number')}${field('Initial stock','stock','number')}${area('Description','description')}<button class="primary">Create draft</button></form></section><section class="panel"><h3>Catalog & availability</h3><p class="muted">New or changed descriptions and images require admin approval before activation.</p>${ps.map(p=>`<div class="order-item"><strong>${esc(p.name)}</strong><p>${money(p.price)} · <strong>${p.stock} units</strong> · ${p.stock===0?badge('Out of stock'):p.low_stock_threshold>0&&p.stock<=p.low_stock_threshold?badge('Low stock'):badge('In stock')} · ${badge(p.status)} ${badge(p.moderation)}</p><div class="row"><button data-edit-product="${p.id}">Edit details</button><button data-stock="${p.id}" data-version="${p.version}" data-current-stock="${p.stock}">Stock</button><button data-stock-history="${p.id}">Stock history</button><button data-list="${p.id}" data-version="${p.version}" data-status="${p.status==='active'?'paused':'active'}">${p.status==='active'?'Delist':'Activate'}</button><button data-archive="${p.id}" data-version="${p.version}">Archive</button><button data-image="${p.id}">Image</button></div></div>`).join('')}</section></div>`;}else if(workspaceTab==='inventory'){
const report=await api('/seller/inventory-summary');
el.innerHTML=`<div class="stats">
<div class="stat">Products<strong>${report.product_count}</strong></div>
<div class="stat">Total units<strong>${report.total_units}</strong></div>
<div class="stat">Low stock<strong>${report.low_stock_count}</strong></div>
<div class="stat">Out of stock<strong>${report.out_of_stock_count}</strong></div>
</div>
<section class="panel">
<h3>Inventory report</h3>
<p class="muted">Low-stock status follows each product's saved threshold. A threshold of zero disables low-stock warnings.</p>
<div class="table-wrap"><table>
<thead><tr><th>Product</th><th>Store</th><th>SKU</th><th>Stock</th><th>Alert threshold</th><th>Status</th><th>Actions</th></tr></thead>
<tbody>${report.products.map(p=>`<tr>
<td>${esc(p.name)}</td><td>${esc(p.store_name)}</td><td>${esc(p.sku)}</td>
<td>${p.stock}</td><td>${p.low_stock_threshold===0?'Off':p.low_stock_threshold}</td>
<td>${badge(p.inventory_status.replaceAll('_',' '))}</td>
<td><button data-stock="${p.id}" data-version="${p.version}" data-current-stock="${p.stock}">Adjust</button>
<button data-stock-history="${p.id}">History</button></td>
</tr>`).join('')}</tbody></table></div>
</section>`;
}else if(workspaceTab==='orders'){const items=await api('/seller/orders');el.innerHTML=itemTable(items,i=>`<button data-track="${i.id}">Track item</button> ${i.status==='confirmed'?`<button data-pack="${i.id}">Mark packed</button>`:''}`);}else if(workspaceTab==='returns'){el.innerHTML=returnCards(await api('/seller/returns'));}else if(workspaceTab==='finance'){el.innerHTML='';for(const s of stores){try{const f=await api('/seller/stores/'+s.id+'/finance');el.innerHTML+=`<section class="panel"><h3>${esc(s.name)}</h3><p>Illustrative net earned ${money(f.earned)} · Available ${money(f.available)}</p><button data-payout="${s.id}">Request demo payout</button><p class="demo">10% illustrative commission. No bank transfers. Refunds reverse the original earning entry.</p>${f.payouts.map(p=>`<p>${esc(p.id)} · ${money(p.amount)} · ${badge(p.status)}</p>`).join('')}</section>`;}catch(e){el.innerHTML+=`<p>${esc(s.name)}: ${esc(e.message)}</p>`;}}}else{el.innerHTML=stores.map(s=>`<section class="panel"><h3>${esc(s.name)}</h3><form data-form="staff" data-store="${s.id}">${field('Registered staff email','email','email')}<label>Permission<select name="permission"><option>catalog</option><option>fulfillment</option><option>finance</option><option>remove</option></select></label><button>Save membership</button></form></section>`).join('');}}
function itemTable(items,actions){return `<section class="panel"><div class="table-wrap"><table><thead><tr><th>Order item</th><th>Product</th><th>State</th><th>Action</th></tr></thead><tbody>${items.map(i=>`<tr><td>${esc(i.id)}<br><small>${esc(i.order_id||i.store_id||'')}</small></td><td>${esc(i.name)}${i.quantity?' × '+i.quantity:''}</td><td>${badge(i.status)}</td><td>${actions(i)}</td></tr>`).join('')}</tbody></table></div>${items.length?'':'<p>No tasks yet.</p>'}</section>`;}
function returnCards(rs){return rs.map(r=>`<section class="panel"><h3>${esc(r.name)}</h3><p>${esc(r.reason)} · ${badge(r.status)}</p><div class="row"><button data-track="${r.item_id}">Track item</button></div>${r.status==='requested'?`<button data-receive="${r.id}">Confirm physical return received</button>`:''}${r.status==='received'?`<button data-refund="${r.id}">Inspect & record demo refund</button>`:''}</section>`).join('')||'<div class="empty">No return requests.</div>';}
function deliveryExceptionCards(items) {
  return items.map(item => {
    const timestamp = Number(item.last_attempt_at);
    const lastAttempt = Number.isFinite(timestamp) && timestamp > 0
      ? new Date(timestamp * 1000).toLocaleString()
      : 'Unknown';

    return `<div class="order-item">
      <div class="row between">
        <strong>${esc(item.name)}${item.quantity ? ' × ' + esc(item.quantity) : ''}</strong>
        ${badge(item.status)}
      </div>
      <p>Item ${esc(item.item_id)} · Order ${esc(item.order_id)}</p>
      <p><strong>Latest failure reason:</strong> ${esc(item.latest_reason)}</p>
      <p><strong>Attempts:</strong> ${esc(item.attempt_count)}
        · <strong>Courier:</strong> ${esc(item.courier_name || item.courier_id || 'Unassigned')}</p>
      <p><strong>Last attempt:</strong> ${esc(lastAttempt)}
        · <strong>Recorded by:</strong> ${esc(item.last_attempt_by || 'Unknown')}</p>
      ${item.address ? `<p><strong>Delivery address:</strong> ${esc(item.address)}</p>` : ''}
      <p>${item.needs_action ? badge('Action needed') : badge('No action required')}</p>
      <div class="row">
        <button data-track="${esc(item.item_id)}">Track item</button>
        ${item.needs_action ? `<button data-assign="${esc(item.item_id)}">Reassign delivery</button>` : ''}
      </div>
    </div>`;
  }).join('') || '<div class="empty">No delivery exceptions recorded.</div>';
}

async function refreshDeliveryExceptions() {
  const container = $('#delivery-exceptions-list');
  if (!container) return;

  container.innerHTML = '<p>Loading delivery exceptions...</p>';

  try {
    const items = await api('/admin/delivery-exceptions');
    container.innerHTML = deliveryExceptionCards(items);
  } catch (error) {
    container.innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}


let deliveryOperationsData = null;

function deliveryOperationsRows(items, filter = 'all') {
  const filtered = items.filter(item => {
    if (filter === 'repeat_failure') return item.repeat_failure;
    if (filter === 'unassigned') {
      return item.status === 'packed' && !item.courier_id;
    }
    return filter === 'all' || item.ageing_bucket === filter;
  });

  if (!filtered.length) {
    return '<div class="empty">No pending delivery items match this filter.</div>';
  }

  return filtered.map(item => {
    const stageDate = new Date(Number(item.stage_since) * 1000).toLocaleString();
    const ageLabel = item.ageing_bucket === 'critical_48h'
      ? badge('Critical · 48h+')
      : item.ageing_bucket === 'watch_24h'
        ? badge('Watch · 24h+')
        : badge('Under 24h');

    return `<div class="order-item">
      <div class="row between">
        <strong>${esc(item.name)}${item.quantity ? ' × ' + esc(item.quantity) : ''}</strong>
        ${badge(item.status)}
      </div>
      <p>Item ${esc(item.item_id)} · Order ${esc(item.order_id)}</p>
      <p><strong>Current stage:</strong> ${esc(item.stage_label)}
        · <strong>Stage age:</strong> ${esc(item.age_hours)} hours</p>
      <p>${ageLabel} ${item.repeat_failure ? badge('Repeat failures · ' + item.attempt_count) : ''}
      </p>
      <p><strong>Stage started:</strong> ${esc(stageDate)}</p>
      <p><strong>Courier:</strong> ${esc(item.courier_name || item.courier_id || 'Unassigned')}</p>
      ${item.attempt_count
        ? `<p><strong>Failed attempts:</strong> ${esc(item.attempt_count)}
          · <strong>Latest reason:</strong> ${esc(item.latest_reason || 'Not recorded')}</p>`
        : '<p>No failed delivery attempts recorded.</p>'}
      <div class="row">
        <button data-track="${esc(item.item_id)}">Track item</button>
        <button data-assign="${esc(item.item_id)}">Assign / reassign delivery</button>
      </div>
    </div>`;
  }).join('');
}

function renderDeliveryOperations(data, filter = 'all') {
  deliveryOperationsData = data;
  const summary = data.summary;

  const average = summary.avg_out_for_delivery_hours_7d === null
    ? '—'
    : `${esc(summary.avg_out_for_delivery_hours_7d)} h`;

  $('#delivery-operations-summary').innerHTML = `
    <div class="stats">
      <div class="stat">Packed · awaiting pickup<strong>${esc(summary.packed_pending)}</strong></div>
      <div class="stat">Out for delivery<strong>${esc(summary.out_for_delivery)}</strong></div>
      <div class="stat">24h+ ageing<strong>${esc(summary.overdue_24h)}</strong></div>
      <div class="stat">48h+ critical<strong>${esc(summary.critical_48h)}</strong></div>
      <div class="stat">Repeat failures<strong>${esc(summary.repeat_failure_items)}</strong></div>
      <div class="stat">Unassigned packed<strong>${esc(summary.unassigned_packed)}</strong></div>
      <div class="stat">Delivered · last 7 days<strong>${esc(summary.delivered_last_7d)}</strong></div>
      <div class="stat">Average delivery duration · last 7 days<strong>${average}</strong></div>
    </div>`;

  $('#delivery-operations-list').innerHTML = `
    <p class="muted">Showing ${deliveryOperationsRows(data.items, filter).includes('No pending delivery items')
      ? 0
      : data.items.filter(item => {
          if (filter === 'repeat_failure') return item.repeat_failure;
          if (filter === 'unassigned') return item.status === 'packed' && !item.courier_id;
          return filter === 'all' || item.ageing_bucket === filter;
        }).length} pending items</p>
    ${deliveryOperationsRows(data.items, filter)}`;
}

async function refreshDeliveryOperations() {
  const summary = $('#delivery-operations-summary');
  const list = $('#delivery-operations-list');
  if (!summary || !list) return;

  summary.innerHTML = '<p>Loading delivery metrics...</p>';
  list.innerHTML = '<p>Loading pending delivery items...</p>';

  try {
    const data = await api('/admin/delivery-operations');
    const filter = $('#delivery-age-filter')?.value || 'all';
    renderDeliveryOperations(data, filter);
  } catch (error) {
    summary.innerHTML = '';
    list.innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}


function analyticsDateRange() {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 29 * 86400000)
    .toISOString().slice(0, 10);
  return { from: start, to: today };
}

function analyticsQuery() {
  const from = $('#delivery-analytics-from')?.value || '';
  const to = $('#delivery-analytics-to')?.value || '';

  if (!from || !to) throw Error('Select both report dates.');
  if (from > to) throw Error('Start date must not be after end date.');

  const days = (Date.parse(to + 'T00:00:00Z') -
    Date.parse(from + 'T00:00:00Z')) / 86400000;

  if (days > 365) throw Error('Date range cannot exceed 366 days.');

  return new URLSearchParams({ from, to }).toString();
}

function renderDeliveryAnalytics(data) {
  const summary = data.summary;
  const summaryNode = $('#delivery-analytics-summary');
  const couriersNode = $('#delivery-analytics-couriers');
  const trendsNode = $('#delivery-analytics-trends');
  const reasonsNode = $('#delivery-analytics-reasons');

  if (!summaryNode || !couriersNode || !trendsNode || !reasonsNode) return;

  summaryNode.innerHTML = `
    <div class="stats">
      <div class="stat">Couriers<strong>${esc(summary.couriers)}</strong></div>
      <div class="stat">Assigned deliveries<strong>${esc(summary.assigned)}</strong></div>
      <div class="stat">Successful deliveries<strong>${esc(summary.successful)}</strong></div>
      <div class="stat">Failed attempts<strong>${esc(summary.failed_attempts)}</strong></div>
      <div class="stat">Currently pending<strong>${esc(summary.pending)}</strong></div>
      <div class="stat">Repeat-failure items<strong>${esc(summary.repeat_failure_items)}</strong></div>
      <div class="stat">Success rate<strong>${esc(summary.success_percent)}%</strong></div>
      <div class="stat">Failure rate<strong>${esc(summary.failure_percent)}%</strong></div>
    </div>
    <p class="muted">Report period: ${esc(data.from)} to ${esc(data.to)}</p>`;

  couriersNode.innerHTML = data.couriers.length ? `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Courier</th><th>Status</th><th>Assigned</th>
          <th>Successful</th><th>Failed</th><th>Currently pending</th>
          <th>Repeat failures</th><th>Success</th><th>Failure</th>
          <th>Avg. completion (min)</th>
        </tr></thead>
        <tbody>${data.couriers.map(c => `
          <tr>
            <td><strong>${esc(c.courier_name)}</strong><small class="analytics-email">${esc(c.email)}</small></td>
            <td>${badge(c.status)}</td>
            <td>${esc(c.assigned)}</td>
            <td>${esc(c.successful)}</td>
            <td>${esc(c.failed_attempts)}</td>
            <td>${esc(c.pending)}</td>
            <td>${esc(c.repeat_failure_items)}</td>
            <td>${esc(c.success_percent)}%</td>
            <td>${esc(c.failure_percent)}%</td>
            <td>${c.avg_completion_minutes === null ? '—' : esc(c.avg_completion_minutes)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '<div class="empty">No courier records found.</div>';

  const maxFailures = Math.max(
    1, ...data.daily_failures.map(day => Number(day.failed_attempts))
  );

  trendsNode.innerHTML = data.daily_failures.length ? `
    <div class="analytics-chart" role="img" aria-label="Daily failed delivery attempts">
      ${data.daily_failures.map(day => {
        const count = Number(day.failed_attempts);
        const width = count ? Math.max(2, count / maxFailures * 100) : 0;
        return `<div class="analytics-bar-row">
          <span>${esc(day.date)}</span>
          <div class="analytics-bar-track">
            <div class="analytics-bar" style="width:${width}%"></div>
          </div>
          <strong>${esc(count)}</strong>
        </div>`;
      }).join('')}
    </div>` : '<div class="empty">No daily failure data.</div>';

  reasonsNode.innerHTML = data.failure_reasons.length
    ? `<ul class="analytics-reasons">${data.failure_reasons.map(reason =>
        `<li><span>${esc(reason.reason)}</span><strong>${esc(reason.count)}</strong></li>`
      ).join('')}</ul>`
    : '<div class="empty">No delivery failures in this period.</div>';
}

async function refreshDeliveryAnalytics() {
  const summary = $('#delivery-analytics-summary');
  const couriers = $('#delivery-analytics-couriers');
  if (!summary || !couriers) return;

  try {
    const query = analyticsQuery();
    summary.innerHTML = '<p>Loading delivery analytics...</p>';
    couriers.innerHTML = '<p>Loading courier comparison...</p>';

    const data = await api('/admin/delivery-analytics?' + query);
    renderDeliveryAnalytics(data);
  } catch (error) {
    summary.innerHTML = `<p class="error">${esc(error.message)}</p>`;
    couriers.innerHTML = '';
    $('#delivery-analytics-trends').innerHTML = '';
    $('#delivery-analytics-reasons').innerHTML = '';
  }
}


function renderDeliveryIntelligence(data) {
  const comparisonNode = $('#delivery-intelligence-comparison');
  const reasonsNode = $('#delivery-intelligence-reasons');
  const risksNode = $('#delivery-intelligence-risks');
  const metaNode = $('#delivery-intelligence-meta');

  if (!comparisonNode || !reasonsNode || !risksNode || !metaNode) return;

  const comparison = data.comparison;
  const current = comparison.current;
  const previous = comparison.previous;
  const change = comparison.change;
  const signed = value => `${Number(value) > 0 ? '+' : ''}${esc(value)}`;
  const rateChange = Number(change.failure_percentage_points);

  metaNode.textContent =
    `Current: ${data.period.from} to ${data.period.to} · ` +
    `Previous: ${data.previous_period.from} to ${data.previous_period.to} · ` +
    `${data.period.days} day(s) per period`;

  comparisonNode.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Metric</th><th>Previous period</th>
          <th>Current period</th><th>Change</th>
        </tr></thead>
        <tbody>
          <tr>
            <td>Successful deliveries</td>
            <td>${esc(previous.successful)}</td>
            <td>${esc(current.successful)}</td>
            <td>${signed(change.successful)}</td>
          </tr>
          <tr>
            <td>Failed attempts</td>
            <td>${esc(previous.failed_attempts)}</td>
            <td>${esc(current.failed_attempts)}</td>
            <td>${signed(change.failed_attempts)}</td>
          </tr>
          <tr>
            <td>Failure rate</td>
            <td>${esc(previous.failure_percent)}%</td>
            <td>${esc(current.failure_percent)}%</td>
            <td>${rateChange > 0 ? '+' : ''}${esc(rateChange)} percentage points</td>
          </tr>
        </tbody>
      </table>
    </div>
    ${comparison.previous_period_has_attempts
      ? '<p class="muted">Both periods contain delivery attempts. Rate change is shown in percentage points.</p>'
      : '<p class="muted">The previous period has no recorded delivery attempts; its failure rate is shown as 0% and rate comparison should be interpreted cautiously.</p>'}`;

  reasonsNode.innerHTML = data.failure_reasons.length ? `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Failure reason</th><th>Previous count</th>
          <th>Current count</th><th>Previous share</th>
          <th>Current share</th><th>Share change</th>
        </tr></thead>
        <tbody>${data.failure_reasons.map(reason => {
          const delta = Number(reason.share_change_percentage_points);
          return `<tr>
            <td>${esc(reason.reason)}</td>
            <td>${esc(reason.previous_count)}</td>
            <td>${esc(reason.current_count)}</td>
            <td>${esc(reason.previous_share_percent)}%</td>
            <td>${esc(reason.current_share_percent)}%</td>
            <td>${delta > 0 ? '+' : ''}${esc(delta)} pp</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>` : '<div class="empty">No failure reasons recorded in either period.</div>';

  const live = data.live_risk;
  const liveSummary = live.summary;
  const courierRows = live.couriers;

  risksNode.innerHTML = `
    <div class="stats">
      <div class="stat">Over 24 hours<strong>${esc(liveSummary.overdue_24h)}</strong></div>
      <div class="stat">Critical over 48 hours<strong>${esc(liveSummary.critical_48h)}</strong></div>
      <div class="stat">Repeat-failure items<strong>${esc(liveSummary.repeat_failure_items)}</strong></div>
      <div class="stat">Unassigned packed<strong>${esc(liveSummary.unassigned_packed)}</strong></div>
    </div>
    ${courierRows.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Courier</th><th>Pending</th><th>24–48h watch</th>
            <th>48h+ critical</th><th>Repeat failures</th>
            <th>Unassigned packed</th>
          </tr></thead>
          <tbody>${courierRows.map(courier => `
            <tr>
              <td>${esc(courier.courier_name)}</td>
              <td>${esc(courier.pending_items)}</td>
              <td>${esc(courier.watch_24h)}</td>
              <td>${esc(courier.critical_48h)}</td>
              <td>${esc(courier.repeat_failure_items)}</td>
              <td>${esc(courier.unassigned_packed)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<div class="empty">No current pending courier risks.</div>'}
    <p class="muted">Live operational snapshot · Warning: ${esc(live.thresholds.warning_hours)}h · Critical: ${esc(live.thresholds.critical_hours)}h · Updated: ${esc(new Date(live.generated_at * 1000).toLocaleString())}</p>`;
}

async function refreshDeliveryIntelligence() {
  const comparison = $('#delivery-intelligence-comparison');
  const reasons = $('#delivery-intelligence-reasons');
  const risks = $('#delivery-intelligence-risks');
  const meta = $('#delivery-intelligence-meta');
  if (!comparison || !reasons || !risks || !meta) return;

  try {
    const query = analyticsQuery();
    comparison.innerHTML = '<p>Loading period comparison...</p>';
    reasons.innerHTML = '<p>Loading failure reason trends...</p>';
    risks.innerHTML = '<p>Loading live courier risk...</p>';

    const data = await api('/admin/delivery-intelligence?' + query);
    renderDeliveryIntelligence(data);
  } catch (error) {
    comparison.innerHTML = `<p class="error">${esc(error.message)}</p>`;
    reasons.innerHTML = '';
    risks.innerHTML = '';
    meta.textContent = '';
  }
}

async function refreshDeliveryReports() {
  await Promise.all([
    refreshDeliveryAnalytics(),
    refreshDeliveryIntelligence(),
  ]);
}

async function exportDeliveryAnalyticsCsv() {
  try {
    const query = analyticsQuery();
    const response = await fetch(
      '/api/admin/delivery-analytics.csv?' + query,
      { headers: token ? { Authorization: 'Bearer ' + token } : {} }
    );

    if (!response.ok) {
      let message = 'CSV export failed.';
      try {
        const body = await response.json();
        message = body.error || message;
      } catch {}
      throw Error(message);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `delivery-analytics-${$('#delivery-analytics-from').value}-to-${$('#delivery-analytics-to').value}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('Delivery analytics CSV exported.');
  } catch (error) {
    toast(error.message);
  }
}

async function admin() {
  const d = await api('/admin/overview');

  $('#main').innerHTML = `
    <span class="eyebrow">7BY11 OPERATIONS</span>
    <h1>Marketplace control.</h1>

    <div class="stats">
      <div class="stat">Stores<strong>${d.stores}</strong></div>
      <div class="stat">Orders<strong>${d.orders}</strong></div>
      <div class="stat">Ordered value before refunds<strong>${money(d.ordered_value)}</strong></div>
    </div>

    <section class="panel">
      <div class="row between">
        <h3>Delivery exceptions</h3>
        <button id="refresh-exceptions" type="button">Refresh</button>
      </div>
      <div id="delivery-exceptions-list">
        <p>Loading delivery exceptions...</p>
      </div>
    </section>

    <section class="panel" id="delivery-operations-panel">
      <div class="row between">
        <h3>Delivery operations & SLA monitor</h3>
        <button id="refresh-delivery-operations" type="button">Refresh metrics</button>
      </div>
      <p class="demo">Operational ageing indicators: 24-hour watch and 48-hour critical. These are internal monitoring targets, not carrier or contractual SLAs. Completion metrics use the last seven days.</p>
      <div id="delivery-operations-summary">
        <p>Loading delivery metrics...</p>
      </div>
      <div class="row">
        <label>Filter pending items
          <select id="delivery-age-filter">
            <option value="all">All pending items</option>
            <option value="critical_48h">Critical · 48h+</option>
            <option value="watch_24h">Watch · 24h+</option>
            <option value="on_track">Under 24h</option>
            <option value="repeat_failure">Repeat failures</option>
            <option value="unassigned">Unassigned packed</option>
          </select>
        </label>
      </div>
      <div id="delivery-operations-list">
        <p>Loading pending delivery items...</p>
      </div>
    </section>

    <section class="panel" id="delivery-analytics-panel">
      <div class="row between">
        <div>
          <h3>Advanced delivery analytics</h3>
          <p class="demo">Courier performance, delivery outcomes and failure trends for the selected UTC date range.</p>
        </div>
        <div class="row">
          <button id="refresh-delivery-analytics" type="button">Refresh analytics</button>
          <button id="export-delivery-analytics" type="button">Export CSV</button>
        </div>
      </div>

      <div class="row analytics-filters">
        <label>From
          <input id="delivery-analytics-from" type="date" required>
        </label>
        <label>To
          <input id="delivery-analytics-to" type="date" required>
        </label>
      </div>

      <div id="delivery-analytics-summary">
        <p>Loading delivery analytics...</p>
      </div>

      <h4>Courier performance comparison</h4>
      <div id="delivery-analytics-couriers">
        <p>Loading courier comparison...</p>
      </div>

      <h4>Daily delivery failures</h4>
      <div id="delivery-analytics-trends">
        <p>Loading failure trends...</p>
      </div>

      <h4>Common failure reasons</h4>
      <div id="delivery-analytics-reasons">
        <p>Loading failure reasons...</p>
      </div>

      <div class="delivery-intelligence">
        <h3>Delivery intelligence</h3>
        <p class="demo">Historical comparisons use equal-length UTC periods. Courier risk is a live snapshot, not historical data.</p>
        <p id="delivery-intelligence-meta" class="muted">Loading reporting periods...</p>

        <h4>Period-over-period comparison</h4>
        <div id="delivery-intelligence-comparison">
          <p>Loading period comparison...</p>
        </div>

        <h4>Failure reason trends</h4>
        <div id="delivery-intelligence-reasons">
          <p>Loading failure reason trends...</p>
        </div>

        <h4>Live courier risk</h4>
        <div id="delivery-intelligence-risks">
          <p>Loading live courier risk...</p>
        </div>
      </div>
    </section>

    <section class="panel">
      <h3>Store approvals & access</h3>
      ${d.stores_list.map(s => `
        <div class="order-item row between">
          <span><strong>${esc(s.name)}</strong> ${badge(s.status)}</span>
          <button data-store-moderate="${s.id}">Review store</button>
        </div>`).join('')}
    </section>

    <section class="panel">
      <h3>Product moderation</h3>
      ${d.products.map(p => `
        <div class="order-item row between">
          <span>${esc(p.name)} ${badge(p.moderation)}</span>
          <button data-moderate="${p.id}">Review listing</button>
        </div>`).join('')}
    </section>

    <h3>Fulfillment & delivery assignment</h3>
    ${itemTable(d.items, i => `
      <button data-track="${i.id}">Track item</button>
      ${['packed', 'out_for_delivery'].includes(i.status)
        ? `<button data-assign="${i.id}">Assign delivery</button>`
        : ''}`)}

    <div class="grid2">
      <section class="panel">
        <h3>Customer reviews</h3>
        ${d.reviews.map(r => `
          <p>${r.rating}/5 · ${esc(r.body)} ${badge(r.status)}
            <button data-review-moderate="${r.id}">Moderate</button>
          </p>`).join('') || '<p>No reviews.</p>'}
      </section>

      <section class="panel">
        <h3>Create coupon</h3>
        <form data-form="coupon">
          ${field('Code', 'code')}
          ${field('Discount percent', 'percent', 'number')}
          ${field('Maximum discount rupees', 'max_discount', 'number')}
          ${field('Minimum order rupees', 'minimum', 'number', '0')}
          ${field('Maximum redemptions', 'max_uses', 'number', '100')}
          ${field('Valid days', 'days', 'number', '30')}
          <button>Create coupon</button>
        </form>
      </section>
    </div>

    <section class="panel">
      <h3>User access</h3>
      ${d.users_list.filter(u => u.role !== 'admin').map(u => `
        <div class="row between">
          <p>${esc(u.email)} · ID ${esc(u.id)} · ${esc(u.role)} ${badge(u.status)}</p>
          <button data-user-status="${u.id}"
            data-status="${u.status === 'active' ? 'suspended' : 'active'}">
            ${u.status === 'active' ? 'Suspend' : 'Restore'}
          </button>
        </div>`).join('')}
    </section>

    <section class="panel">
      <h3>Payout approvals</h3>
      <button id="finance-link">Open finance queue</button>
    </section>

    <section class="panel">
      <h3>Recent audit events</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Actor</th><th>Action</th><th>Entity</th></tr></thead>
          <tbody>${d.audit.map(a => `
            <tr>
              <td>${esc(a.actor)}</td>
              <td>${esc(a.action)}</td>
              <td>${esc(a.entity)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;

  $('#finance-link').onclick = () => finance().catch(e => toast(e.message));
  $('#refresh-exceptions').onclick = () => refreshDeliveryExceptions();
  $('#refresh-delivery-operations').onclick = () => refreshDeliveryOperations();
  const analyticsDates = analyticsDateRange();
  $('#delivery-analytics-from').value = analyticsDates.from;
  $('#delivery-analytics-to').value = analyticsDates.to;
  $('#refresh-delivery-analytics').onclick = () => refreshDeliveryReports();
  $('#export-delivery-analytics').onclick = () => exportDeliveryAnalyticsCsv();
  $('#delivery-age-filter').onchange = event => {
    if (deliveryOperationsData) {
      renderDeliveryOperations(deliveryOperationsData, event.target.value);
    }
  };

  await refreshDeliveryExceptions();
  await refreshDeliveryOperations();
  await refreshDeliveryReports();
}
async function delivery(){const ts=await api('/delivery/tasks');$('#main').innerHTML=`<span class="eyebrow">DELIVERY WORKSPACE</span><h1>Your route today.</h1>${ts.map(t=>`<section class="panel"><h3>${esc(t.name)} × ${t.quantity}</h3><p>${esc(t.address)}</p><p>${badge(t.status)} · ${t.payment==='cod_due'?'Collect cash '+money(t.total):'Demo prepaid'}</p>${t.status==='packed'?`<button class="primary" data-start="${t.id}">Confirm pickup & start delivery</button>`:`<button class="primary" data-complete="${t.id}" data-cod="${t.payment==='cod_due'}">Complete with customer code</button><button data-failed="${t.id}">Failed attempt</button>`}</section>`).join('')||'<div class="empty">No assigned delivery tasks.</div>'}`;}
async function warehouse(){const d=await api('/warehouse/tasks');$('#main').innerHTML='<h1>Warehouse operations</h1>'+itemTable(d.items,i=>`<button data-track="${i.id}">Track item</button> <button data-pack="${i.id}">Confirm packed</button>`)+returnCards(d.returns);}
async function finance(){const ps=await api('/finance/payouts');$('#main').innerHTML=`<h1>Finance approvals</h1><p class="demo">Illustrative ledger and payout workflow. No real bank transfers are made.</p>${ps.map(p=>`<section class="panel"><h3>${esc(p.store_name)} · ${money(p.amount)}</h3><p>${esc(p.id)} ${badge(p.status)}</p>${p.status==='pending'?`<button data-approve-payout="${p.id}" data-status="paid_demo">Approve demo payout</button><button data-approve-payout="${p.id}" data-status="rejected">Reject</button>`:''}</section>`).join('')||'<div class="empty">No payout requests.</div>'}`;}
function actionForm(title,fields,submit){modal(`<h2>${esc(title)}</h2><form id="action-form">${fields}<button class="primary">Save</button><p class="error"></p></form>`);$('#action-form').onsubmit=async e=>{e.preventDefault();const f=e.target;try{await submit(Object.fromEntries(new FormData(f)));close();toast('Saved');await go(view);}catch(err){formError(f,err);}};}
document.addEventListener('submit',async e=>{const f=e.target;if(!f.dataset.form)return;e.preventDefault();const b=Object.fromEntries(new FormData(f));try{switch(f.dataset.form){case'profile':await api('/me','PATCH',b);user.name=b.name;$('#account').textContent=user.name+' · Sign out';break;case'password':await api('/me/password','POST',b);token='';user=null;$('#account').textContent='Sign in';return go('shop');case'address':await api('/addresses','POST',b);break;case'store':await api('/seller/stores','POST',b);break;case'ticket':await api('/tickets','POST',b);break;case'product':b.price=Math.round(Number(b.price)*100);b.mrp=Math.round(Number(b.mrp)*100);b.stock=Number(b.stock);await api('/seller/products','POST',b);break;case'staff':await api('/seller/stores/'+f.dataset.store+'/members','POST',b);break;case'coupon':for(const k of ['percent','max_uses','days'])b[k]=Number(b[k]);for(const k of ['minimum','max_discount'])b[k]=Math.round(Number(b[k])*100);await api('/admin/coupons','POST',b);break;}toast('Saved');await go(view);}catch(err){formError(f,err);}});
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;try{if(d.view)return go(d.view);
if(d.store){
  if(document.querySelector("#modal").open)close();
  page=1;
  return openStore(d.store);
}
if(d.tab){
  workspaceTab=d.tab;
  return go('workspace');
}if(d.detail)return details(d.detail);if(d.add)return await add(d.add);if(d.save){if(!requireUser())return;await api('/wishlist','POST',{product_id:d.save,remove:d.remove==='true'});toast(d.remove==='true'?'Removed':'Saved');if(view==='wishlist')await go(view);return;}if(d.qty){await api('/cart','POST',{product_id:d.qty,quantity:Number(d.value)});checkoutIntent=null;await refreshBagCount();return bag();}if(d.track){return trackItem(d.track);}if(d.cancel){if(confirm('Cancel this item?'))await api('/items/'+d.cancel+'/cancel','POST',{});return go('orders');}if(d.code){const r=await api('/items/'+d.code+'/delivery-code','POST',{});modal(`<h2>Your delivery code</h2><p class="price">${esc(r.code)}</p><p>Valid for 10 minutes. Share it with the assigned partner when you receive your package.</p>`);return;}if(d.return)return actionForm('Request item return',area('Reason','reason'),x=>api('/items/'+d.return+'/return','POST',x));if(d.review)return actionForm('Review your purchase',field('Rating 1 to 5','rating','number')+area('Review','body'),x=>api('/products/'+d.review+'/reviews','POST',{...x,rating:Number(x.rating)}));if(d.invoice){const r=await api('/orders/'+d.invoice+'/invoice');modal(`<h2>7by11 purchase receipt</h2><p>${esc(r.type)}</p><p>${esc(r.order.id)}</p>${r.order.items.map(i=>`<p>${esc(i.name)} × ${i.quantity} · ${money(i.total)}</p>`).join('')}<strong>Total ${money(r.order.total)}</strong>`);return;}if(d.addressDelete){await api('/addresses/'+d.addressDelete,'DELETE');return go(view);}if(d.reply)return actionForm('Ticket response',area('Message','message')+(['admin','support'].includes(user.role)?'<label>Status<select name="status"><option>open</option><option>resolved</option></select></label>':''),x=>api('/tickets/'+d.reply,'POST',x));if(d.editProduct){
  const products=await api('/seller/products');
  const p=products.find(item=>item.id===d.editProduct);
  if(!p)throw Error('Product is no longer available.');

  const categoryOptions=['Electronics','Fashion','Home'].map(c=>
    `<option value="${c}" ${p.category===c?'selected':''}>${c}</option>`
  ).join('');

  return actionForm(
    'Edit product listing',
    field('Product name','name','text',p.name)+
    field('Seller SKU','sku','text',p.sku)+
    field('Brand','brand','text',p.brand)+
    `<label>Category<select name="category">${categoryOptions}</select></label>`+
    field('Price in rupees','price','number',p.price/100)+
    field('MRP in rupees','mrp','number',p.mrp/100)+
    area('Product description','description',p.description)+
    field('Low-stock alert threshold (0 disables)','low_stock_threshold','number',p.low_stock_threshold)+
    area('Product attributes (JSON)','attributes',JSON.stringify(p.attributes,null,2)),
    async x=>{
      let attributes;
      try {
        attributes=JSON.parse(x.attributes);
      } catch {
        throw Error('Product attributes must contain valid JSON.');
      }

      if(!attributes || typeof attributes!=='object' || Array.isArray(attributes)){
        throw Error('Product attributes must be a JSON object.');
      }

      return api('/seller/products/'+d.editProduct,'PATCH',{
        ...x,
        attributes,
        price:Math.round(Number(x.price)*100),
        mrp:Math.round(Number(x.mrp)*100),
        low_stock_threshold:Number(x.low_stock_threshold),
        version:p.version
      });
    }
  );
}if(d.stockHistory){
  const renderHistory=async filters=>{
    const params=new URLSearchParams();
    for(const key of ['type','reason','from','to']){
      if(filters[key])params.set(key,filters[key]);
    }

    const query=params.toString();
    const moves=await api(
      '/seller/products/'+encodeURIComponent(d.stockHistory)+'/stock-moves'+
      (query?'?'+query:'')
    );

    modal(`<h2>Stock movement history</h2>
      <form id="stock-history-filter" class="row">
        <label>Movement type
          <select name="type">
            <option value="" ${!filters.type?'selected':''}>All movements</option>
            <option value="added" ${filters.type==='added'?'selected':''}>Stock added</option>
            <option value="removed" ${filters.type==='removed'?'selected':''}>Stock removed</option>
          </select>
        </label>
        <label>Reason
          <input name="reason" maxlength="100" value="${esc(filters.reason||'')}" placeholder="Search reason">
        </label>
        <label>From
          <input type="date" name="from" value="${esc(filters.from||'')}">
        </label>
        <label>To
          <input type="date" name="to" value="${esc(filters.to||'')}">
        </label>
        <button class="primary">Apply filters</button>
      </form>
      ${moves.length?`<div class="table-wrap"><table>
        <thead><tr><th>Movement</th><th>Reason</th><th>Changed by</th><th>Date</th></tr></thead>
        <tbody>${moves.map(m=>`<tr>
          <td><strong>${m.delta>0?'+':''}${m.delta}</strong> units · ${m.delta>0?'Added':m.delta<0?'Removed':'No change'}</td>
          <td>${esc(m.reason)}</td><td>${esc(m.actor_name||'Unknown')}</td>
          <td>${new Date(m.created*1000).toLocaleString()}</td>
        </tr>`).join('')}</tbody>
      </table></div>`:'<p class="muted">No stock movements match these filters.</p>'}
      <p class="muted">Showing up to 100 matching movements.</p>`);

    $('#stock-history-filter').onsubmit=async event=>{
      event.preventDefault();
      const values=Object.fromEntries(new FormData(event.target));
      await renderHistory(values);
    };
  };

  await renderHistory({});
  return;
}if(d.stock)return actionForm('Adjust stock',field('Units to add or remove','delta','number')+field('Reason','reason'),x=>api('/seller/products/'+d.stock+'/stock','POST',{...x,delta:Number(x.delta),version:Number(d.version)}));if(d.list||d.archive){await api('/seller/products/'+(d.list||d.archive),'PATCH',{status:d.archive?'archived':d.status,version:Number(d.version)});return go(view);}if(d.image){modal('<h2>Upload product photo</h2><form id="image-form"><label>Image under 1.5 MB<input type="file" name="image" accept="image/png,image/jpeg,image/webp" required></label><button class="primary">Upload for review</button></form>');$('#image-form').onsubmit=async ev=>{ev.preventDefault();try{await api('/seller/products/'+d.image+'/image','POST',new FormData(ev.target));close();go(view);}catch(err){formError(ev.target,err);}};return;}if(d.pack){await api('/seller/items/'+d.pack+'/pack','POST',{});return go(view);}if(d.receive){await api('/returns/'+d.receive+'/resolve','POST',{action:'receive'});return go(view);}if(d.refund)return actionForm('Inspect return and refund','<label>Physical condition<select name="disposition"><option value="quarantine">Damaged or uncertain — quarantine</option><option value="restock">Inspected saleable — restore stock</option></select></label>',x=>api('/returns/'+d.refund+'/resolve','POST',{action:'refund',...x}));if(d.payout){await api('/seller/stores/'+d.payout+'/payouts','POST',{});return go(view);}if(d.moderate||d.storeModerate){const product=!!d.moderate;return actionForm(product?'Review listing':'Review store',`<label>Decision<select name="status">${(product?['approved','suppressed','rejected']:['active','suspended','rejected']).map(s=>`<option>${s}</option>`).join('')}</select></label>`+field('Reason','reason'),x=>api('/admin/'+(product?'products/':'stores/')+(d.moderate||d.storeModerate),'POST',x));}if(d.userStatus)return actionForm('Change account access',field('Reason','reason'),x=>api('/admin/users/'+d.userStatus,'POST',{...x,status:d.status}));if(d.reviewModerate)return actionForm('Moderate review','<label>Decision<select name="status"><option>approved</option><option>rejected</option></select></label>',x=>api('/admin/reviews/'+d.reviewModerate,'POST',x));if(d.assign)return actionForm('Assign delivery partner',field('Delivery user ID','courier_id','text','delivery'),x=>api('/admin/items/'+d.assign+'/assign','POST',x));if(d.start){await api('/delivery/tasks/'+d.start,'POST',{action:'start'});return go(view);}if(d.failed)return actionForm('Failed delivery attempt',field('Reason','reason'),x=>api('/delivery/tasks/'+d.failed,'POST',{...x,action:'attempt_failed'}));if(d.complete)return actionForm('Confirm delivery',field('Customer delivery code','code')+(d.cod==='true'?'<label>Cash collected<select name="cash"><option value="no">Not collected</option><option value="yes">Exact amount collected</option></select></label>':''),x=>api('/delivery/tasks/'+d.complete,'POST',{action:'complete',code:x.code,cod_collected:x.cash==='yes'}));if(d.approvePayout){await api('/finance/payouts/'+d.approvePayout,'POST',{status:d.status});return finance();}}catch(err){toast(err.message);}});
$('#search').onsubmit=e=>{e.preventDefault();query=new FormData(e.target).get('q');page=1;go('shop');};$('#close-modal').onclick=close;$('#account').onclick=async()=>{if(!user)return login();try{await api('/logout','POST',{});}catch{}token='';user=null;checkoutIntent=null;$('#account').textContent='Sign in';$('#bag-count').textContent='0';go('shop');};$('#bag').onclick=()=>bag().catch(e=>toast(e.message));go('shop');
