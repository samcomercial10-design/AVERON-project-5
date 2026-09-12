const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('Norway and Switzerland survive server shipping validation',()=>{
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  const block=server.match(/const EUROPE_CHECKOUT_COUNTRIES = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(block);
  assert.match(block[1],/'NO'/);
  assert.match(block[1],/'CH'/);
});

test('CJ receives proper country names for Norway and Switzerland',()=>{
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(server,/NO:'Norway'/);
  assert.match(server,/CH:'Switzerland'/);
});

test('Admin and backend both support NO and CH',()=>{
  const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(admin,/AVERON_SHIPPING_COUNTRIES=\[[^\]]*'CH'[^\]]*'NO'/);
  assert.match(server,/EUROPE_CHECKOUT_COUNTRIES[\s\S]*?'CH'[\s\S]*?'NO'/);
});
