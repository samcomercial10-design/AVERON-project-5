const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('large banners are artwork plus hotspots only',()=>{
 const admin=fs.readFileSync(path.join(root,'admin.html'),'utf8');
 const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const content=fs.readFileSync(path.join(root,'content.js'),'utf8');
 ['banner-overlay-enabled','banner-eyebrow','banner-title','banner-subtitle','banner-button-text','banner-button-link'].forEach(id=>assert.ok(!admin.includes('id="'+id+'"')));
 assert.ok(!index.includes('data-banner-eyebrow="hero"'));
 assert.ok(!index.includes('data-banner-title="hero"'));
 assert.ok(!index.includes('data-banner-button="hero"'));
 assert.ok(!index.includes('data-banner-eyebrow="editorial"'));
 assert.ok(!index.includes('data-banner-title="editorial"'));
 assert.ok(!index.includes('data-banner-button="editorial"'));
 assert.match(content,/banner-click-hotspot/);
});
