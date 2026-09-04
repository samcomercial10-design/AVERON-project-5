const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('PDP delivery message no longer claims UK-only delivery',()=>{
  const html=fs.readFileSync(path.join(root,'product.html'),'utf8');
  assert.equal(html.includes('Free UK delivery'),false);
  assert.equal(html.includes('Free delivery on orders over £75'),true);
});
test('CJ centimetre sizes are recognised in admin, PDP and server',()=>{
  for(const file of ['admin.js','product-page.js','server.js']){
    const src=fs.readFileSync(path.join(root,file),'utf8');
    assert.equal(src.includes('[0-9]{1,3}(?:CM)?'),true,file);
  }
});
test('Content Studio safe links preserve query strings and edit/orders routes',()=>{
  const src=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  assert.equal(src.includes('const search='),true);
  assert.equal(src.includes('return p+search+hash'),true);
  assert.equal(src.includes('|orders|success|edit)'),true);
});
