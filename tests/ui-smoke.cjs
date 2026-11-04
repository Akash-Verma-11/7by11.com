const {JSDOM,VirtualConsole}=require('jsdom');
const {spawn}=require('child_process');
const path=require('path');
const root=path.resolve(__dirname,'..'), base='http://localhost:3199';
const fs=require('fs'),os=require('os');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sevenbyeleven-ui-'));
const server=spawn(process.env.PYTHON || 'python3',['run.py'],{cwd:root,env:{...process.env,DATABASE_URL:'',SEED_DEMO:'true',DEMO_PASSWORD:'7by11Demo!2026',PORT:'3199',SQLITE_PATH:path.join(temp,'ui.db')},stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(fn())return;await delay(100);}throw Error('Timeout '+label);}
(async()=>{let dom;try{
 for(let i=0;i<80;i++){try{await fetch(base+'/ready');break;}catch{await delay(100);}}
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 dom=await JSDOM.fromURL(base,{resources:'usable',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.fetch=(url,opts)=>fetch(new URL(url,base),opts);w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};w.crypto.randomUUID=require('crypto').randomUUID;}});
 const w=dom.window,d=w.document;
 await until(()=>d.querySelectorAll('.product').length===6,'catalog');

 // Public storefront: Everyday Studio (store-1)
 const firstStore = d.querySelector('.store-link[data-store="store-1"]');
 if(!firstStore)throw Error('Missing Everyday Studio storefront link');
 firstStore.click();

 await until(
  ()=>d.querySelector('.storefront-header h1')?.textContent==='Everyday Studio'
      && d.querySelectorAll('.product').length===4,
  'Everyday Studio storefront'
 );

 const firstNames=[...d.querySelectorAll('.product h3 button')].map(x=>x.textContent);
 if(!firstNames.includes('Studio Wireless Headphones') ||
    firstNames.includes('Minimal Ceramic Mug'))
  throw Error('Everyday Studio product isolation failed');

 console.log('PASS storefront: Everyday Studio — 4 products');

 d.querySelector('.storefront-header [data-view="shop"]').click();
 await until(()=>d.querySelectorAll('.product').length===6,'return to marketplace');

 // Public storefront: Home Collective (store-2)
 const secondStore = d.querySelector('.store-link[data-store="store-2"]');
 if(!secondStore)throw Error('Missing Home Collective storefront link');
 secondStore.click();

 await until(
  ()=>d.querySelector('.storefront-header h1')?.textContent==='Home Collective'
      && d.querySelectorAll('.product').length===2,
  'Home Collective storefront'
 );

 const secondNames=[...d.querySelectorAll('.product h3 button')].map(x=>x.textContent);
 if(!secondNames.includes('Minimal Ceramic Mug') ||
    secondNames.includes('Studio Wireless Headphones'))
  throw Error('Home Collective product isolation failed');

 console.log('PASS storefront: Home Collective — 2 products');

 d.querySelector('.storefront-header [data-view="shop"]').click();
 await until(()=>d.querySelectorAll('.product').length===6,'final marketplace return');

 let uiTrackedItemId = '';

 for(const role of ['customer','warehouse','seller','seller2','admin','delivery','support','finance']){
  d.querySelector('#account').click();
  d.querySelector('[name=email]').value=role+'@example.com';d.querySelector('[name=password]').value='7by11Demo!2026';
  d.querySelector('#login-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>d.querySelector('#account').textContent.includes('Sign out'),'login '+role);
  await delay(200);
  if(role==='customer'){
   // Seller storefront navigation from product cards.
   const storeOneLink=d.querySelector('[data-store="store-1"]');
   if(!storeOneLink)throw Error('Missing Everyday Studio store link');
   storeOneLink.click();

   await until(
    ()=>d.querySelector('.storefront-header')?.textContent.includes('Everyday Studio')
      && d.querySelectorAll('.product').length===4,
    'Everyday Studio storefront'
   );

   if([...d.querySelectorAll('.product')].some(
    p=>!p.querySelector('[data-store="store-1"]')
   ))throw Error('Everyday Studio storefront contains another seller product');

   d.querySelector('.storefront-header [data-view="shop"]').click();
   await until(()=>d.querySelectorAll('.product').length===6,'marketplace return');

   // Second seller storefront.
   const storeTwoLink=d.querySelector('[data-store="store-2"]');
   if(!storeTwoLink)throw Error('Missing Home Collective store link');
   storeTwoLink.click();

   await until(
    ()=>d.querySelector('.storefront-header')?.textContent.includes('Home Collective')
      && d.querySelectorAll('.product').length===2,
    'Home Collective storefront'
   );

   if([...d.querySelectorAll('.product')].some(
    p=>!p.querySelector('[data-store="store-2"]')
   ))throw Error('Home Collective storefront contains another seller product');

   d.querySelector('.storefront-header [data-view="shop"]').click();
   await until(()=>d.querySelectorAll('.product').length===6,'marketplace return');

   // Seller link from individual product details.
   d.querySelector('[data-detail="p1"]').click();
   await until(
    ()=>d.querySelector('#modal').open
      && d.querySelector('#modal [data-store="store-1"]'),
    'product detail seller link'
   );
   d.querySelector('#modal [data-store="store-1"]').click();

   await until(
    ()=>d.querySelector('.storefront-header')?.textContent.includes('Everyday Studio')
      && d.querySelectorAll('.product').length===4,
    'storefront from product details'
   );

   d.querySelector('.storefront-header [data-view="shop"]').click();
   await until(()=>d.querySelectorAll('.product').length===6,'marketplace return');

   // Existing customer checkout regression.
   d.querySelector('[data-add]').click();await until(()=>d.querySelector('#bag-count').textContent==='1','bag increment');
   d.querySelector('#bag').click();await until(()=>d.querySelector('#checkout-form'),'checkout form');
   d.querySelector('[name=address]').value='Demo address 12 Fictional Road Delhi';
   d.querySelector('#checkout-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
   await until(()=>d.querySelector('.order'),'placed order');

   const customerTrack = d.querySelector('.order [data-track]');
   if(!customerTrack)throw Error('Customer order tracking button missing');
   uiTrackedItemId = customerTrack.dataset.track;
   customerTrack.click();

   await until(
    ()=>d.querySelector('#modal').open
      && d.querySelector('#modal').textContent.includes('Order confirmed')
      && d.querySelector('#modal').textContent.includes('Updated by'),
    'customer order tracking timeline'
   );

   const customerTimeline = d.querySelector('#modal').textContent;
   if(!customerTimeline.includes('Current status')
      || !customerTimeline.includes('confirmed'))
    throw Error('Customer tracking timeline status is missing');

   console.log('PASS customer tracking: order confirmation timeline');

   d.querySelector('#close-modal').click();
   await until(()=>!d.querySelector('#modal').open,'close customer tracking modal');

  }
  if(role==='seller'){
   const edit=d.querySelector('[data-edit-product="p1"]');
   if(!edit)throw Error('Seller product edit button missing');

   edit.click();
   await until(()=>d.querySelector('#action-form'),'complete product editor');

   const form=d.querySelector('#action-form');
   const fields=['name','sku','brand','category','price','mrp','description','attributes','low_stock_threshold'];

   for(const name of fields){
    if(!form.querySelector(`[name="${name}"]`))
     throw Error('Missing product editor field: '+name);
   }

   form.querySelector('[name=name]').value='Studio Editor Test Headphones';
   form.querySelector('[name=sku]').value='P1-UI-EDIT';
   form.querySelector('[name=brand]').value='Studio Audio';
   form.querySelector('[name=category]').value='Electronics';
   form.querySelector('[name=description]').value='Updated through seller editor UI testing.';
   form.querySelector('[name=low_stock_threshold]').value='40';
   form.querySelector('[name=attributes]').value=JSON.stringify({
    color:'Graphite',
    warranty:'2 years',
    connection:'Bluetooth'
   });

   form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));

   await until(
    ()=>d.querySelector('#workspace-content')?.textContent.includes('Studio Editor Test Headphones'),
    'saved seller product changes'
   );

   console.log('PASS seller product editor: all listing fields and threshold saved');

   const inventoryRow=d.querySelector('[data-stock="p1"]')?.closest('.order-item');
   if(!inventoryRow?.textContent.includes('Low stock'))
    throw Error('Configured low-stock threshold was not reflected in seller catalog');

   console.log('PASS seller inventory: configurable threshold controls low-stock badge');

   // Inventory status and stock movement history.
   const stockButton=d.querySelector('[data-stock="p1"]');
   const historyButton=d.querySelector('[data-stock-history="p1"]');

   if(!stockButton || !historyButton)
    throw Error('Seller inventory controls missing');

   const currentStock=Number(stockButton.dataset.currentStock);

   if(!Number.isInteger(currentStock) || currentStock<0)
    throw Error('Invalid current stock value: '+stockButton.dataset.currentStock);

   const adjustment=5-currentStock;

   stockButton.click();
   await until(()=>d.querySelector('#action-form'),'stock adjustment form');

   const stockForm=d.querySelector('#action-form');
   stockForm.querySelector('[name=delta]').value=String(adjustment);
   stockForm.querySelector('[name=reason]').value='UI inventory test adjustment';

   stockForm.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));

   await until(
    ()=>Number(d.querySelector('[data-stock="p1"]')?.dataset.currentStock)===5
      && d.querySelector('#workspace-content')?.textContent.includes('Low stock'),
    'stock adjustment saved and low stock indicator'
   );

   console.log('PASS seller inventory: low stock indicator at 5 units');

   const history=d.querySelector('[data-stock-history="p1"]');
   history.click();

   await until(
    ()=>d.querySelector('#modal').open
      && d.querySelector('#modal').textContent.includes('Stock movement history')
      && d.querySelector('#modal').textContent.includes('UI inventory test adjustment'),
    'stock movement history response and adjustment reason'
   );

   const historyText=d.querySelector('#modal').textContent;

   if(!historyText.includes('UI inventory test adjustment'))
    throw Error('Stock history reason was not displayed');

   if(!historyText.includes('Everyday Studio'))
    throw Error('Stock history actor was not displayed');

   console.log('PASS seller inventory: stock history shows reason and actor');

   const historyFilter=d.querySelector('#stock-history-filter');
   if(!historyFilter)throw Error('Stock history filters missing');

   historyFilter.querySelector('[name=type]').value='removed';
   historyFilter.querySelector('[name=reason]').value='UI inventory test adjustment';

   const previousFilter=historyFilter;
   historyFilter.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));

   await until(
    ()=>d.querySelector('#stock-history-filter')
      && d.querySelector('#stock-history-filter')!==previousFilter,
    'filtered stock history response'
   );

   const filteredRows=d.querySelectorAll('#modal tbody tr');
   if(filteredRows.length!==1)
    throw Error('Expected one filtered stock movement, got '+filteredRows.length);

   const filteredText=filteredRows[0].textContent;
   if(!filteredText.includes('Removed') ||
      !filteredText.includes('UI inventory test adjustment'))
    throw Error('Movement type or reason filter did not work');

   d.querySelector('#close-modal').click();
   await until(()=>!d.querySelector('#modal').open,'close stock history modal');

   const inventoryTab=d.querySelector('[data-tab="inventory"]');
   if(!inventoryTab){
    const tabs=Array.from(d.querySelectorAll('[data-tab]')).map(b=>b.dataset.tab);
    throw Error('Inventory tab missing; available tabs: '+tabs.join(', '));
   }
   inventoryTab.click();

   await until(
    ()=>d.querySelector('#workspace-content')?.textContent.includes('Inventory report'),
    'seller inventory dashboard'
   );

   const reportText=d.querySelector('#workspace-content').textContent;
   if(!reportText.includes('Total units') || !reportText.includes('Low stock')
      || !reportText.includes('Out of stock'))
    throw Error('Inventory summary cards are missing');

   if(!d.querySelector('#workspace-content table tbody tr'))
    throw Error('Inventory report contains no product rows');

   console.log('PASS seller inventory: filtered history and inventory dashboard');
   d.querySelector('[data-tab=catalog]').click();
   await until(()=>d.querySelector('[data-edit-product="p1"]'),'return to catalog');

   const ordersTab = d.querySelector('[data-tab="orders"]');
   if(!ordersTab)throw Error('Seller Orders tab missing');
   ordersTab.click();

   await until(
    ()=>d.querySelector(`#workspace-content [data-track="${uiTrackedItemId}"]`),
    'seller order tracking button'
   );

   d.querySelector(`#workspace-content [data-track="${uiTrackedItemId}"]`).click();

   await until(
    ()=>d.querySelector('#modal').open
      && d.querySelector('#modal').textContent.includes('Order confirmed')
      && d.querySelector('#modal').textContent.includes('Updated by'),
    'seller order tracking timeline'
   );

   if(!d.querySelector('#modal').textContent.includes('Current status'))
    throw Error('Seller tracking timeline status is missing');

   console.log('PASS seller tracking: order-item timeline');

   d.querySelector('#close-modal').click();
   await until(()=>!d.querySelector('#modal').open,'close seller tracking modal');

   // Pack the customer order for delivery.
   const packOrder = d.querySelector(
    `#workspace-content [data-pack="${uiTrackedItemId}"]`
   );
   if(!packOrder)throw Error('Seller could not find the customer order to pack');
   packOrder.click();
   await until(
    ()=>!d.querySelector(`#workspace-content [data-pack="${uiTrackedItemId}"]`),
    'seller packed customer order'
   );
   console.log('PASS seller delivery preparation: customer order packed');


  }


  if(role==='admin' || role==='warehouse'){
   const operationalTrack = [...d.querySelectorAll('#main [data-track]')]
    .find(button=>button.dataset.track===uiTrackedItemId);

   if(!operationalTrack)
    throw Error(role+' tracking button missing for the customer order');

   operationalTrack.click();

   await until(
    ()=>d.querySelector('#modal').open
      && d.querySelector('#modal').textContent.includes('Order confirmed')
      && d.querySelector('#modal').textContent.includes('Updated by'),
    role+' order tracking timeline'
   );

   if(!d.querySelector('#modal').textContent.includes('Current status'))
    throw Error(role+' tracking timeline status is missing');

   console.log('PASS '+role+' tracking: operational order timeline');

   d.querySelector('#close-modal').click();
   await until(()=>!d.querySelector('#modal').open,'close '+role+' tracking modal');

   if(role==='admin'){
    const assignOrder=d.querySelector(`#main [data-assign="${uiTrackedItemId}"]`);
    if(!assignOrder)throw Error('Admin could not find the packed customer order');

    assignOrder.click();
    await until(()=>d.querySelector('#action-form'),'Admin courier assignment form');

    const assignForm=d.querySelector('#action-form');
    assignForm.querySelector('[name=courier_id]').value='delivery';
    assignForm.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));

    await until(()=>!d.querySelector('#modal').open,'Admin assigned courier');
    console.log('PASS admin delivery preparation: courier assigned');
   }

  }

  if(d.querySelector('#main').textContent.includes('Unexpected server error'))throw Error(role+' workspace failed');

  if(role==='delivery'){
   const startTask=d.querySelector(`#main [data-start="${uiTrackedItemId}"]`);
   if(!startTask)throw Error('Delivery partner cannot find the assigned customer order');

   startTask.click();
   await until(
    ()=>d.querySelector(`#main [data-failed="${uiTrackedItemId}"]`),
    'delivery partner started assigned order'
   );

   d.querySelector(`#main [data-failed="${uiTrackedItemId}"]`).click();
   await until(()=>d.querySelector('#action-form'),'failed delivery reason form');

   const failureForm=d.querySelector('#action-form');
   failureForm.querySelector('[name=reason]').value='Customer unavailable during UI smoke test';
   failureForm.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));

   await until(()=>!d.querySelector('#modal').open,'delivery failure recorded');
   console.log('PASS delivery exception: failed attempt submitted');
  }

  console.log('PASS UI DOM:',role);
  d.querySelector('#account').click();await until(()=>d.querySelector('#account').textContent==='Sign in','logout');await delay(100);
 }

 // Re-login as Admin after the delivery partner records the failure.
 d.querySelector('#account').click();
 await until(()=>d.querySelector('#login-form'),'open final Admin login');

 d.querySelector('[name=email]').value='admin@example.com';
 d.querySelector('[name=password]').value='7by11Demo!2026';
 d.querySelector('#login-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));

 await until(
  ()=>d.querySelector('#account').textContent.includes('Sign out')
   && d.querySelector('#delivery-exceptions-list')
     ?.textContent.includes('Customer unavailable during UI smoke test'),
  'Admin populated delivery exception queue'
 );

 await until(
  ()=>d.querySelector('#delivery-operations-summary')
    ?.textContent.includes('Out for delivery'),
  'Admin delivery operations metrics'
 );

 const slaSummary=d.querySelector('#delivery-operations-summary');
 const slaStats=[...slaSummary.querySelectorAll('.stat')]
  .map(element=>element.textContent.replace(/\\s+/g,' ').trim());
 const metric=label=>slaStats.find(value=>value.startsWith(label));

 if(!metric('Out for delivery')?.endsWith('1'))
  throw Error('SLA dashboard should show one item out for delivery: '+slaStats.join(' | '));

 if(!metric('Repeat failures')?.endsWith('0'))
  throw Error('SLA dashboard repeat-failure count is incorrect');

 const ageFilter=d.querySelector('#delivery-age-filter');
 if(!ageFilter)throw Error('Delivery ageing filter is missing');

 ageFilter.value='repeat_failure';
 ageFilter.dispatchEvent(new w.Event('change',{bubbles:true}));

 if(!d.querySelector('#delivery-operations-list').textContent.includes(
  'No pending delivery items match this filter.'
 ))
  throw Error('Repeat-failure filter should exclude a single-attempt item');

 ageFilter.value='all';
 ageFilter.dispatchEvent(new w.Event('change',{bubbles:true}));

 if(!d.querySelector(`#delivery-operations-list [data-track="${uiTrackedItemId}"]`))
  throw Error('All-items filter did not restore the pending delivery item');

 console.log('PASS admin delivery SLA dashboard: metrics and repeat-failure filter');

 const exceptionPanel=d.querySelector('#delivery-exceptions-list');
 const exceptionText=exceptionPanel.textContent;

 if(!exceptionText.includes('Attempts: 1'))
  throw Error('Delivery exception attempt count was not displayed');

 if(!exceptionPanel.querySelector(`[data-track="${uiTrackedItemId}"]`))
  throw Error('Delivery exception tracking button is missing');

 const reassignException=exceptionPanel.querySelector(
  `[data-assign="${uiTrackedItemId}"]`
 );
 if(!reassignException)
  throw Error('Delivery exception reassignment button is missing');

 console.log('PASS admin delivery exceptions: populated queue, reason, count and tracking');

 reassignException.click();
 await until(()=>d.querySelector('#action-form'),'exception reassignment form');

 const exceptionAssignForm=d.querySelector('#action-form');
 exceptionAssignForm.querySelector('[name=courier_id]').value='delivery';
 exceptionAssignForm.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));

 await until(
  ()=>d.querySelector('#delivery-exceptions-list')
    ?.textContent.includes('Customer unavailable during UI smoke test')
    && d.querySelector('#delivery-exceptions-list')?.textContent.includes('packed'),
  'exception remains visible after reassignment'
 );

 const reassignedText=d.querySelector('#delivery-exceptions-list').textContent;
 if(!reassignedText.includes('Attempts: 1'))
  throw Error('Reassignment did not preserve delivery attempt history');

 console.log('PASS admin delivery exceptions: reassignment retains exception history');

 await until(
  ()=>{
   const stats=[...(d.querySelectorAll('#delivery-operations-summary .stat'))]
    .map(element=>element.textContent.replace(/\\s+/g,' ').trim());
   const packed=stats.find(value=>value.startsWith('Packed · awaiting pickup'));
   const out=stats.find(value=>value.startsWith('Out for delivery'));
   return packed?.endsWith('1') && out?.endsWith('0');
  },
  'SLA metrics updated after reassignment'
 );

 console.log('PASS admin delivery SLA dashboard: reassignment updates workload metrics');

 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: catalog, customer UI checkout, eight role sign-ins and workspace render; no script exceptions');
 }finally{dom?.window.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
