
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

test('checkout approved refinement is preserved',()=>{
  const html=read('checkout.html');
  assert.match(html,/checkout-bag">Bag<\/span><span class="sep" aria-hidden="true">→<\/span>/);
  assert.match(html,/checkout-footer-copyright/);
  assert.doesNotMatch(html,/checkout-united-kingdom/);
});

test('clean PDP desktop rules remain present',()=>{
  const css=read('styles.css');
  assert.match(css,/AVERON — Product page desktop refinement \+ clean PDP \(v20\)/);
  assert.match(css,/\.pdp-info > \.eyebrow,\s*\.pdp-rating,\s*\.pdp-shipping-note\{display:none!important\}/);
  assert.match(css,/\.accordion-item:nth-child\(n\+4\)\{display:none\}/);
});

test('large serif/display headings stay uppercase',()=>{
  const css=read('styles.css');
  assert.match(css,/stable serif caps \+ breadcrumb guard v31/);
  assert.match(css,/text-transform:uppercase !important;/);
});

test('breadcrumbs use chevrons on collection, edit and product pages',()=>{
  for(const file of ['clothing.html','trousers.html','jackets.html','accessories.html','edit.html','product.html']){
    const html=read(file);
    assert.match(html,/breadcrumb-separator">›<\/li>/);
    assert.doesNotMatch(html,/<li aria-hidden="true">\/<\/li>/);
  }
});

test('edit page does not repeat The AVERON Edit eyebrow',()=>{
  const html=read('edit.html');
  assert.doesNotMatch(html,/data-layout-id="edit-the-averon-edit"/);
});

test('mobile edit inherits desktop linked products when mobile selection is empty',()=>{
  const c=read('content.js');
  const e=read('edit-page.js');
  assert.match(c,/mobile editorial[\s\S]*inherit the desktop selection/i);
  assert.match(e,/desktopSynced/);
});

test('sale percentage and previous price are rendered in all special product-card renderers',()=>{
  for(const file of ['edit-page.js','product-page.js']){
    const src=read(file);
    assert.match(src,/card-sale-badge',`↓\$\{discount\}%`/);
    assert.match(src,/card-previous-price/);
  }
});
