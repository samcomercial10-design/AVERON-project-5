const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('desktop header groups labelled Menu and Search actions on the left',()=>{
  const js=fs.readFileSync('utilities.js','utf8');
  const css=fs.readFileSync('styles.css','utf8');
  assert.match(js,/dataset\.actionLabel='Menu'/);
  assert.match(js,/dataset\.actionLabel='Search'/);
  assert.match(css,/\.labelled-header-action::after\{content:attr\(data-action-label\)/);
});

test('category tiles use clean uppercase arrow labels',()=>{
  const css=fs.readFileSync('styles.css','utf8');
  assert.match(css,/\.cat-tile-info \.name::after\{content:" →"/);
  assert.match(css,/\.cat-tile-info \.caption\{display:none/);
});

test('empty bag is anchored to the bottom of the drawer',()=>{
  const css=fs.readFileSync('styles.css','utf8');
  assert.match(css,/\.cart-empty\{margin-top:auto/);
});

test('philosophy statement keeps the approved four-line composition',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert.match(html,/AVERON is built around<\/span><br\/><span>a simple idea: great style<\/span><br\/><span>does not need to demand<\/span><br\/><span>attention\./);
});

test('section rules follow their serif heading width and are slightly stronger',()=>{
  const css=fs.readFileSync('styles.css','utf8');
  assert.match(css,/section-head\{[\s\S]*width:fit-content;max-width:100%;margin-left:auto;margin-right:auto;/);
  assert.match(css,/height:1\.5px;flex:1;background:currentColor/);
  assert.match(css,/\.philosophy>\.wrap\{display:flex;flex-direction:column;align-items:center/);
});

test('header icons use charcoal and bag count remains visible at zero',()=>{
  const css=fs.readFileSync('styles.css','utf8');
  const js=fs.readFileSync('app.js','utf8');
  assert.match(css,/header\.site \.nav-left \.icon-btn,[\s\S]*color:#514e49/);
  assert.match(js,/\[data-cart-count\][\s\S]*node\.style\.display='flex'/);
});
