'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const read=f=>fs.readFileSync(path.resolve(__dirname,'..',f),'utf8');
test('Size Guide is configurable per product and rendered as a PDP modal',()=>{
  const admin=read('admin.html'),adminJs=read('admin.js'),product=read('product.html'),productJs=read('product-page.js'),security=read('security.js'),server=read('server.js');
  assert.match(admin,/id="size-guide-enabled"/);assert.match(admin,/id="size-guide-image"/);assert.match(admin,/id="size-guide-preview"/);
  assert.match(adminJs,/sizeGuide:\{enabled:\$\('size-guide-enabled'\)\.checked,image:sizeGuideImage\}/);
  assert.match(adminJs,/candidate\.sizeGuide=/);assert.match(security,/const sizeGuide =/);assert.match(server,/const sizeGuide=\{enabled:/);
  assert.match(product,/id="size-guide-open"/);assert.match(product,/id="size-guide-modal"/);assert.match(productJs,/p\.sizeGuide\?\.enabled===true/);assert.match(productJs,/data-size-guide-close/);
});
test('browser cache does not store the Size Guide base64 image',()=>{assert.match(read('admin.js'),/sizeGuide:\{\.\.\.\(p\.sizeGuide\|\|\{\}\),image:''\}/)});
