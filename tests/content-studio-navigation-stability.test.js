const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('Content Studio navigation is delegated and legacy removed controls cannot abort initialization',()=>{
  const js=fs.readFileSync(path.join(root,'admin.js'),'utf8');

  assert.doesNotMatch(js,/\$\('banner-overlay-enabled'\)\.addEventListener/);
  assert.doesNotMatch(js,/\['banner-eyebrow','banner-title','banner-subtitle','banner-button-text','banner-button-link'\]\.forEach/);

  assert.match(js,/document\.addEventListener\('click'/);
  assert.match(js,/closest\('\[data-admin-tab\]'\)/);
  assert.match(js,/try\{showPanel\(name\)\}/);
  assert.match(js,/const targetPanel=panels\.find/);
});
