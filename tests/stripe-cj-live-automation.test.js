const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('Stripe live paid sessions can be gated into CJ live fulfilment',()=>{
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  const env=fs.readFileSync(path.join(root,'.env.example'),'utf8');

  assert.match(server,/CJ_LIVE_AUTOMATION/);
  assert.match(server,/CJ_AUTO_PAY_BALANCE/);
  assert.match(server,/async function syncStripeLiveOrderToCj/);
  assert.match(server,/createOrderV2/);
  assert.match(server,/const payType = cjAutoPayBalance \? 2 : 3/);
  assert.match(server,/queueCjAutomationForPaidStripeSession/);
  assert.match(server,/order\.cj_order_id/);
  assert.match(server,/cj-live-retry/);

  assert.match(env,/CJ_LIVE_AUTOMATION=false/);
  assert.match(env,/CJ_AUTO_PAY_BALANCE=false/);
});

test('live CJ automation never reuses sandbox product mapping helper',()=>{
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  const start=server.indexOf('async function syncStripeLiveOrderToCj');
  const end=server.indexOf('function queueCjAutomationForPaidStripeSession',start);
  const liveBlock=server.slice(start,end);
  assert.match(liveBlock,/cjLiveVariantFor/);
  assert.doesNotMatch(liveBlock,/cjSandboxVariantFor/);
  assert.match(liveBlock,/isSandbox:0/);
});
