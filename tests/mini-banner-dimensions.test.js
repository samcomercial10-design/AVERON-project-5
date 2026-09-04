const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('admin shows exact pixel recommendations for mini banners',()=>{
 const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'admin.js'),'utf8');
 for(const size of ['1200 × 1500 pixels','900 × 1200 pixels','1000 × 1200 pixels']) assert.ok(html.includes(size));
 assert.ok(js.includes('miniRecommendedSize'));
});
