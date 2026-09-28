'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{DatabaseSync}=require('node:sqlite');
const Stripe=require('stripe');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'averon-security-'));
const port=49000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`,dbPath=path.join(tmp,'orders.db');
const secret='whsec_local_security_fixture';
const salt=crypto.randomBytes(16),hash='scrypt$'+salt.toString('base64url')+'$'+crypto.scryptSync('LocalTestPassword123!',salt,64).toString('base64url');
const sessions={},items={};let child,db,adminCookie;
const calls=()=>fs.existsSync(path.join(tmp,'calls.jsonl'))?fs.readFileSync(path.join(tmp,'calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const save=()=>{fs.writeFileSync(path.join(tmp,'sessions.json'),JSON.stringify(sessions));fs.writeFileSync(path.join(tmp,'items.json'),JSON.stringify(items));};
function fixture(id,owner='alice'){
 sessions[id]={id,livemode:id.startsWith('cs_live_'),payment_status:'paid',status:'complete',created:1700000000,amount_total:5000,currency:'gbp',payment_intent:'pi_'+id,metadata:{supabase_user_id:owner,store:'AVERON'},customer_details:{email:owner+'@example.test',name:'Fixture Buyer',phone:'000',address:{country:'GB',line1:'Test Street',postal_code:'AA1',city:'Test'}}};
 items[id]=[{description:'Fixture product',quantity:1,amount_total:5000,currency:'gbp',price:{product:{metadata:{averon_product_id:'p1',size:'M',colour:'Dark Blue',cj_vid:'FROZEN_VID',cj_sku:'FROZEN_SKU',cj_logistics:'Fixture Logistics'}}}}];save();return sessions[id];
}
const headers=(user='alice')=>({'Content-Type':'application/json',Origin:base,Cookie:'averon_customer_access='+user});
async function start(){
 child=spawn(process.execPath,['--require',path.join(__dirname,'fixtures/security-services.cjs'),'server.js'],{cwd:root,env:{...process.env,NODE_ENV:'test',PORT:String(port),SITE_URL:base,AVERON_DB_PATH:dbPath,AVERON_TEST_FIXTURES:tmp,STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:secret,SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'fixture_publishable_key_123456789',ADMIN_EMAIL:'admin@example.test',ADMIN_PASSWORD_HASH:hash,CJ_API_KEY:'fixture',CJ_OPEN_ID:'fixture',CJ_STRIPE_SANDBOX_AUTOMATION:'false',CJ_LIVE_AUTOMATION:'true',CJ_AUTO_PAY_BALANCE:'false'},stdio:['ignore','ignore','pipe']});
 let errors='';child.stderr.on('data',b=>errors+=b);
 for(let i=0;i<80;i++){try{const r=await fetch(base+'/healthz');if(r.status===200)return;}catch{}await new Promise(r=>setTimeout(r,50));}
 throw new Error('Server did not start: '+errors);
}
async function stop(){if(child&&child.exitCode===null){const closed=new Promise(r=>child.once('exit',r));child.kill();await closed;}}
async function webhook(id,type='checkout.session.completed',object=sessions[id]){
 const payload=JSON.stringify({id:'evt_'+id,type,data:{object}});
 const signature=Stripe.webhooks.generateTestHeaderString({payload,secret});
 return fetch(base+'/webhook',{method:'POST',headers:{'Content-Type':'application/json','stripe-signature':signature},body:payload});
}
async function waitJob(id,state){for(let i=0;i<100;i++){const row=db.prepare('SELECT state FROM fulfillment_jobs WHERE session_id=?').get(id);if(row?.state===state)return;await new Promise(r=>setTimeout(r,60));}assert.fail('Job did not reach '+state);}
test.before(async()=>{save();await start();db=new DatabaseSync(dbPath);const r=await fetch(base+'/api/admin/auth/login',{method:'POST',headers:headers(),body:JSON.stringify({email:'admin@example.test',password:'LocalTestPassword123!'})});assert.equal(r.status,200);adminCookie=r.headers.get('set-cookie').split(';')[0];});
test.after(async()=>{await stop();db?.close();fs.rmSync(tmp,{recursive:true,force:true});});
const adminHeaders=()=>({'Content-Type':'application/json',Origin:base,Cookie:adminCookie});
test('private files, encoded aliases and traversal cannot be downloaded',async()=>{
 for(const target of ['/server.js','/%73erver.js','/averon-orders.d%62','/averon-orders.db%2dwal','/averon-orders.db%2dshm','/%70roducts.server.json','/node_modules/stripe/package.json','/.env','/public-files.json','/scripts/build-public.js','/tests/fixtures/security-services.cjs','/%2e%2e%2fserver.js']){
  const r=await fetch(base+target);assert.equal(r.status,404,target);
 }
 for(const target of ['/','/product.html','/styles.css','/app.js','/assets/logo-navy.png'])assert.equal((await fetch(base+target)).status,200,target);
 assert.match((await fetch(base+'/')).headers.get('Content-Security-Policy'),/script-src 'self'/);
});
test('public catalogue preserves selectors without supplier identifiers; admin retains complete mappings',async()=>{
 const data=await (await fetch(base+'/api/catalog')).json();assert.equal(data.products.length,10);
 for(const p of data.products){assert.ok(p.supplier.mappings.length);assert.equal(p.supplier.pid,undefined);for(const m of p.supplier.mappings){assert.equal(m.vid,undefined);assert.equal(m.sku,undefined);}}
 const res=await fetch(base+'/api/admin/catalog',{headers:adminHeaders()});assert.equal(res.status,200);assert.ok((await res.json()).products[0].supplier.pid);
});
test('order APIs require authentication and compare owner, never email alone',async()=>{
 const id='cs_test_Ownership001';fixture(id);assert.equal((await webhook(id)).status,200);
 for(const route of ['/api/order-status','/api/checkout-session']){
  assert.equal((await fetch(base+route+'?session_id='+id)).status,401);
  assert.equal((await fetch(base+route+'?session_id='+id,{headers:headers('bob')})).status,404);
  const own=await fetch(base+route+'?session_id='+id,{headers:headers()});assert.equal(own.status,200);assert.equal(own.headers.get('Cache-Control'),'no-store');
 }
 for(const user of ['invalid','bob']){const res=await fetch(base+'/api/refund-request',{method:'POST',headers:headers(user),body:JSON.stringify({session_id:id,customer_email:'alice@example.test'})});assert.equal(res.status,user==='bob'?404:401);}
 assert.equal(calls().filter(x=>x.kind==='refund').length,0);
 const account=await (await fetch(base+'/api/account/orders',{headers:headers()})).json();assert.equal(account.orders[0].items[0].supplier_snapshot,undefined);
});
test('checkout rejects invalid/disabled variants, uses server price and stable Stripe idempotency key',async()=>{
 const product=require('../products.server.json')[0],variant=product.supplier.mappings.find(m=>m.enabled!==false);
 const colour=variant.cjLabel.replace(/-[^-]+$/,'');
 const make=body=>fetch(base+'/api/create-checkout-session',{method:'POST',headers:headers(),body:JSON.stringify({attempt_id:'local-attempt-1234567890',...body})});
 assert.equal((await make({items:[{id:product.id,size:'NONEXISTENT',colour}]})).status,400);
 assert.equal((await make({items:[{id:product.id,size:variant.option,colour:'Nonexistent colour'}]})).status,400);
 const body={items:[{id:product.id,size:variant.option,colour,qty:1,price:0.01}]};
 assert.equal((await make(body)).status,200);assert.equal((await make(body)).status,200);
 const created=calls().filter(x=>x.kind==='checkout');assert.equal(created.length,2);assert.equal(created[0].data.options.idempotencyKey,created[1].data.options.idempotencyKey);
 const price=created[0].data.params.line_items[0].price_data;assert.equal(price.unit_amount,Math.round(product.price*100));assert.equal(price.product_data.metadata.cj_vid,variant.vid);
});
test('refund request never issues money automatically and holds fulfilment',async()=>{
 const id='cs_live_RefundHold002';fixture(id);assert.equal((await webhook(id)).status,200);
 const response=await fetch(base+'/api/refund-request',{method:'POST',headers:headers(),body:JSON.stringify({session_id:id,customer_email:'alice@example.test'})});assert.equal(response.status,200);assert.equal((await response.json()).automatic,false);
 await new Promise(r=>setTimeout(r,2200));assert.equal(db.prepare('SELECT state FROM fulfillment_jobs WHERE session_id=?').get(id).state,'pending');
 const before=calls().filter(x=>x.kind==='refund').length;
 const result=await fetch(base+'/api/admin/orders/'+id+'/approve-refund',{method:'POST',headers:adminHeaders(),body:'{}'});assert.equal(result.status,200);assert.equal(calls().filter(x=>x.kind==='refund').length,before+1);
});
test('repeated concurrent Stripe events create one supplier order using frozen variant',async()=>{
 // Inactive sandbox work must not starve live jobs at the front of the queue.
 for(let n=0;n<12;n++){const id='cs_test_Inactive'+n;db.prepare("INSERT INTO orders(session_id,order_ref,payment_status,stripe_status,created,updated) VALUES (?,?,'paid','complete',0,0)").run(id,'INACTIVE'+n);db.prepare("INSERT INTO fulfillment_jobs(session_id,live,state,updated) VALUES (?,0,'pending',0)").run(id);}
 const id='cs_live_Duplicate003';fixture(id);
 const results=await Promise.all([webhook(id),webhook(id),webhook(id)]);for(const r of results)assert.equal(r.status,200);
 await waitJob(id,'done');const supplier=calls().filter(x=>x.kind==='cj-create');assert.equal(supplier.length,1);assert.equal(supplier[0].data.products[0].vid,'FROZEN_VID');
 assert.equal((await webhook(id)).status,200);await new Promise(r=>setTimeout(r,2200));assert.equal(calls().filter(x=>x.kind==='cj-create').length,1);
 // Existing supplier order cannot be refunded without explicit reconciliation acknowledgement.
 await fetch(base+'/api/refund-request',{method:'POST',headers:headers(),body:JSON.stringify({session_id:id,customer_email:'alice@example.test'})});
 const r=await fetch(base+'/api/admin/orders/'+id+'/approve-refund',{method:'POST',headers:adminHeaders(),body:'{}'});assert.equal(r.status,409);
});
test('pending jobs survive restart; interrupted and uncertain jobs are not automatically repeated',async()=>{
 const id='cs_live_Restart004';fixture(id);await webhook(id);await stop();await start();await waitJob(id,'done');
 const count=calls().filter(x=>x.kind==='cj-create').length;
 db.prepare("UPDATE fulfillment_jobs SET state='running',updated=0 WHERE session_id=?").run(id);
 await stop();await start();await new Promise(r=>setTimeout(r,2200));assert.equal(calls().filter(x=>x.kind==='cj-create').length,count);
 const failed='cs_live_Uncertain005';fixture(failed);fs.writeFileSync(path.join(tmp,'fail-cj'),'yes');await webhook(failed);await waitJob(failed,'review');
 const after=calls().filter(x=>x.kind==='cj-create').length;await webhook(failed);await new Promise(r=>setTimeout(r,2200));assert.equal(calls().filter(x=>x.kind==='cj-create').length,after);
 fs.unlinkSync(path.join(tmp,'fail-cj'));
});

test('signed refund events reconcile pending, failed and completed refunds',async()=>{
 const id='cs_test_RefundEvents006';fixture(id);await webhook(id);
 const refund={id:'re_events',payment_intent:'pi_'+id,status:'pending'};
 const saveRefund=amount=>{fs.writeFileSync(path.join(tmp,'refunds.json'),JSON.stringify({re_events:refund}));fs.writeFileSync(path.join(tmp,'intents.json'),JSON.stringify({['pi_'+id]:{latest_charge:{amount_refunded:amount}}}));};
 saveRefund(0);assert.equal((await webhook('refund1','refund.updated',refund)).status,200);
 assert.equal(db.prepare('SELECT refund_status FROM orders WHERE session_id=?').get(id).refund_status,'refund_pending');
 refund.status='failed';saveRefund(0);assert.equal((await webhook('refund2','refund.failed',refund)).status,200);
 assert.equal(db.prepare('SELECT refund_status FROM orders WHERE session_id=?').get(id).refund_status,'refund_failed');
 refund.status='succeeded';saveRefund(5000);assert.equal((await webhook('refund3','refund.updated',refund)).status,200);
 assert.equal(db.prepare('SELECT refund_status FROM orders WHERE session_id=?').get(id).refund_status,'refunded');
});
test('manual reconciliation requires an explicit check and cannot recreate linked orders',async()=>{
 const id='cs_live_Uncertain005';
 const route=base+'/api/admin/orders/'+id+'/cj-reconcile';
 assert.equal((await fetch(route,{method:'POST',headers:adminHeaders(),body:'{}'})).status,400);
 assert.equal((await fetch(route,{method:'POST',headers:adminHeaders(),body:JSON.stringify({supplier_checked:true,cj_order_id:'EXISTING_PROVIDER_ID'})})).status,200);
 assert.equal(db.prepare('SELECT state FROM fulfillment_jobs WHERE session_id=?').get(id).state,'done');
 assert.equal(db.prepare('SELECT cj_order_id FROM orders WHERE session_id=?').get(id).cj_order_id,'EXISTING_PROVIDER_ID');
 assert.equal((await fetch(base+'/api/admin/orders/'+id+'/cj-live-retry',{method:'POST',headers:adminHeaders(),body:'{}'})).status,409);
});

test('forged origin, invalid webhook and oversized public payloads are rejected',async()=>{
 const bad=await fetch(base+'/api/refund-request',{method:'POST',headers:{...headers(),Origin:'https://evil.invalid','X-Forwarded-Host':'evil.invalid','X-Forwarded-Proto':'https'},body:'{}'});assert.equal(bad.status,403);
 assert.equal((await fetch(base+'/webhook',{method:'POST',headers:{'Content-Type':'application/json','stripe-signature':'fake'},body:'{}'})).status,400);
 const large=await fetch(base+'/api/auth/login',{method:'POST',headers:headers(),body:JSON.stringify({padding:'x'.repeat(140000)})});assert.equal(large.status,413);
});
