(function(){
  'use strict';
  const status=document.querySelector('[data-auth-callback-status]');
  const params=new URLSearchParams(location.hash.replace(/^#/,''));
  const query=new URLSearchParams(location.search);
  const safeNext=value=>/^(?:index|product|clothing|jackets|trousers|accessories|checkout|orders)\.html(?:[?#][^\s]*)?$/.test(String(value||''))?String(value):'index.html';
  async function finish(){
    const error=params.get('error_description')||params.get('error');
    if(error){status.textContent='Google sign-in was not completed. Returning to AVERON…';setTimeout(()=>location.replace('index.html?account=login'),1000);return;}
    const access_token=params.get('access_token'),refresh_token=params.get('refresh_token'),expires_in=params.get('expires_in');
    if(!access_token||!refresh_token){status.textContent='The Google sign-in response was incomplete. Please try again.';return;}
    history.replaceState(null,'',location.pathname+location.search);
    try{
      const response=await fetch('/api/auth/oauth/session',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({access_token,refresh_token,expires_in:Number(expires_in)||3600})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Unable to complete Google sign-in.');
      location.replace(safeNext(query.get('next')));
    }catch(err){status.textContent=err.message||'Unable to complete Google sign-in. Please return to AVERON and try again.';}
  }
  finish();
})();
