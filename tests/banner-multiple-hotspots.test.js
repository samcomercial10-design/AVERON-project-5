const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('banner editor supports multiple invisible clickable areas and storefront renders real links',()=>{
 const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
 const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
 const content=fs.readFileSync(path.join(root,'content.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
 assert.match(html,/id="banner-hotspot-add"/);
 assert.match(html,/id="banner-hotspot-list"/);
 assert.match(admin,/bannerHotspots/);
 assert.match(admin,/maximum of 8 clickable areas/i);
 assert.match(content,/createElement\('a'\)/);
 assert.match(content,/\(b\.hotspots\|\|\[\]\)\.forEach/);
 assert.match(css,/pointer-events:auto!important/);
 assert.match(css,/z-index:40!important/);
});
