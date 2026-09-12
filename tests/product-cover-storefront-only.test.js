const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('PDP gallery is derived only from Product Imagery for every product',()=>{
  const page=fs.readFileSync(path.join(root,'product-page.js'),'utf8');
  assert.match(page,/const extras=colourImages\.length\?colourImages:fallback/);
  assert.match(page,/return \{cover,images:\[\.\.\.new Set\(extras\.filter\(Boolean\)\)\]\}/);
});

test('Product Cover remains available for catalogue/card purposes',()=>{
  const page=fs.readFileSync(path.join(root,'product-page.js'),'utf8');
  assert.match(page,/const src=S\.imageSrc\(prod\.coverImage\)\|\|S\.imageSrc\(prod\.images\?\.\[0\]\)/);
  assert.match(page,/qty,image:imageryForColour\(selectedColour\)\.cover/);
});
