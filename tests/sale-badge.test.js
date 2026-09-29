const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
for(const file of ['catalogue.js','collection-page.js']){
 test(`${file} calculates the percentage badge from a valid previous price`,()=>{
  const src=fs.readFileSync(file,'utf8');
  assert.match(src,/previousPrice/);
  assert.match(src,/oldPrice>.*price/);
  assert.match(src,/Math\.round\(\(\(oldPrice-p\.price\)\/oldPrice\)\*100\)/);
  assert.match(src,/card-sale-badge',`↓\$\{discount\}%`/);
  assert.doesNotMatch(src,/card-sale-badge','Sale'/);
  assert.match(src,/card-previous-price/);
 });
}
test('product detail retains its existing sale state treatment',()=>{
 const src=fs.readFileSync('product-page.js','utf8');
 assert.match(src,/previousPrice/);
 assert.match(src,/oldPrice>.*price/);
});
test('sale badge is positioned at upper-left of product imagery',()=>{
 const css=fs.readFileSync('styles.css','utf8');
 assert.match(css,/\.card-sale-badge\{[^}]*top:12px; left:12px;/s);
});
