const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('product catalogue is server-backed and cache-bypassed',()=>{
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  const sync=fs.readFileSync(path.join(root,'catalogue-sync.js'),'utf8');
  assert.match(server,/app\.get\('\/api\/catalog'/);
  assert.match(server,/no-store, no-cache/);
  assert.match(sync,/fetch\('\/api\/catalog'/);
});

test('admin browser cache excludes base64 product imagery',()=>{
  const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  assert.match(admin,/browserCatalogueCache/);
  assert.match(admin,/coverImage:''/);
  assert.match(admin,/colourImagery:\[\]/);
});

test('admin uses the product returned from server after save',()=>{
  const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  assert.match(admin,/Object\.assign\(p,data\.product\|\|candidate\)/);
  assert.match(admin,/adminReady\.then\(async\(\)=>/);
  assert.match(admin,/fetch\('\/api\/catalog'/);
});

test('image limits are consistent between browser sanitizer and server',()=>{
  const sec=fs.readFileSync(path.join(root,'security.js'),'utf8');
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(sec,/MAX_DATA_IMAGE = 4_500_000/);
  assert.match(server,/safeText\(raw\.coverImage,4500000\)/);
  assert.match(server,/limit: '96mb'/);
});

test('product cover stays out of the product-detail gallery',()=>{
  const page=fs.readFileSync(path.join(root,'product-page.js'),'utf8');
  assert.match(page,/Product Cover is intentionally storefront-only/);
  assert.match(page,/images:\[\.\.\.new Set\(extras\.filter\(Boolean\)\)\]/);
  assert.doesNotMatch(page,/new Set\(\[cover,\.\.\.extras\]/);
});
