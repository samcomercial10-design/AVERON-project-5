const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('Content Studio preview mirrors desktop and mobile banner orientation',()=>{
 const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'admin.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
 assert.match(html,/aspect-ratio:1920\/750/);
 assert.match(html,/aspect-ratio:1080\/1500/);
 assert.match(html,/id="banner-preview-wrap"/);
 assert.match(js,/Mobile preview · 1080 × 1500 pixels · vertical/);
 assert.match(js,/Desktop preview · 1920 × 750 pixels · horizontal/);
 assert.match(css,/aspect-ratio:1920 \/ 750/);
 assert.match(css,/aspect-ratio:1080 \/ 1500/);
});
