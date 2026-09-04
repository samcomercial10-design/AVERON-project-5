const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('mini banner previews mirror exact desktop and mobile slot proportions',()=>{
  const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
  const js=fs.readFileSync(path.join(root,'admin.js'),'utf8');
  assert.match(html,/id="mini-preview-wrap"/);
  assert.match(html,/id="mini-preview-note"/);
  assert.match(js,/1200 × 1500 pixels · vertical/);
  assert.match(js,/900 × 1200 pixels · vertical/);
  assert.match(js,/1000 × 1200 pixels · vertical/);
  assert.match(js,/1080 × 1350 pixels · vertical/);
  assert.match(js,/preview\.style\.aspectRatio/);
});
