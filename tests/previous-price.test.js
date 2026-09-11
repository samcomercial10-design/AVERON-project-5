const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
test('previous price is optional, persisted, validated and rendered above current PDP price',()=>{
  const admin=read('admin.html'), adminJs=read('admin.js'), sec=read('security.js'), server=read('server.js'), pdp=read('product-page.js'), html=read('product.html'), css=read('styles.css');
  assert.match(admin,/id=\"f-previous-price\"/);
  assert.match(adminJs,/previousPrice:\$\('f-previous-price'\)\.value/);
  assert.match(sec,/previousPrice:/);
  assert.match(server,/previousPrice:previousPrice===null\?null/);
  assert.match(server,/previousPrice<=price/);
  assert.match(html,/id=\"p-previous-price\"/);
  assert.match(pdp,/old>p\.price/);
  assert.match(css,/\.pdp-previous-price/);
});
