const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Content Studio supports invisible draggable banner hotspot',()=>{
 const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
 const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
 const content=fs.readFileSync(path.join(root,'content.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
 assert.match(html,/banner-hotspot-enabled/);
 assert.match(html,/banner-hotspot-guide/);
 assert.match(admin,/pointerdown/);
 assert.match(admin,/hotspot:/);
 assert.match(content,/banner-click-hotspot/);
 assert.match(css,/\.banner-click-hotspot/);
});
