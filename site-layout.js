/* AVERON Site Text — applies admin-authored copy only. Typography is fixed by the storefront design. */
(function(){
  'use strict';
  let snapshot={entries:{}};
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  function apply(){
    const entries=snapshot&&snapshot.entries&&typeof snapshot.entries==='object'?snapshot.entries:{};
    document.querySelectorAll('[data-layout-id]').forEach(el=>{
      const cfg=entries[el.dataset.layoutId];
      if(!cfg)return;
      if(typeof cfg.text==='string'&&el.textContent!==cfg.text){
        el.textContent=cfg.text;
        el.style.whiteSpace=cfg.text.includes('\\n')?'pre-line':'';
      }
    });
  }
  async function load(){
    try{
      if(window.AVERON_CONTENT_READY&&typeof window.AVERON_CONTENT_READY.then==='function')await window.AVERON_CONTENT_READY.catch(()=>{});
      const r=await fetch('/api/site-layout',{headers:{Accept:'application/json'},cache:'no-store'}),d=await r.json();
      if(r.ok&&d&&d.layout)snapshot=d.layout;
    }catch(err){console.warn('AVERON text sync failed; original copy retained.',err)}
    apply();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
  window.AVERON_SITE_LAYOUT={apply,reload:load,page};
})();
