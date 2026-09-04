/* AVERON homepage content — responsive desktop/mobile content layer. */
(function(){
  'use strict';
  const S=window.AVERON_SECURITY;if(!S)return;
  const KEY='averon_content_v1',MOBILE_KEY='averon_content_mobile_v1';
  const MINI_KEY='averon_mini_content_v1',MOBILE_MINI_KEY='averon_mini_content_mobile_v1';
  const DEFAULTS={
    hero:{eyebrow:'British Menswear · Est. Modern',title:'DEFINED BY\nSIMPLICITY.',subtitle:'Modern menswear with a timeless British attitude.',buttonText:'Shop New In',buttonLink:'#new-in',image:'',overlayEnabled:true,hotspot:{enabled:false,link:'',x:58,y:68,w:24,h:12}},
    editorial:{eyebrow:'Timeless by Design',title:'Timeless by Design.',subtitle:'Designed to move effortlessly between the city and the weekend.',buttonText:'Explore the Edit',buttonLink:'index.html#collection',image:'',overlayEnabled:true,hotspot:{enabled:false,link:'',x:58,y:68,w:24,h:12}}
  };
  const MINI_DEFAULTS={
    intro:{eyebrow:'The Art of Understatement',title:'Refined essentials,\nconsidered details.',subtitle:'Refined essentials, considered details and timeless silhouettes — designed for modern British living. Nothing shouts. Everything is deliberate.',buttonText:'',buttonLink:'',image:'',linkedProducts:[]},
    'category-clothing':{eyebrow:'Shop',title:'Clothing',subtitle:'',buttonText:'',buttonLink:'clothing.html',image:''},
    'category-jackets':{eyebrow:'Shop',title:'Jackets',subtitle:'',buttonText:'',buttonLink:'jackets.html',image:''},
    'category-trousers':{eyebrow:'Shop',title:'Trousers',subtitle:'',buttonText:'',buttonLink:'trousers.html',image:''},
    'category-accessories':{eyebrow:'Shop',title:'Accessories',subtitle:'',buttonText:'',buttonLink:'accessories.html',image:''},
    'city-edit':{eyebrow:'',title:'The City Edit',subtitle:'Oxford Shirt · Tailored Trouser · Watch · Sunglasses',buttonText:'Shop the Edit',buttonLink:'product.html',image:'',linkedProducts:[]},
    'weekend-edit':{eyebrow:'',title:'The Weekend Edit',subtitle:'Merino Tee · Overshirt Jacket · Relaxed Trouser · Wool Scarf',buttonText:'Shop the Edit',buttonLink:'product.html',image:'',linkedProducts:[]}
  };
  function link(v,fallback){let x=String(v||'').trim();if(!x)return fallback||'';if(/^[A-Za-z0-9_-]+$/.test(x)&&!x.includes('.'))x='#'+x;if(/^#[A-Za-z0-9_-]+$/.test(x))return x;try{const u=new URL(x,location.origin);if(u.origin!==location.origin)return fallback||'';let p=u.pathname.replace(/^\/+/, '');if(!p)p='index.html';if(!/^(?:index|product|clothing|jackets|trousers|accessories|checkout|account|success|edit)\.html$/.test(p))return fallback||'';return p+(u.hash&&/^#[A-Za-z0-9_-]+$/.test(u.hash)?u.hash:'')}catch(_){return fallback||'';}}
  function sanitizeHotspots(raw,legacy){
    let list=Array.isArray(raw)?raw:(legacy&&typeof legacy==='object'?[legacy]:[]);
    return list.slice(0,8).map((v,i)=>{v=v&&typeof v==='object'?v:{};const n=(x,f,min,max)=>{x=Number(x);return Number.isFinite(x)?Math.min(max,Math.max(min,x)):f};const x=n(v.x,58,0,99),y=n(v.y,68,0,99);return {id:S.text(v.id||('hotspot-'+(i+1)),50),enabled:v.enabled!==false,link:link(v.link,''),x,y,w:Math.min(n(v.w,24,1,100),100-x),h:Math.min(n(v.h,12,1,100),100-y)}}).filter(v=>v.w>0&&v.h>0);
  }
  function clean(raw,defs,withOverlay=false){raw=raw&&typeof raw==='object'?raw:{};const out={};for(const k of Object.keys(defs)){const d=defs[k],r=raw[k]&&typeof raw[k]==='object'?raw[k]:{};out[k]={eyebrow:S.text(r.eyebrow||d.eyebrow,80),title:S.text(r.title||d.title,140),subtitle:S.text(r.subtitle||d.subtitle,260),buttonText:S.text(r.buttonText||d.buttonText,50),buttonLink:link(r.buttonLink,d.buttonLink),image:S.imageSrc(r.image)||S.imageSrc(d.image),linkedProducts:Array.isArray(r.linkedProducts)?r.linkedProducts.map(S.id).filter(Boolean).slice(0,12):(Array.isArray(d.linkedProducts)?d.linkedProducts:[])};if(withOverlay){out[k].overlayEnabled=r.overlayEnabled!==undefined?r.overlayEnabled!==false:d.overlayEnabled!==false;out[k].hotspots=sanitizeHotspots(r.hotspots,r.hotspot);} }return out;}
  const RESPONSIVE_BREAKPOINT=760;
  let desktop, mobile, desktopMinis, mobileMinis, serverSnapshot=null;
  function readResponsiveContent(){
    const source=serverSnapshot||{};
    desktop=clean(source.desktopContent||S.safeJson(localStorage.getItem(KEY)||'{}',{}),DEFAULTS,true);
    const mobileRaw=source.mobileContent||S.safeJson(localStorage.getItem(MOBILE_KEY)||'{}',{});
    mobile=clean(mobileRaw,desktop,true);
    desktopMinis=clean(source.desktopMinis||S.safeJson(localStorage.getItem(MINI_KEY)||'{}',{}),MINI_DEFAULTS);
    const mobileMiniRaw=source.mobileMinis||S.safeJson(localStorage.getItem(MOBILE_MINI_KEY)||'{}',{});
    mobileMinis=clean(mobileMiniRaw,desktopMinis);
  }
  function backupServerContent(content){
    try{localStorage.setItem(KEY,JSON.stringify(content.desktopContent||{}))}catch(_){}
    try{localStorage.setItem(MOBILE_KEY,JSON.stringify(content.mobileContent||{}))}catch(_){}
    try{localStorage.setItem(MINI_KEY,JSON.stringify(content.desktopMinis||{}))}catch(_){}
    try{localStorage.setItem(MOBILE_MINI_KEY,JSON.stringify(content.mobileMinis||{}))}catch(_){}
  }
  async function syncFromServer(){
    try{
      const r=await fetch('/api/site-content',{headers:{Accept:'application/json'},cache:'no-store'}),data=await r.json();
      if(r.ok&&data.initialized&&data.content){serverSnapshot=data.content;backupServerContent(data.content);render();return true}
    }catch(err){console.warn('AVERON site content server sync failed; browser fallback retained.',err)}
    return false;
  }
  readResponsiveContent();
  const mq=window.matchMedia('(max-width:'+RESPONSIVE_BREAKPOINT+'px)');
  function setText(sel,value){const el=document.querySelector(sel);if(el)el.textContent=value;}
  function applyBanner(k,b){const section=document.querySelector(`[data-content-banner="${k}"]`);if(section){section.querySelectorAll('[data-banner-hotspot]').forEach(el=>el.remove());(b.hotspots||[]).forEach((hs,i)=>{if(!hs.enabled||!hs.link)return;const a=document.createElement('a');a.dataset.bannerHotspot=String(i);a.className='banner-click-hotspot';a.href=hs.link;a.setAttribute('aria-label','Open featured link '+(i+1));a.style.left=hs.x+'%';a.style.top=hs.y+'%';a.style.width=hs.w+'%';a.style.height=hs.h+'%';a.style.pointerEvents='auto';section.appendChild(a)})}const media=document.querySelector(`[data-banner-media="${k}"]`);if(media){if(b.image){media.style.backgroundImage=`url("${b.image.replace(/"/g,'%22')}")`;media.style.backgroundSize='cover';media.style.backgroundPosition='center';media.classList.add('has-custom-banner')}else{media.style.backgroundImage='';media.classList.remove('has-custom-banner')}}}
  function applyMini(k,b){setText(`[data-mini-eyebrow="${k}"]`,b.eyebrow);const title=document.querySelector(`[data-mini-title="${k}"]`);if(title)title.textContent=b.title;const sub=document.querySelector(`[data-mini-subtitle="${k}"]`);if(sub&&b.subtitle){if(sub.classList.contains('edit-items')){sub.replaceChildren();b.subtitle.split(/[·|,]/).map(x=>x.trim()).filter(Boolean).slice(0,6).forEach(x=>{const sp=document.createElement('span');sp.textContent=x;sub.appendChild(sp)})}else sub.textContent=b.subtitle}const a=document.querySelector(`[data-mini-button="${k}"]`);if(a){const hasEdit=Array.isArray(b.linkedProducts)&&b.linkedProducts.length>0&&!k.startsWith('category-');if(hasEdit){a.textContent=b.buttonText||'Shop the Edit';a.setAttribute('href',`edit.html?edit=${encodeURIComponent(k)}`);a.hidden=false}else{if(b.buttonText)a.textContent=b.buttonText;if(b.buttonLink)a.setAttribute('href',b.buttonLink);if(k==='intro')a.hidden=!b.buttonText}}const tile=document.querySelector(`[data-mini-link="${k}"]`);if(tile&&b.buttonLink)tile.setAttribute('href',b.buttonLink);const media=document.querySelector(`[data-mini-media="${k}"]`);if(media){if(b.image){media.style.backgroundImage=`url("${b.image.replace(/"/g,'%22')}")`;media.style.backgroundSize='cover';media.style.backgroundPosition='center';media.classList.add('has-custom-mini')}else{media.style.backgroundImage='';media.classList.remove('has-custom-mini')}}}
  function render(){
    readResponsiveContent();
    const data=mq.matches?mobile:desktop,minis=mq.matches?mobileMinis:desktopMinis;
    applyBanner('hero',data.hero);applyBanner('editorial',data.editorial);
    Object.keys(MINI_DEFAULTS).forEach(k=>applyMini(k,minis[k]));
    document.documentElement.dataset.averonViewport=mq.matches?'mobile':'desktop';
  }
  render();
  const serverReady=syncFromServer();window.AVERON_CONTENT_READY=serverReady;
  if(mq.addEventListener)mq.addEventListener('change',render);else mq.addListener(render);
  window.addEventListener('storage',e=>{if([KEY,MOBILE_KEY,MINI_KEY,MOBILE_MINI_KEY].includes(e.key)){serverSnapshot=null;render();syncFromServer()}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncFromServer()});
  window.AVERON_CONTENT={KEY,MOBILE_KEY,MINI_KEY,MOBILE_MINI_KEY,RESPONSIVE_BREAKPOINT,DEFAULTS,MINI_DEFAULTS,clean,render,getMini:(k,isMobile=false)=>{readResponsiveContent();return (isMobile?mobileMinis:desktopMinis)[k]||null}};
})();
