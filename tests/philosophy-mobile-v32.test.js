
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('mobile philosophy uses the four approved exact lines',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');

  assert.match(
    html,
    /<span>AVERON is built around<\/span><br\/><span>a simple idea: great style<\/span><br\/><span>does not need to demand<\/span><br\/><span>attention\.<\/span>/
  );
  assert.match(css,/philosophy exact mobile line breaks v35/);
  assert.match(css,/\.philosophy \.philosophy-statement span\{[\s\S]*?display:block !important;[\s\S]*?white-space:nowrap !important;/);
});


test('menu/wishlist refinement v36 preserves approved controls and styling hooks',()=>{
  const root=path.join(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  const js=fs.readFileSync(path.join(root,'utilities.js'),'utf8');
  assert.match(html,/data-open-search/);
  assert.match(html,/data-open-account/);
  assert.match(html,/data-open-wishlist/);
  assert.match(css,/side menu \+ wishlist visual refinement v36/);
  assert.match(js,/function syncMenuProfile\(\)/);
  assert.match(js,/wishlist-empty-state/);
  assert.match(js,/<svg viewBox="0 0 32 32"/);
});


test('exact reference menu + wishlist refinement v37 keeps profile navigation and wishlist hierarchy',()=>{
  const root=path.join(__dirname,'..');
  const js=fs.readFileSync(path.join(root,'utilities.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');

  assert.match(css,/exact reference menu \+ wishlist refinement v37/);
  assert.match(css,/\.mobile-menu nav a::after\{[\s\S]*?position:static !important/);
  assert.match(css,/\.mobile-menu-foot\{[\s\S]*?margin-top:26px !important/);
  assert.match(css,/\.wishlist-empty-state \.empty-heart svg\{[\s\S]*?width:27px !important/);
  assert.match(js,/profile\.addEventListener\('click'/);
  assert.match(js,/renderAccount\(accountState\.authenticated\?'auto':'login'\)/);
});


test('side menu reference correction v38 refreshes account profile on every open',()=>{
  const root=path.join(__dirname,'..');
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const util=fs.readFileSync(path.join(root,'utilities.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert.match(app,/averon:menu-open/);
  assert.match(util,/addEventListener\('averon:menu-open'/);
  assert.match(util,/await loadAccountSession\(\);syncMenuProfile\(\)/);
  assert.match(css,/side menu reference correction v38/);
  assert.match(css,/width:calc\(100vw - 44px\) !important/);
});


test('side menu action row does not clip the wishlist button on mobile',()=>{
  const root=path.join(__dirname,'..');
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert.match(css,/side menu action-row overflow fix v39/);
  assert.match(css,/\.mobile-menu-foot\{[\s\S]*?width:100% !important;[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\) !important;/);
  assert.match(css,/\.mobile-menu \.mobile-utility-btn\{[\s\S]*?width:100% !important;[\s\S]*?min-width:0 !important;/);
});
