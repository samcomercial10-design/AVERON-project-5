const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('admin deletion calls a persistent server DELETE endpoint',()=>{
  const a=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  assert.match(a,/fetch\('\/api\/admin\/catalog\/product\/'\+encodeURIComponent\(deletingId\),\{method:'DELETE'/);
  assert.match(a,/Product deleted permanently/);
});
test('server persists product deletion to products.server.json',()=>{
  const s=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(s,/app\.delete\('\/api\/admin\/catalog\/product\/:id'/);
  assert.match(s,/catalog\.splice\(index,1\)/);
  assert.match(s,/fs\.renameSync\(tmp,file\)/);
});
test('banner and mini-banner destinations preserve internal query links and https links',()=>{
  const a=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  const s=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(a,/return u\.href\.slice\(0,500\)/);
  assert.match(s,/return u\.href\.slice\(0,500\)/);
  assert.match(s,/\|orders\|success\|edit\)/);
});
