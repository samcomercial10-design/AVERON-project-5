(()=>{'use strict';
const form=document.getElementById('reset-form'),submit=document.getElementById('reset-submit'),message=document.getElementById('reset-message'),success=document.getElementById('reset-success'),invalid=document.getElementById('reset-invalid'),invalidCopy=document.getElementById('reset-invalid-copy');
const hash=new URLSearchParams(location.hash.slice(1));
const accessToken=String(hash.get('access_token')||'');
const type=String(hash.get('type')||'');
const errorDescription=String(hash.get('error_description')||hash.get('error')||'').replace(/\+/g,' ');
function showInvalid(text){form.classList.add('hidden');invalid.classList.remove('hidden');if(text)invalidCopy.textContent=text;history.replaceState(null,'',location.pathname);}
if(errorDescription){showInvalid(errorDescription)}else if(!accessToken||type!=='recovery'){showInvalid('This password reset link is invalid or has expired. Request a new reset link from the AVERON sign-in screen.')}else{history.replaceState(null,'',location.pathname);}
form?.addEventListener('submit',async e=>{e.preventDefault();message.textContent='';message.classList.remove('success');const password=document.getElementById('new-password').value,confirm=document.getElementById('confirm-password').value;if(password.length<8){message.textContent='Use at least 8 characters for your new password.';return}if(password!==confirm){message.textContent='The passwords do not match.';return}submit.disabled=true;try{const r=await fetch('/api/auth/password/update',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({access_token:accessToken,password}),cache:'no-store'});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Unable to update your password.');form.classList.add('hidden');success.classList.remove('hidden')}catch(err){message.textContent=err.message||'Unable to update your password.';submit.disabled=false}});
})();
