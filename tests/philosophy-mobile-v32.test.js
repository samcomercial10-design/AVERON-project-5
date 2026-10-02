
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


test('drawer title + close-button standard v43 matches search heading scale and close geometry',()=>{
  const root=path.join(__dirname,'..');
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert.match(css,/drawer title \+ close-button standard v43/);
  assert.match(css,/font-size:11px !important/);
  assert.match(css,/font-size:26px !important/);
  assert.match(css,/\.utility-close,[\s\S]*?\.cart-close,[\s\S]*?width:38px !important/);
  assert.match(css,/\.cart-head\{[\s\S]*?min-height:112px !important/);
});


test('footer cleanup v47 removes deprecated links and location-specific copy',()=>{
  const root=path.join(__dirname,'..');
  const files=['index.html','clothing.html','jackets.html','trousers.html','accessories.html','product.html','edit.html'].filter(f=>fs.existsSync(path.join(root,f)));
  for(const f of files){
    const html=fs.readFileSync(path.join(root,f),'utf8');
    assert.doesNotMatch(html,/>Bestsellers<\/a>/);
    assert.doesNotMatch(html,/>FAQ<\/a>/);
    assert.doesNotMatch(html,/>About<\/h5>/);
    assert.doesNotMatch(html,/Designed in London for everyday confidence\./);
  }
  const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(home,/Timeless menswear for everyday confidence\. Refined essentials, designed to move effortlessly through modern life\./);
});


test('footer locale cleanup v48 keeps only copyright in footer bottom',()=>{
  const rootDir = path.join(__dirname,'..');
  const files = ['index.html','clothing.html','jackets.html','trousers.html','accessories.html','product.html','checkout.html','wishlist.html'].filter(f=>fs.existsSync(path.join(rootDir,f)));
  for(const f of files){
    const html=fs.readFileSync(path.join(rootDir,f),'utf8');
    const m = html.match(/<div class="footer-locale">([\s\S]*?)<\/div>/i);
    if(!m) continue;
    assert.doesNotMatch(m[1], /United Kingdom/i);
    assert.doesNotMatch(m[1], /£\s*GBP/i);
    assert.match(m[1], /2026 AVERON/i);
  }
});


test('buy now uses an independent one-off checkout payload',()=>{
  const root=path.join(__dirname,'..');
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const stripe=fs.readFileSync(path.join(root,'stripe-checkout.js'),'utf8');
  const pdp=fs.readFileSync(path.join(root,'product-page.js'),'utf8');
  assert.match(app,/const BUY_NOW_KEY='averon_buy_now'/);
  assert.match(app,/sessionStorage\.setItem\(BUY_NOW_KEY,JSON\.stringify\(\[item\]\)\)/);
  assert.doesNotMatch(app,/async function buyNow\(raw\)\{[\s\S]{0,500}addToCart\(raw/);
  assert.match(app,/const target='checkout\.html\?buy_now=1'/);
  assert.match(app,/function checkoutItems\(\)/);
  assert.match(stripe,/function getCheckoutItems\(\)/);
  assert.match(stripe,/sessionStorage\.getItem\(BUY_NOW_KEY\)/);
  assert.match(pdp,/function currentPurchasePayload\(\)/);
  assert.match(pdp,/buyNowButtons\.forEach/);
  assert.match(pdp,/btn\.dataset\.authBypass='true'/);
  assert.match(pdp,/window\.AVERON_buyNow\?\.\(currentPurchasePayload\(\)\)/);
});


test('mobile buy now direct checkout parity v51 binds every Buy Now CTA to the independent checkout flow',()=>{
  const root=path.join(__dirname,'..');
  const pdp=fs.readFileSync(path.join(root,'product-page.js'),'utf8');
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  assert.match(pdp,/querySelectorAll\('\[data-layout-id=\"product-buy-now\"\]'\)/);
  assert.match(pdp,/window\.AVERON_buyNow\?\.\(currentPurchasePayload\(\)\)/);
  assert.doesNotMatch(pdp,/matchMedia|innerWidth|mobile.*AVERON_buyNow/i);
  assert.match(app,/sessionStorage\.setItem\(BUY_NOW_KEY/);
  assert.match(app,/checkout\.html\?buy_now=1/);
});
