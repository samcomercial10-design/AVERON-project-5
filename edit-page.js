/* AVERON Shop the Edit renderer */
(async function(){
  'use strict';const S=window.AVERON_SECURITY;if(!S)return;await (window.AVERON_CONTENT_READY||Promise.resolve());
  const key=S.id(new URLSearchParams(location.search).get('edit')||'');
  const allowed=new Set(['intro','city-edit','weekend-edit']);
  const defaults={
    intro:{title:'Refined essentials, considered details.',subtitle:'Pieces selected to be worn together.',linkedProducts:[]},
    'city-edit':{title:'The City Edit',subtitle:'A considered selection for the city.',linkedProducts:[]},
    'weekend-edit':{title:'The Weekend Edit',subtitle:'A considered selection for the weekend.',linkedProducts:[]}
  };
  const isMobile=matchMedia('(max-width:760px)').matches;
  const synced=window.AVERON_CONTENT?.getMini?.(key,isMobile);
  const miniRaw=S.safeJson(localStorage.getItem('averon_mini_content_v1')||'{}',{});
  const mobileRaw=S.safeJson(localStorage.getItem('averon_mini_content_mobile_v1')||'{}',{});
  const source=isMobile&&mobileRaw[key]?mobileRaw:miniRaw;
  const entry=allowed.has(key)&&(synced||(source[key]&&typeof source[key]==='object'?source[key]:defaults[key]));
  const serverProducts=await (window.AVERON_CATALOGUE_READY||Promise.resolve([]));const products=S.products(serverProducts?.length?serverProducts:S.safeJson(localStorage.getItem('averon_products_v1')||'null',null),[]);
  const ids=Array.isArray(entry?.linkedProducts)?entry.linkedProducts.map(S.id).filter(Boolean):[];
  const selected=ids.map(id=>products.find(p=>p.id===id)).filter(Boolean);
  const title=document.getElementById('edit-title'),subtitle=document.getElementById('edit-subtitle'),count=document.getElementById('edit-count'),grid=document.getElementById('edit-grid'),empty=document.getElementById('edit-empty');
  if(title)title.textContent=S.text(entry?.title||defaults[key]?.title||'The AVERON Edit',140);
  if(subtitle)subtitle.textContent=S.text(entry?.subtitle||defaults[key]?.subtitle||'Pieces selected to be worn together.',260);
  if(count)count.textContent=`${selected.length} piece${selected.length===1?'':'s'} in this edit`;
  if(!grid)return;grid.replaceChildren();
  function heart(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','heart-icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.55');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z');svg.appendChild(path);return svg}
  selected.forEach(p=>{const card=S.el('article','card'),figure=S.el('div','card-figure'),link=document.createElement('a');link.href=S.safeProductHref(p.id);link.setAttribute('aria-label',`View ${p.name}`);const src=S.imageSrc(p.coverImage)||S.imageSrc(p.images?.[0]);const hoverSrc=S.imageSrc(p.images?.[2]);if(src){link.classList.add('card-product-link');const img=document.createElement('img');img.src=src;img.alt=p.name;img.width=800;img.height=1000;img.loading='lazy';img.decoding='async';img.className='card-product-image card-product-image--cover';link.appendChild(img);if(hoverSrc&&hoverSrc!==src){const hover=document.createElement('img');hover.src=hoverSrc;hover.alt='';hover.width=800;hover.height=1000;hover.loading='lazy';hover.decoding='async';hover.className='card-product-image card-product-image--hover';hover.setAttribute('aria-hidden','true');link.appendChild(hover)}}else{link.appendChild(S.el('div','ph'))}figure.appendChild(link);const wish=S.el('button','card-wishlist');wish.type='button';wish.dataset.wishlistBtn=p.id;wish.setAttribute('aria-label',`Save ${p.name} to wishlist`);wish.appendChild(heart());const quick=S.el('button','card-quickadd','Quick Add');quick.type='button';quick.dataset.quickadd=p.id;quick.dataset.name=p.name;quick.dataset.price=String(p.price);figure.append(wish,quick);const n=S.el('a','card-name',p.name);n.href=S.safeProductHref(p.id);const meta=S.el('div','card-meta');meta.append(S.el('span','card-price','£'+p.price.toFixed(2)),S.el('span','card-rating','Edit'));card.append(figure,n,meta);grid.appendChild(card)});
  if(empty)empty.hidden=selected.length>0;
  window.AVERON_syncWishlistUI?.();
})();