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
 for(const role of ['customer','seller','seller2','admin','delivery','warehouse','support','finance']){
  d.querySelector('#account').click();
  d.querySelector('[name=email]').value=role+'@example.com';d.querySelector('[name=password]').value='7by11Demo!2026';
  d.querySelector('#login-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>d.querySelector('#account').textContent.includes('Sign out'),'login '+role);
  await delay(200);
  if(role==='customer'){
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
