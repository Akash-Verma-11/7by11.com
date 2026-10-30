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

 for(const role of ['customer','seller','seller2','admin','delivery','warehouse','support','finance']){
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
  }
  if(d.querySelector('#main').textContent.includes('Unexpected server error'))throw Error(role+' workspace failed');
  console.log('PASS UI DOM:',role);
  d.querySelector('#account').click();await until(()=>d.querySelector('#account').textContent==='Sign in','logout');await delay(100);
 }
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: catalog, customer UI checkout, eight role sign-ins and workspace render; no script exceptions');
 }finally{dom?.window.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
