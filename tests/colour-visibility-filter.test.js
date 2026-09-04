const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('storefront colour swatches expose an enabled checkbox and persist it',()=>{
  const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  const security=fs.readFileSync(path.join(root,'security.js'),'utf8');
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(admin,/data\.colourEnabled|dataset\.colourEnabled/);
  assert.match(admin,/enabled:r\.querySelector\('\[data-colour-enabled\]'\)/);
  assert.match(security,/enabled:c\?\.enabled!==false/);
  assert.match(server,/enabled:c\?\.enabled!==false/);
});

test('disabled colours are removed from AVERON variant mapping but raw CJ variants remain',()=>{
  const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  assert.match(admin,/colourEnabledForLabel/);
  assert.match(admin,/filter\(m=>colourEnabledForLabel\(m\.cjLabel,swatches\)\)/);
  assert.match(admin,/selectableVariants=variants\.filter\(v=>colourEnabledForLabel\(v\.label,swatches\)\)/);
  assert.match(admin,/variants:cjVariantsFromDom\(\)/);
});

test('product page does not render storefront colours disabled in admin',()=>{
  const page=fs.readFileSync(path.join(root,'product-page.js'),'utf8');
  assert.match(page,/enabled:c\?\.enabled!==false/);
  assert.match(page,/configuredSwatches\.get\(colourNames\[i\]\.toLowerCase\(\)\)\?\.enabled===false/);
});
