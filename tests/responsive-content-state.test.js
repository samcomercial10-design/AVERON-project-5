const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('desktop and mobile banner state stay isolated and refresh across tabs',()=>{
 const content=fs.readFileSync(path.join(root,'content.js'),'utf8');
 const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');

 assert.match(content,/RESPONSIVE_BREAKPOINT=760/);
 assert.match(content,/window\.addEventListener\('storage'/);
 assert.match(content,/visibilitychange/);
 assert.match(admin,/function reloadBannerStores/);
 assert.match(admin,/function reloadMiniStores/);
 assert.match(admin,/image:draft\.removeImage\?'':S\.imageSrc\(draft\.image\)/);

 assert.match(css,/@media \(min-width: 761px\)\{\s*\.hero,/);
 assert.match(css,/@media \(max-width: 760px\)\{\s*\.hero,/);
 assert.doesNotMatch(css,/@media \(min-width: 769px\)\{\s*\.hero,/);
 assert.doesNotMatch(css,/@media \(max-width: 768px\)\{\s*\.hero,/);
});
