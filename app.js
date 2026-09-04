/* AVERON — shared behaviour (hardened static preview) */
(function(){
  'use strict';
  const S = window.AVERON_SECURITY;
  if(!S) throw new Error('security.js must load before app.js');
  const FREE_DELIVERY = 75;
  const state = {
    cart: S.cart(S.safeJson(localStorage.getItem('averon_cart') || '[]', [])),
    wishlist: S.wishlist(S.safeJson(localStorage.getItem('averon_wishlist') || '[]', []))
  };

  function persist(){
    try {
      localStorage.setItem('averon_cart', JSON.stringify(state.cart));
      localStorage.setItem('averon_wishlist', JSON.stringify(state.wishlist));
    } catch (_) {}
  }
  function money(n){ return '£' + S.price(n).toFixed(2); }
  function subtotal(){ return state.cart.reduce((sum,item)=>sum + S.price(item.price)*S.qty(item.qty),0); }

  function phThumb(){
    const ph=S.el('div','ph light');
    ph.append(S.el('div','tick tl'),S.el('div','tick br'));
    return ph;
  }
  function catalogueImage(productId){
    try{
      const raw=Array.isArray(window.AVERON_PRODUCTS)&&window.AVERON_PRODUCTS.length?window.AVERON_PRODUCTS:S.safeJson(localStorage.getItem('averon_products_v1')||'[]',[]);
      const products=S.products(raw,[]);
      const p=products.find(x=>x.id===S.id(productId));
      return p ? (S.imageSrc(p.coverImage)||S.imageSrc(p.images?.[0])) : '';
    }catch(_){ return ''; }
  }
  function cartThumb(item){
    const src=S.imageSrc(item?.image)||catalogueImage(item?.id);
    if(!src)return phThumb();
    const frame=S.el('div','cart-item-thumb');
    const img=document.createElement('img');
    img.src=src;img.alt=item?.name?`${item.name} thumbnail`:'Product thumbnail';
    img.loading='lazy';img.decoding='async';
    frame.appendChild(img);
    return frame;
  }
  function makeQtyButton(label, attr, index){
    const b=S.el('button','',label); b.type='button'; b.setAttribute(attr,String(index));
    b.setAttribute('aria-label', label==='+'?'Increase quantity':'Decrease quantity'); return b;
  }
  function renderCart(){
    /* Totals and checkout summary must render even on pages that do not include
       the cart drawer (notably checkout.html). Previously this function returned
       early when [data-cart-items] was absent, leaving checkout at £0.00. */
    const sub=subtotal(), remaining=Math.max(0,FREE_DELIVERY-sub), pct=Math.min(100,(sub/FREE_DELIVERY)*100);
    const delivery=sub===0?0:(sub>=FREE_DELIVERY?0:4.95);
    document.querySelectorAll('[data-cart-count]').forEach(node=>{const n=state.cart.reduce((s,i)=>s+i.qty,0);node.textContent=String(n);node.style.display=n?'flex':'none'});
    document.querySelectorAll('[data-free-fill]').forEach(node=>node.style.width=pct+'%');
    document.querySelectorAll('[data-free-msg]').forEach(node=>node.textContent=remaining>0?`You're £${remaining.toFixed(2)} away from free standard delivery.`:`You've unlocked free standard delivery.`);
    document.querySelectorAll('[data-subtotal]').forEach(node=>node.textContent=money(sub));
    document.querySelectorAll('[data-delivery]').forEach(node=>node.textContent=sub===0?'—':(delivery===0?'Free':money(delivery)));
    document.querySelectorAll('[data-total]').forEach(node=>node.textContent=money(sub+delivery));
    renderCheckoutSummary();

    const list=document.querySelector('[data-cart-items]');
    const empty=document.querySelector('[data-cart-empty]');
    const foot=document.querySelector('[data-cart-foot]');
    if(!list) return;
    list.replaceChildren();
    if(!state.cart.length){ if(empty) empty.style.display='block'; if(foot) foot.style.display='none'; }
    else {
      if(empty) empty.style.display='none'; if(foot) foot.style.display='block';
      state.cart.forEach((item,idx)=>{
        const row=S.el('div','cart-item'); row.appendChild(cartThumb(item));
        const info=S.el('div','cart-item-info');
        info.append(S.el('div','name',item.name), S.el('div','opt',`${item.colour} · Size ${item.size}`));
        const line=S.el('div','row'); const step=S.el('div','qty-stepper');
        step.append(makeQtyButton('–','data-dec',idx),S.el('span','',String(item.qty)),makeQtyButton('+','data-inc',idx));
        line.append(step,S.el('span','',money(item.price*item.qty))); info.appendChild(line);
        const remove=S.el('button','cart-item-remove','Remove'); remove.type='button'; remove.dataset.remove=String(idx); info.appendChild(remove);
        row.appendChild(info); list.appendChild(row);
      });
    }
    list.querySelectorAll('[data-inc]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.inc);if(state.cart[i]) state.cart[i].qty=S.qty(state.cart[i].qty+1);persist();renderCart()}));
    list.querySelectorAll('[data-dec]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.dec);if(!state.cart[i])return;state.cart[i].qty--;if(state.cart[i].qty<=0)state.cart.splice(i,1);persist();renderCart()}));
    list.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.remove);if(Number.isInteger(i))state.cart.splice(i,1);persist();renderCart()}));
  }

  function renderCheckoutSummary(){
    const box=document.querySelector('[data-order-lines]'); if(!box)return; box.replaceChildren();
    if(!state.cart.length){const p=S.el('p','body','Your bag is empty.');p.style.padding='10px 0';box.appendChild(p);return;}
    state.cart.forEach(item=>{
      const row=S.el('div','order-line checkout-summary-line');
      const qty=S.el('span','checkout-summary-qty',`${item.qty}x`);
      const copy=S.el('div','order-line-info checkout-summary-copy');
      copy.append(S.el('div','name checkout-summary-name',item.name));
      const options=[item.colour,item.size?`Size: ${item.size}`:''].filter(Boolean).join(' · ');
      if(options) copy.append(S.el('div','opt checkout-summary-opt',options));
      const price=S.el('span','checkout-summary-price',money(item.price*item.qty));
      row.append(qty,copy,price);
      box.appendChild(row);
    });
  }

  function addToCart(raw){
    const enriched={...(raw||{})};
    if(!enriched.image)enriched.image=catalogueImage(enriched.id);
    const item=S.cartItem(enriched); if(!item)return;
    const existing=state.cart.find(i=>i.id===item.id&&i.size===item.size&&i.colour===item.colour);
    if(existing){
      existing.qty=S.qty(existing.qty+item.qty);
      if(!existing.image&&item.image)existing.image=item.image;
    }else state.cart.push(item);
    persist();renderCart();openCart();
  }
  window.AVERON_addToCart=addToCart;

  function syncWishlistUI(){
    document.querySelectorAll('[data-wishlist-btn]').forEach(btn=>{
      const pid=S.id(btn.dataset.wishlistBtn);
      const active=!!pid&&state.wishlist.includes(pid);
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-pressed',active?'true':'false');
      const label=btn.classList.contains('pdp-wishlist-link')
        ? (active?'Remove from Wishlist':'Add to Wishlist')
        : (active?'Remove from wishlist':'Add to wishlist');
      btn.setAttribute('aria-label',label);
      if(btn.classList.contains('pdp-wishlist-link')){
        const text=[...btn.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
        if(text) text.textContent=' '+label;
      }
    });
    document.querySelectorAll('[data-wishlist-count]').forEach(node=>{
      node.textContent=String(state.wishlist.length);
      node.style.display=state.wishlist.length?'flex':'none';
    });
  }

  function toggleWishlist(rawId){
    const pid=S.id(rawId);
    if(!pid)return false;
    const i=state.wishlist.indexOf(pid);
    if(i>-1)state.wishlist.splice(i,1);else state.wishlist.push(pid);
    state.wishlist=S.wishlist(state.wishlist);
    persist();
    syncWishlistUI();
    window.dispatchEvent(new CustomEvent('averon:wishlist-changed',{detail:{ids:[...state.wishlist],changedId:pid,active:state.wishlist.includes(pid)}}));
    return state.wishlist.includes(pid);
  }
  window.AVERON_toggleWishlist=toggleWishlist;
  window.AVERON_syncWishlistUI=syncWishlistUI;

  function openCart(){document.querySelector('[data-cart-drawer]')?.classList.add('open');document.querySelector('[data-overlay]')?.classList.add('open');document.body.style.overflow='hidden'}
  function closeCart(){document.querySelector('[data-cart-drawer]')?.classList.remove('open');document.querySelector('[data-overlay]')?.classList.remove('open');document.body.style.overflow=''}
  window.AVERON_openCart=openCart;

  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('[data-open-cart]').forEach(b=>b.addEventListener('click',openCart));
    document.querySelectorAll('[data-close-cart]').forEach(b=>b.addEventListener('click',closeCart));
    document.querySelector('[data-overlay]')?.addEventListener('click',closeCart);
    const menu=document.querySelector('[data-mobile-menu]');
    document.querySelectorAll('[data-open-menu]').forEach(b=>b.addEventListener('click',()=>menu?.classList.add('open')));
    document.querySelectorAll('[data-close-menu]').forEach(b=>b.addEventListener('click',()=>menu?.classList.remove('open')));
    // One delegated handler keeps static and dynamically-rendered wishlist buttons in sync.
    document.addEventListener('click',e=>{
      const btn=e.target.closest('[data-wishlist-btn]');
      if(!btn)return;
      e.preventDefault();
      toggleWishlist(btn.dataset.wishlistBtn);
    });
    syncWishlistUI();
    document.addEventListener('click',e=>{
      const btn=e.target.closest('[data-quickadd]');
      if(!btn || e.defaultPrevented)return;
      e.preventDefault();
      const d=btn.dataset;
      addToCart({id:d.quickadd,name:d.name,price:d.price,colour:'Navy',size:'M',qty:1});
    });
    document.querySelectorAll('.accordion-trigger').forEach(t=>t.addEventListener('click',()=>t.parentElement.classList.toggle('open')));
    if('IntersectionObserver' in window){const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.14});document.querySelectorAll('.reveal').forEach(el=>io.observe(el));}
    else document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in'));
    const stickyBtn=document.querySelector('.sticky-add'),pdpCta=document.querySelector('[data-pdp-cta-anchor]');
    if(stickyBtn&&pdpCta&&'IntersectionObserver' in window){const io2=new IntersectionObserver(([entry])=>stickyBtn.classList.toggle('show',!entry.isIntersecting),{threshold:0});io2.observe(pdpCta)}
    renderCart();
    document.querySelectorAll('form[data-demo-form]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();const status=f.querySelector('[data-demo-status]')||document.querySelector('[data-checkout-status]');if(status)status.textContent='Preview only — no personal or payment data was sent or stored.'; if(f.matches('.newsletter-form')||f.closest('.checkout-page')) f.reset();}));
  });
})();
