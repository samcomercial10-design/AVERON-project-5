/* AVERON catalogue sync — server catalogue is authoritative. */
(function(){
  'use strict';
  const S=window.AVERON_SECURITY,KEY='averon_products_v1';

  function lightweightCache(products){
    return products.map(p=>({
      ...p,
      coverImage:'',
      images:[],
      colourImagery:[],
      materialCraft:{...(p.materialCraft||{}),images:[]}
    }));
  }

  async function load(){
    if(!S)return [];
    try{
      const r=await fetch('/api/catalog',{headers:{Accept:'application/json'},cache:'no-store'});
      const data=await r.json();
      if(!r.ok||!Array.isArray(data.products))throw new Error(data.error||'Catalogue unavailable');
      const products=S.products(data.products,[]);
      window.AVERON_PRODUCTS=products;
      try{localStorage.setItem(KEY,JSON.stringify(lightweightCache(products)))}catch(_){}
      window.dispatchEvent(new CustomEvent('averon:catalogue-updated',{detail:{products}}));
      return products;
    }catch(err){
      console.warn('AVERON catalogue server sync failed; using lightweight browser fallback.',err);
      const fallback=S.products(S.safeJson(localStorage.getItem(KEY)||'null',null),[]);
      window.AVERON_PRODUCTS=fallback;
      return fallback;
    }
  }
  window.AVERON_CATALOGUE_READY=load();
})();