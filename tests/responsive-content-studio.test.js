const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Content Studio separates desktop and mobile artwork',()=>{
 const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
 const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
 const content=fs.readFileSync(path.join(root,'content.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
 for(const label of ['Desktop Banners','Desktop Mini Banners','Mobile Banners','Mobile Mini Banners']) assert.ok(html.includes(label));
 assert.match(admin,/averon_content_mobile_v1/);assert.match(admin,/averon_mini_content_mobile_v1/);
 assert.match(content,/RESPONSIVE_BREAKPOINT=760/);assert.match(content,/matchMedia\('\(max-width:'\+RESPONSIVE_BREAKPOINT\+'px\)'\)/);
 assert.match(css,/aspect-ratio:1920\s*\/\s*750/);assert.match(css,/aspect-ratio:1080\s*\/\s*1500/);
 assert.ok(html.includes('1920 × 750 pixels'));
});
