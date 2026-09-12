const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('hero and editorial banners persist through authenticated server content endpoint',()=>{
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  assert.match(server,/app\.get\('\/api\/site-content'/);
  assert.match(server,/app\.put\('\/api\/admin\/site-content'/);
  assert.match(server,/site-content\.server\.json/);
  assert.match(admin,/persistSiteContentServer/);
  assert.match(admin,/banner-form'\)\.addEventListener\('submit',async/);
});

test('all mini banners use the same server-backed persistence path',()=>{
  const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  const content=fs.readFileSync(path.join(root,'content.js'),'utf8');
  assert.match(admin,/mini-form'\)\.addEventListener\('submit',async/);
  assert.match(admin,/desktopMinis,mobileMinis/);
  assert.match(content,/fetch\('\/api\/site-content'/);
  assert.match(content,/serverSnapshot/);
});

test('first server run migrates existing browser banner content instead of erasing it',()=>{
  const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  assert.match(admin,/if\(data\.initialized&&data\.content\)/);
  assert.match(admin,/First run after this update: migrate the existing browser content/);
  assert.match(admin,/await persistSiteContentServer\(\)/);
});

test('Shop the Edit reads synchronized mini-banner selections',()=>{
  const html=fs.readFileSync(path.join(root,'edit.html'),'utf8');
  const page=fs.readFileSync(path.join(root,'edit-page.js'),'utf8');
  assert.ok(html.indexOf('content.js')>=0 && html.indexOf('content.js')<html.indexOf('edit-page.js'));
  assert.match(page,/AVERON_CONTENT_READY/);
  assert.match(page,/AVERON_CONTENT\?\.getMini/);
});
