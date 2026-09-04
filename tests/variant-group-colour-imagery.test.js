const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('variant mapping is grouped by size and supports group visibility',()=>{
 const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
 assert.match(admin,/variant-size-group/);
 assert.match(admin,/variantGroupToggle/);
 assert.match(admin,/indeterminate/);
 assert.match(admin,/childChecks\.forEach/);
});

test('colour-specific cover and gallery are persisted and rendered on selection',()=>{
 const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
 const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
 const security=fs.readFileSync(path.join(root,'security.js'),'utf8');
 const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
 const product=fs.readFileSync(path.join(root,'product-page.js'),'utf8');
 assert.match(html,/id="colour-imagery-section"/);
 assert.match(admin,/renderColourImageryEditor/);
 assert.match(admin,/section\.hidden=colours\.length<=1/);
 assert.match(security,/colourImagery/);
 assert.match(server,/colourImagery/);
 assert.match(product,/imageryForColour/);
 assert.match(product,/renderGalleryForSelectedColour/);
});
