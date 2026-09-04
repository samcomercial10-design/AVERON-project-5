/* AVERON — Stripe-hosted Checkout launcher. No secret keys belong in this file. */
(function(){
  'use strict';
  const S=window.AVERON_SECURITY;
  if(!S)return;

  function getCart(){return S.cart(S.safeJson(localStorage.getItem('averon_cart')||'[]',[]));}
  function setStatus(message,isError){
    const node=document.querySelector('[data-checkout-status]');
    if(!node)return;
    node.textContent=message;
    node.classList.toggle('checkout-error',!!isError);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    const button=document.querySelector('[data-stripe-checkout]');
    if(!button)return;
    if(new URLSearchParams(location.search).get('cancelled')==='1') setStatus('Payment was cancelled. Your bag is still here.',false);

    button.addEventListener('click',async()=>{
      const cart=getCart();
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
          sessionStorage.setItem('averon_login_return','checkout.html');
          location.assign('index.html?account=login&next=checkout.html');
          return;
        }
        const response=await fetch('/api/create-checkout-session',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({items:cart.map(i=>({id:i.id,qty:i.qty,size:i.size,colour:i.colour}))})
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
