/* AVERON product page renderer — safe DOM construction */
(async function(){
  'use strict';const S=window.AVERON_SECURITY;if(!S)return;
  const defaults=[
    {id:'p1',name:'Merino Crewneck — Navy',price:65,category:'Clothing',colour:'Deep Navy',images:[]},
    {id:'p2',name:'Tailored Wool Trouser',price:95,category:'Trousers',colour:'Deep Navy',description:'A tailored trouser designed to move between the office and the weekend.',details:'Wool blend. Machine wash cold, inside out. Do not tumble dry.',fit:'Slim-straight fit with a mid-rise waist.',images:[]},
    {id:'p3',name:'Cotton Oxford Shirt',price:78,category:'Clothing',colour:'White',images:[]},
    {id:'p4',name:'Minimalist Overshirt',price:135,category:'Jackets',colour:'Stone',images:[]}
  ];
  const serverProducts=await (window.AVERON_CATALOGUE_READY||Promise.resolve([]));const catalogue=S.products(serverProducts?.length?serverProducts:S.safeJson(localStorage.getItem('averon_products_v1')||'null',null),defaults);const requested=S.id(new URLSearchParams(location.search).get('id'));const p=catalogue.find(x=>x.id===requested)||catalogue.find(x=>x.id==='p2')||catalogue[0];if(!p)return;
  const set=(id,val)=>{const el=document.getElementById(id);if(el&&val!==undefined&&val!==null&&String(val)!=='')el.textContent=String(val)};set('p-name',p.name);set('p-price','£'+p.price.toFixed(2));set('p-description',p.description);set('p-details',p.details);set('p-fit',p.fit);set('p-delivery',p.delivery);set('p-returns',p.returns);
  const sizeGuideOpen=document.getElementById('size-guide-open'),sizeGuideModal=document.getElementById('size-guide-modal'),sizeGuideImage=document.getElementById('size-guide-image-view');
  const sizeGuideSrc=S.imageSrc(p.sizeGuide?.image||'');
  if(sizeGuideOpen&&p.sizeGuide?.enabled===true&&sizeGuideSrc){
    sizeGuideOpen.hidden=false;
    const openSizeGuide=()=>{if(!sizeGuideModal||!sizeGuideImage)return;sizeGuideImage.src=sizeGuideSrc;sizeGuideModal.hidden=false;sizeGuideModal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';sizeGuideModal.querySelector('.size-guide-close')?.focus()};
    const closeSizeGuide=()=>{if(!sizeGuideModal)return;sizeGuideModal.hidden=true;sizeGuideModal.setAttribute('aria-hidden','true');document.body.style.overflow='';sizeGuideOpen.focus()};
    sizeGuideOpen.addEventListener('click',openSizeGuide);
    sizeGuideModal?.querySelectorAll('[data-size-guide-close]').forEach(el=>el.addEventListener('click',closeSizeGuide));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sizeGuideModal&&!sizeGuideModal.hidden)closeSizeGuide()});
  }
  const catPath=p.category==='Jackets'?'jackets.html':p.category==='Trousers'?'trousers.html':p.category==='Accessories'?'accessories.html':'clothing.html';const catLink=document.getElementById('p-category-link');if(catLink){catLink.textContent=p.category;catLink.href=catPath}set('p-category-label',p.category);set('p-breadcrumb-name',p.name);
  window.dispatchEvent(new CustomEvent('averon:product-rendered',{detail:p}));
  const wish=document.querySelector('[data-wishlist-btn]');if(wish)wish.dataset.wishlistBtn=p.id;
  const clean = value => S.text(value || '',120);
  const knownSize = /^(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-9]XL|[0-9]{1,3}(?:CM)?)$/i;
  function splitVariantLabel(label){
    const raw=clean(label);if(!raw)return {colour:'',size:''};
    const parts=raw.split(/\s*[-/]\s*/).filter(Boolean);
    if(parts.length>1 && knownSize.test(parts[parts.length-1])) return {colour:parts.slice(0,-1).join(' - '),size:parts[parts.length-1].toUpperCase()};
    const words=raw.split(/\s+/);const last=words[words.length-1]||'';
    if(words.length>1&&knownSize.test(last)) return {colour:words.slice(0,-1).join(' '),size:last.toUpperCase()};
    return {colour:raw,size:''};
  }
  const supplierVariants=Array.isArray(p.supplier?.variants)?p.supplier.variants:[];
  const supplierMappings=Array.isArray(p.supplier?.mappings)?p.supplier.mappings:[];
  const activeMappings=supplierMappings.filter(m=>m&&m.enabled!==false&&clean(m.option));
  const mappedVariants=activeMappings.map(m=>{
    const linked=supplierVariants.find(v=>(m.vid&&v.vid===m.vid)||(!m.vid&&m.sku&&v.sku===m.sku))||{};
    const label=clean(m.cjLabel||linked.label||'');
    return {...linked,...m,label,option:clean(m.option),...splitVariantLabel(label)};
  });
  const parsedVariants=(mappedVariants.length?mappedVariants:supplierVariants.map(v=>({...v,...splitVariantLabel(v.label)})));
  const colourNames=[...new Set(parsedVariants.map(v=>clean(v.colour)).filter(Boolean))];
  if(!colourNames.length && clean(p.colour)) colourNames.push(clean(p.colour));
  let selectedColour=colourNames[0]||clean(p.colour)||'Deep Navy';
  const colourImagery=Array.isArray(p.colourImagery)?p.colourImagery:[];
  function imageryForColour(name){
    const entry=colourImagery.find(x=>clean(x?.colour).toLowerCase()===clean(name).toLowerCase());
    const colourImages=(Array.isArray(entry?.images)?entry.images:[]).map(S.imageSrc).filter(Boolean);
    const fallback=(Array.isArray(p.images)?p.images:[]).map(S.imageSrc).filter(Boolean);
    // Product Cover is intentionally storefront-only (catalogue cards/cart imagery).
    // The PDP gallery must render only Product Imagery, never the Product Cover.
    const cover=S.imageSrc(entry?.coverImage)||S.imageSrc(p.coverImage)||S.imageSrc(colourImages[0])||S.imageSrc(fallback[0]);
    const extras=colourImages.length?colourImages:fallback;
    return {cover,images:[...new Set(extras.filter(Boolean))]};
  }

  const configuredSwatches=new Map((Array.isArray(p.supplier?.colourSwatches)?p.supplier.colourSwatches:[]).map(c=>[clean(c?.name).toLowerCase(),{hex:clean(c?.hex),displayName:clean(c?.displayName||c?.label||c?.name),enabled:c?.enabled!==false}]).filter(([n,v])=>n&&/^#[0-9a-f]{6}$/i.test(v.hex)));
  for(let i=colourNames.length-1;i>=0;i--){if(configuredSwatches.get(colourNames[i].toLowerCase())?.enabled===false)colourNames.splice(i,1)}
  if(!colourNames.includes(selectedColour))selectedColour=colourNames[0]||'';
  function storefrontColourName(name){return configuredSwatches.get(String(name||'').trim().toLowerCase())?.displayName||name}
  function colourCss(name){
    const configured=configuredSwatches.get(String(name||'').trim().toLowerCase());if(configured)return configured.hex;
    const n=String(name||'').toLowerCase();
    const table=[
      [/dark blue|deep navy|navy/, '#00293f'],[/black/, '#161616'],[/charcoal|grey|gray/, '#4a4946'],[/stone|beige|cream/, '#c9bfa8'],
      [/white/, '#f7f5ef'],[/brown/, '#5a4032'],[/olive|green/, '#59634a'],[/red|burgundy/, '#742d35'],[/blue/, '#315a78']
    ];
    for(const [r,c] of table)if(r.test(n))return c;return '#d7d1c5';
  }
  const colourLabel=document.getElementById('p-colour-label');
  const colourWrap=document.getElementById('p-colour-options');
  function renderColours(){
    if(colourLabel)colourLabel.textContent=selectedColour?'Colour — '+storefrontColourName(selectedColour):'Colour';
    if(!colourWrap)return;colourWrap.replaceChildren();
    colourNames.forEach((name,i)=>{const b=document.createElement('button');b.className='swatch'+(name===selectedColour?' active':'');b.type='button';b.dataset.colour=name;const displayName=storefrontColourName(name);b.setAttribute('aria-label',displayName);b.setAttribute('title',displayName);b.style.background=colourCss(name);b.addEventListener('click',()=>{selectedColour=name;renderColours();renderSizes();renderGalleryForSelectedColour()});colourWrap.appendChild(b)});
  }
  function sizesForColour(){
    if(!selectedColour)return [];
    if(mappedVariants.length){
      const exact=mappedVariants.filter(v=>!v.colour||v.colour===selectedColour).map(v=>clean(v.option)).filter(Boolean);
      return [...new Set(exact)];
    }
    const exact=parsedVariants.filter(v=>!v.colour||v.colour===selectedColour).map(v=>clean(v.size)).filter(Boolean);
    return [...new Set(exact)];
  }
  const sizeWrap=document.querySelector('.sizes');
  function renderSizes(){
    if(!sizeWrap)return;const opts=sizesForColour();sizeWrap.replaceChildren();
    opts.forEach((opt,i)=>{const b=document.createElement('button');b.className='size-btn'+(i===0?' active':'');b.dataset.size=opt;b.type='button';b.textContent=opt;b.addEventListener('click',()=>{sizeWrap.querySelectorAll('[data-size]').forEach(x=>x.classList.remove('active'));b.classList.add('active')});sizeWrap.appendChild(b)});
    if(!opts.length){const e=document.createElement('span');e.className='body';e.textContent='One size';sizeWrap.appendChild(e)}
  }
  renderColours();renderSizes();

  let qty=1;const q=document.getElementById('qtyVal');document.getElementById('qtyInc')?.addEventListener('click',()=>{qty=Math.min(10,qty+1);if(q)q.textContent=String(qty)});document.getElementById('qtyDec')?.addEventListener('click',()=>{qty=Math.max(1,qty-1);if(q)q.textContent=String(qty)});
  document.getElementById('addToBagBtn')?.addEventListener('click',()=>window.AVERON_addToCart?.({id:p.id,name:p.name,price:p.price,colour:selectedColour,size:document.querySelector('[data-size].active')?.dataset.size||'',qty,image:imageryForColour(selectedColour).cover}));document.getElementById('stickyAddBtn')?.addEventListener('click',()=>document.getElementById('addToBagBtn')?.click());const stickyName=document.querySelector('[data-sticky-name]');if(stickyName)stickyName.textContent=p.name;const stickyPrice=document.querySelector('.sticky-add .price');if(stickyPrice)stickyPrice.textContent='£'+p.price.toFixed(2);


  function makeProductRecommendationCard(prod){
    const card=S.el('div','card'),figure=S.el('div','card-figure'),link=document.createElement('a');link.href=S.safeProductHref(prod.id);
    const src=S.imageSrc(prod.coverImage)||S.imageSrc(prod.images?.[0]),hoverSrc=S.imageSrc(prod.images?.[2]);
    if(src){link.classList.add('card-product-link');const img=document.createElement('img');img.src=src;img.alt=prod.name;img.loading='lazy';img.decoding='async';img.className='card-product-image card-product-image--cover';link.appendChild(img);if(hoverSrc&&hoverSrc!==src){const hover=document.createElement('img');hover.src=hoverSrc;hover.alt='';hover.loading='lazy';hover.decoding='async';hover.className='card-product-image card-product-image--hover';hover.setAttribute('aria-hidden','true');link.appendChild(hover)}}
    else{const placeholder=S.el('div','ph');placeholder.appendChild(S.el('div','tick tl'));link.appendChild(placeholder)}
    figure.appendChild(link);card.append(figure,S.el('div','card-name',prod.name));const meta=S.el('div','card-meta');meta.append(S.el('span','card-price','£'+prod.price.toFixed(2)),S.el('span','card-rating','View'));card.appendChild(meta);return card;
  }
  function renderMaterialCraft(){
    const section=document.getElementById('material-craft-section'),grid=document.getElementById('material-craft-grid');if(!section||!grid)return;
    const config=p.materialCraft||{};section.hidden=config.enabled===false;if(section.hidden)return;grid.replaceChildren();
    const images=(Array.isArray(config.images)?config.images:[]).map(S.imageSrc).filter(Boolean);
    if(images.length){images.forEach((src,i)=>{const frame=document.createElement('div');frame.className='ph';const img=document.createElement('img');img.src=src;img.alt=`${p.name} material detail ${i+1}`;img.loading='lazy';img.decoding='async';img.style.cssText='width:100%;height:100%;object-fit:cover;display:block';frame.appendChild(img);grid.appendChild(frame)})}
    else{['Fabric weave','Stitch detail','Construction detail'].forEach(label=>{const frame=document.createElement('div');frame.className='ph';const tick=document.createElement('div');tick.className='tick tl';const cap=document.createElement('div');cap.className='cap';cap.append(S.el('span','',label),S.el('span','','Close-up'));frame.append(tick,cap);grid.appendChild(frame)})}
  }
  function renderCompleteLook(){
    const section=document.getElementById('complete-look-section'),grid=document.getElementById('complete-grid');if(!section||!grid)return;
    const config=p.completeLook||{};const ids=Array.isArray(config.products)?config.products:[];const selected=ids.map(id=>catalogue.find(x=>x.id===id&&x.id!==p.id)).filter(Boolean).slice(0,4);
    section.hidden=config.enabled!==true||!selected.length;grid.replaceChildren();if(section.hidden)return;selected.forEach(prod=>grid.appendChild(makeProductRecommendationCard(prod)));
  }
  renderMaterialCraft();
  renderCompleteLook();

  const gallery=document.getElementById('p-gallery');
  let galleryImages=[],activeImage=0,previousFocus=null;
  function ensureLightbox(){
    let box=document.getElementById('averonImageLightbox');if(box)return box;
    box=document.createElement('div');box.id='averonImageLightbox';box.className='pdp-lightbox';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Expanded product image');box.hidden=true;
    box.innerHTML=`<button class="pdp-lightbox-close" type="button" aria-label="Close image zoom">×</button><button class="pdp-lightbox-nav pdp-lightbox-prev" type="button" aria-label="Previous image">‹</button><div class="pdp-lightbox-stage"><img alt=""></div><button class="pdp-lightbox-nav pdp-lightbox-next" type="button" aria-label="Next image">›</button><div class="pdp-lightbox-count" aria-live="polite"></div>`;
    document.body.appendChild(box);box.querySelector('.pdp-lightbox-close')?.addEventListener('click',hideLightbox);box.querySelector('.pdp-lightbox-prev')?.addEventListener('click',()=>changeLightbox(-1));box.querySelector('.pdp-lightbox-next')?.addEventListener('click',()=>changeLightbox(1));box.addEventListener('click',e=>{if(e.target===box)hideLightbox()});return box;
  }
  function showLightbox(index){if(!galleryImages.length)return;const box=ensureLightbox(),img=box.querySelector('.pdp-lightbox-stage img'),count=box.querySelector('.pdp-lightbox-count');activeImage=(index+galleryImages.length)%galleryImages.length;img.src=galleryImages[activeImage];img.alt=`${p.name} — ${storefrontColourName(selectedColour)} — image ${activeImage+1} enlarged`;count.textContent=`${activeImage+1} / ${galleryImages.length}`;box.querySelectorAll('.pdp-lightbox-nav').forEach(btn=>btn.hidden=galleryImages.length<=1);previousFocus=document.activeElement;box.hidden=false;document.documentElement.classList.add('lightbox-open');box.querySelector('.pdp-lightbox-close')?.focus()}
  function hideLightbox(){const box=document.getElementById('averonImageLightbox');if(!box||box.hidden)return;box.hidden=true;document.documentElement.classList.remove('lightbox-open');if(previousFocus&&typeof previousFocus.focus==='function')previousFocus.focus()}
  function changeLightbox(delta){showLightbox(activeImage+delta)}
  document.addEventListener('keydown',e=>{const box=document.getElementById('averonImageLightbox');if(!box||box.hidden)return;if(e.key==='Escape')hideLightbox();if(e.key==='ArrowLeft')changeLightbox(-1);if(e.key==='ArrowRight')changeLightbox(1)});
  function renderGalleryForSelectedColour(){
    if(!gallery)return;hideLightbox();gallery.replaceChildren();galleryImages=imageryForColour(selectedColour).images;
    if(galleryImages.length){galleryImages.forEach((src,i)=>{const frame=document.createElement('button');frame.type='button';frame.className='ph pdp-zoom-trigger'+(i===0?' wide':'');frame.dataset.productImage='1';frame.setAttribute('aria-label',`Enlarge ${p.name}, ${storefrontColourName(selectedColour)}, image ${i+1}`);const img=document.createElement('img');img.src=src;img.alt=`${p.name} — ${storefrontColourName(selectedColour)} — image ${i+1}`;img.width=900;img.height=1125;img.loading=i===0?'eager':'lazy';if(i===0)img.fetchPriority='high';img.decoding='async';img.style.cssText='width:100%;height:100%;object-fit:cover;display:block';frame.append(img);frame.addEventListener('click',()=>showLightbox(i));gallery.appendChild(frame)})}
    else{const ph=document.createElement('div');ph.className='ph wide';ph.innerHTML='<div class="tick tl"></div><div class="tick br"></div>';gallery.appendChild(ph)}
  }
  renderGalleryForSelectedColour();

})();
