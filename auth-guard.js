/* AVERON — client-side auth throttling helper (defence-in-depth only)
   IMPORTANT: This is NOT real rate limiting. Anything running in the browser
   can be bypassed by an attacker. Production authentication must enforce
   limits on the server/identity-provider side.

   To use on a future login form, add:
     data-auth-form
     data-auth-submit to its submit button
     data-auth-status to an element used for status text

   The helper limits repeated submissions in this browser to reduce accidental
   rapid retries and simple scripted abuse against the UI. */
(function(){
  'use strict';
  const MAX_ATTEMPTS = 5;
  const WINDOW_MS = 15 * 60 * 1000;
  const LOCK_MS = 15 * 60 * 1000;
  const STORAGE_KEY = 'averon_auth_ui_throttle_v1';

  function now(){ return Date.now(); }
  function readState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const s = raw ? JSON.parse(raw) : null;
      if(!s || typeof s !== 'object') return {attempts:[], lockedUntil:0};
      const attempts = Array.isArray(s.attempts) ? s.attempts.filter(t => Number.isFinite(t) && now()-t < WINDOW_MS) : [];
      return {attempts, lockedUntil:Number(s.lockedUntil)||0};
    } catch(_){ return {attempts:[], lockedUntil:0}; }
  }
  function writeState(s){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch(_) {}
  }
  function clearExpired(s){
    const t=now();
    s.attempts=s.attempts.filter(x=>t-x<WINDOW_MS);
    if(s.lockedUntil && s.lockedUntil<=t) s.lockedUntil=0;
    return s;
  }
  function remainingSeconds(s){ return Math.max(0, Math.ceil((s.lockedUntil-now())/1000)); }
  function setStatus(form,msg){
    const el=form.querySelector('[data-auth-status]');
    if(el) el.textContent=msg;
  }
  function setDisabled(form,disabled){
    const btn=form.querySelector('[data-auth-submit]') || form.querySelector('button[type="submit"],input[type="submit"]');
    if(btn) btn.disabled=disabled;
  }
  function refresh(form){
    const s=clearExpired(readState());
    writeState(s);
    if(s.lockedUntil>now()){
      setDisabled(form,true);
      setStatus(form,`Too many attempts. Try again in ${remainingSeconds(s)} seconds.`);
      return false;
    }
    setDisabled(form,false);
    return true;
  }

  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('form[data-auth-form]').forEach(form=>{
      refresh(form);
      let timer=setInterval(()=>{ if(refresh(form)) clearInterval(timer); },1000);

      form.addEventListener('submit',e=>{
        const s=clearExpired(readState());
        if(s.lockedUntil>now()){
          e.preventDefault();
          setDisabled(form,true);
          setStatus(form,`Too many attempts. Try again in ${remainingSeconds(s)} seconds.`);
          return;
        }
        s.attempts.push(now());
        if(s.attempts.length>=MAX_ATTEMPTS){
          s.lockedUntil=now()+LOCK_MS;
          writeState(s);
          // Do not cancel this attempt; the server/IdP must decide whether it succeeds.
          setTimeout(()=>refresh(form),0);
        } else {
          writeState(s);
          const left=MAX_ATTEMPTS-s.attempts.length;
          setStatus(form,`${left} attempt${left===1?'':'s'} remaining before a temporary browser lock.`);
        }
      },true);
    });
  });

  // A successful server-side login may call this after authentication completes.
  window.AVERON_clearClientAuthThrottle=function(){
    try{ localStorage.removeItem(STORAGE_KEY); }catch(_){}
  };
})();
