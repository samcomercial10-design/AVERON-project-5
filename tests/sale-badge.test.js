const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
for(const file of ['catalogue.js','collection-page.js','product-page.js']){
 test(`${file} shows Sale badge only for a valid previous price`,()=>{
  const src=fs.readFileSync(file,'utf8');
  assert.match(src,/previousPrice/);
  assert.match(src,/oldPrice>.*price/);
  assert.match(src,/card-sale-badge','Sale'/);
 });
}
test('sale badge is positioned at upper-left of product imagery',()=>{
 const css=fs.readFileSync('styles.css','utf8');
 assert.match(css,/\.card-sale-badge\{[^}]*top:12px; left:12px;/s);
});
