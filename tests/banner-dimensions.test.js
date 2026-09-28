const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');

test('desktop hero/editorial banners and admin use 1920 x 750 guidance',()=>{
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  const admin=fs.readFileSync(path.join(root,'admin.html'),'utf8');
  assert.match(css,/aspect-ratio\s*:\s*1920\s*\/\s*750/);
  assert.match(admin,/1920\s*[×x]\s*750\s*pixels/i);
});

test('uploaded main banners overscan their frame to prevent subpixel seams',()=>{
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert.match(css,/\[data-content-banner\]\s*>\s*\[data-banner-media\]\.has-custom-banner\s*\{/);
  assert.match(css,/inset\s*:\s*-1px\s+0\s*!important/);
  assert.match(css,/background-size\s*:\s*100%\s+100%\s*!important/);
});
