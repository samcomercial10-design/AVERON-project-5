const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('City and Weekend Edit banners have no decorative corner ticks',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const city=html.match(/<div class="ph" data-mini-media="city-edit">([\s\S]*?)<\/div>/);
  const weekend=html.match(/<div class="ph" data-mini-media="weekend-edit">([\s\S]*?)<\/div>/);
  assert.ok(city);
  assert.ok(weekend);
  assert.doesNotMatch(city[1],/class="tick/);
  assert.doesNotMatch(weekend[1],/class="tick/);
});

test('custom mini banners suppress placeholder corner decorations',()=>{
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert.match(css,/\.ph\.has-custom-mini>\.tick/);
  assert.match(css,/display:none!important/);
});
