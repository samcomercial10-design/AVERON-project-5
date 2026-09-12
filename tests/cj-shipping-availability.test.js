'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('Content Studio can check and apply CJ shipping availability for the 18 AVERON markets',()=>{
  const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
  const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(html,/id=\"shipping-check-cj\"/);
  assert.match(html,/id=\"shipping-apply-cj\"/);
  assert.match(admin,/\/api\/admin\/cj\/shipping-availability/);
  assert.match(admin,/Check with CJ/);
  assert.match(server,/app\.post\('\/api\/admin\/cj\/shipping-availability'/);
  assert.match(server,/\/logistic\/freightCalculateTip/);
  assert.match(server,/\/product\/stock\/getInventoryByPid/);
  const block=server.match(/const EUROPE_CHECKOUT_COUNTRIES = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(block);
  const codes=[...block[1].matchAll(/'([A-Z]{2})'/g)].map(m=>m[1]);
  assert.deepEqual(codes,['GB','DE','FR','NL','BE','CH','AT','SE','DK','NO','FI','IE','IT','ES','PT','LU','PL','CZ']);
});
