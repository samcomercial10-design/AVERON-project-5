'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('CJ shipping checker uses VID quote plus diagnostic fallbacks',()=>{
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(server,/\/logistic\/freightCalculate'/);
  assert.match(server,/products:\[\{quantity:1,vid\}\]/);
  assert.match(server,/\/logistic\/freightCalculateTip/);
  assert.match(server,/\/logistic\/unavailableShippingMethods/);
  assert.match(server,/status:'confirmed_unavailable'/);
  assert.match(server,/status:'unconfirmed'/);
});

test('Apply CJ availability preserves unconfirmed markets',()=>{
  const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  assert.match(admin,/Could not confirm/);
  assert.match(admin,/confirmed_unavailable/);
  assert.match(admin,/else preserved\+\+/);
  assert.match(admin,/unconfirmed market/);
});
