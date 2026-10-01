/* AVERON — Stripe-hosted Checkout launcher. No secret keys belong in this file. */
(function(){
  'use strict';
  const S=window.AVERON_SECURITY;
  if(!S)return;

  const BUY_NOW_KEY='averon_buy_now';
  function isBuyNowCheckout(){try{return new URLSearchParams(location.search).get('buy_now')==='1'}catch(_){return false}}
  function getCheckoutItems(){
    if(isBuyNowCheckout()){
      try{const direct=S.cart(S.safeJson(sessionStorage.getItem(BUY_NOW_KEY)||'[]',[]));if(direct.length)return direct}catch(_){}
    }
    return S.cart(S.safeJson(localStorage.getItem('averon_cart')||'[]',[]));
  }
  function setStatus(message,isError){
    const node=document.querySelector('[data-checkout-status]');
    if(!node)return;
    node.textContent=message;
    node.classList.toggle('checkout-error',!!isError);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    const button=document.querySelector('[data-stripe-checkout]');
    if(!button)return;
    if(new URLSearchParams(location.search).get('cancelled')==='1')sessionStorage.removeItem('averon_checkout_attempt');
    if(new URLSearchParams(location.search).get('cancelled')==='1') setStatus('Payment was cancelled. Your bag is still here.',false);

    button.addEventListener('click',async()=>{
      const cart=getCheckoutItems();
      if(!cart.length){setStatus('Your bag is empty.',true);return;}
      button.disabled=true;
      button.setAttribute('aria-busy','true');
      const original=button.textContent;
      button.textContent='Opening secure payment…';
      setStatus('Preparing your secure Stripe checkout…',false);
      try{
        const authResponse=await fetch('/api/auth/session',{headers:{Accept:'application/json'},cache:'no-store'});
        const auth=await authResponse.json().catch(()=>({}));
        if(!auth.authenticated){
          const next=isBuyNowCheckout()?'checkout.html?buy_now=1':'checkout.html';
          sessionStorage.setItem('averon_login_return',next);
          location.assign('index.html?account=login&next='+encodeURIComponent(next));
          return;
        }
        const cartKey=JSON.stringify(cart.map(i=>({id:i.id,qty:i.qty,size:i.size,colour:i.colour})));
        let attempt;try{attempt=JSON.parse(sessionStorage.getItem('averon_checkout_attempt')||'null')}catch(_){}
        if(!attempt||attempt.cart!==cartKey||Date.now()-attempt.time>1800000){attempt={cart:cartKey,id:crypto.randomUUID(),time:Date.now()};sessionStorage.setItem('averon_checkout_attempt',JSON.stringify(attempt));}
        const response=await fetch('/api/create-checkout-session',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({attempt_id:attempt.id,items:cart.map(i=>({id:i.id,qty:i.qty,size:i.size,colour:i.colour}))})
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok||!data.url)throw new Error(data.error||'Unable to start checkout.');
        location.assign(data.url);
      }catch(err){
        setStatus(err.message||'Unable to start secure checkout. Please try again.',true);
        button.disabled=false;
        button.removeAttribute('aria-busy');
        button.textContent=original;
      }
    });
  });
})();
