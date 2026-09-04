const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('Material & Craft is configurable per product in Content Studio',()=>{
 const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
 const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
 const security=fs.readFileSync(path.join(root,'security.js'),'utf8');
 const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
 const page=fs.readFileSync(path.join(root,'product-page.js'),'utf8');
 assert.match(html,/id="material-enabled"/);
 assert.match(html,/id="material-preview-1"/);
 assert.match(admin,/currentMaterialCraft/);
 assert.match(security,/materialCraft/);
 assert.match(server,/materialCraft/);
 assert.match(page,/renderMaterialCraft/);
});

test('Complete the Look can be toggled and manually populated',()=>{
 const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
 const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
 const security=fs.readFileSync(path.join(root,'security.js'),'utf8');
 const page=fs.readFileSync(path.join(root,'product-page.js'),'utf8');
 assert.match(html,/id="complete-look-enabled"/);
 assert.match(html,/id="complete-look-products"/);
 assert.match(admin,/renderCompleteLookChoices/);
 assert.match(admin,/Choose up to four Complete the Look products/);
 assert.match(security,/completeLook/);
 assert.match(page,/renderCompleteLook/);
 assert.match(page,/makeProductRecommendationCard/);
});
