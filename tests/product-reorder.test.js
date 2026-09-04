const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('admin product list has a dedicated drag handle and keeps product click separate',()=>{
  const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
  assert.match(admin,/product-drag-handle/);
  assert.match(admin,/product-row-open/);
  assert.match(admin,/open\.addEventListener\('click',\(\)=>loadProduct\(p\.id\)\)/);
  assert.match(admin,/handle\.draggable=true/);
  assert.match(html,/\.product-drag-handle/);
});

test('manual product order is saved locally and persisted on server',()=>{
  const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(admin,/function moveProductById/);
  assert.match(admin,/saveAll\(\)/);
  assert.match(admin,/\/api\/admin\/catalog\/reorder/);
  assert.match(server,/app\.post\('\/api\/admin\/catalog\/reorder'/);
  assert.match(server,/catalog\.splice\(0,catalog\.length,\.\.\.ordered\)/);
});

test('homepage catalogue still renders products in stored array order',()=>{
  const catalogue=fs.readFileSync(path.join(root,'catalogue.js'),'utf8');
  assert.match(catalogue,/products\.forEach\(p=>/);
  assert.doesNotMatch(catalogue,/\.sort\(/);
});
