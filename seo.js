/* AVERON SEO metadata and structured data. Domain-aware without hard-coding a production hostname. */
(function(){
  'use strict';
  function absolute(path){try{return new URL(path, location.href).href}catch(_){return path}}
  function canonical(path){
    const link=document.createElement('link');link.rel='canonical';link.href=absolute(path||location.pathname+location.search);document.head.appendChild(link);return link.href;
  }
  function meta(selector,attrs){let el=document.head.querySelector(selector);if(!el){el=document.createElement('meta');document.head.appendChild(el)}Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));return el}
  function setSocial(title,description,url,image){
    meta('meta[property="og:title"]',{property:'og:title',content:title});meta('meta[property="og:description"]',{property:'og:description',content:description});meta('meta[property="og:url"]',{property:'og:url',content:url});
    meta('meta[name="twitter:title"]',{name:'twitter:title',content:title});meta('meta[name="twitter:description"]',{name:'twitter:description',content:description});
    if(image){meta('meta[property="og:image"]',{property:'og:image',content:image});meta('meta[name="twitter:image"]',{name:'twitter:image',content:image})}
  }
  function jsonLd(id,data){let s=document.getElementById(id);if(!s){s=document.createElement('script');s.type='application/ld+json';s.id=id;document.head.appendChild(s)}s.textContent=JSON.stringify(data)}
  const page=document.body?.dataset.seoPage;
  if(page==='home'){
    const url=canonical('index.html');const title='AVERON | Modern British Menswear';const desc='Refined casual menswear with a timeless British attitude.';setSocial(title,desc,url,absolute('assets/logo-navy.png'));
    jsonLd('averon-org-jsonld',{'@context':'https://schema.org','@type':'Organization',name:'AVERON',url:url,logo:absolute('assets/logo-navy.png'),description:desc});
    jsonLd('averon-site-jsonld',{'@context':'https://schema.org','@type':'WebSite',name:'AVERON',url:url,inLanguage:'en-GB'});
  } else if(page==='product') {
    canonical(location.pathname+location.search);
    window.addEventListener('averon:product-rendered',ev=>{
      const p=ev.detail||{};const name=String(p.name||'AVERON Product'),cat=String(p.category||'Menswear'),colour=String(p.colour||''),desc=String(p.description||`Discover ${name} by AVERON. Refined modern menswear for the United Kingdom.`).slice(0,220);const title=`${name}${colour?' — '+colour:''} | AVERON`;
      document.title=title;const d=document.querySelector('meta[name="description"]');if(d)d.content=desc;const url=absolute(location.pathname+location.search);let image='';if(Array.isArray(p.images)&&p.images[0]&&!String(p.images[0]).startsWith('data:'))image=absolute(p.images[0]);setSocial(title,desc,url,image);
      const product={'@context':'https://schema.org','@type':'Product',name,description:desc,sku:String(p.id||''),category:cat,brand:{'@type':'Brand',name:'AVERON'},offers:{'@type':'Offer',url,priceCurrency:'GBP',price:Number(p.price||0).toFixed(2),availability:'https://schema.org/InStock',itemCondition:'https://schema.org/NewCondition'}};if(image)product.image=[image];jsonLd('averon-product-jsonld',product);
      const catPath=cat.toLowerCase()==='jackets'?'jackets.html':cat.toLowerCase()==='trousers'?'trousers.html':cat.toLowerCase()==='accessories'?'accessories.html':'clothing.html';jsonLd('averon-breadcrumb-jsonld',{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:absolute('index.html')},{'@type':'ListItem',position:2,name:cat,item:absolute(catPath)},{'@type':'ListItem',position:3,name:name,item:url}]});
    });
  } else if(page==='collection') {
    const title=document.title,desc=document.querySelector('meta[name="description"]')?.content||'';const url=canonical(location.pathname);setSocial(title,desc,url,absolute('assets/logo-navy.png'));
    const heading=document.querySelector('h1')?.textContent?.trim()||'AVERON Collection';jsonLd('averon-collection-jsonld',{'@context':'https://schema.org','@type':'CollectionPage',name:heading,description:desc,url,inLanguage:'en-GB'});
  }
})();
