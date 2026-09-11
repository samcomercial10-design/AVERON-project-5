/* AVERON — client-side safety helpers for the static preview.
   Important: these helpers reduce DOM/XSS risk, but they do not replace
   server-side authentication, validation, pricing or payment security. */
(function(){
  'use strict';
  const MAX_TEXT = 5000;
  const MAX_PRODUCTS = 200;
  const MAX_DATA_IMAGE = 4_500_000;
  const ALLOWED_CATEGORIES = new Set(['Clothing','Jackets','Trousers','Accessories','Watches','Sunglasses']);

  function text(value, max=MAX_TEXT){
    const s = String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
    return s.slice(0, Math.max(0, max));
  }
  function id(value){
    const s = String(value ?? '').trim();
    return /^[A-Za-z0-9_-]{1,48}$/.test(s) ? s : '';
  }
  function price(value){
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n * 100) / 100 : 0;
  }
  function qty(value){
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? Math.max(1, Math.min(99, n)) : 1;
  }
  function imageSrc(value){
    const s = String(value ?? '').trim();
    if (!s) return '';
    if (s.length > MAX_DATA_IMAGE) return '';
    if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(s)) return s;
    if (/^(?:\.\/)?assets\/[A-Za-z0-9._/-]+$/.test(s)) return s;
    if (/^[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp)$/i.test(s) && !s.includes('..')) return s;
    return '';
  }
  function category(value){
    const s = text(value, 40);
    return ALLOWED_CATEGORIES.has(s) ? s : 'Clothing';
  }
  function safeJson(raw, fallback){
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }
  function product(raw, index=0){
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const pid = id(raw.id) || ('p' + (index + 1));
    const imgs = Array.isArray(raw.images) ? raw.images.slice(0,3).map(imageSrc).filter(Boolean) : [];
    const coverImage = imageSrc(raw.coverImage || raw.cover || '');
    const colourImagery = Array.isArray(raw.colourImagery) ? raw.colourImagery.slice(0,40).map(entry=>({
      colour:text(entry?.colour || entry?.name,60),
      coverImage:imageSrc(entry?.coverImage || entry?.cover || ''),
      images:Array.isArray(entry?.images)?entry.images.slice(0,3).map(imageSrc).filter(Boolean):[]
    })).filter(entry=>entry.colour) : [];
    const materialCraft = {
      enabled: raw.materialCraft?.enabled !== false,
      images: Array.isArray(raw.materialCraft?.images) ? raw.materialCraft.images.slice(0,3).map(imageSrc).filter(Boolean) : []
    };
    const completeLook = {
      enabled: raw.completeLook?.enabled === true,
      products: Array.isArray(raw.completeLook?.products) ? [...new Set(raw.completeLook.products.map(id).filter(Boolean))].slice(0,4) : []
    };
    const sizeGuide = {
      enabled: raw.sizeGuide?.enabled === true,
      image: imageSrc(raw.sizeGuide?.image || '')
    };
    const shippingCountries = Array.isArray(raw.shippingCountries)
      ? [...new Set(raw.shippingCountries.map(x=>text(x,2).toUpperCase()).filter(x=>/^[A-Z]{2}$/.test(x)))].slice(0,40)
      : [];
    return {
      id: pid,
      name: text(raw.name || 'AVERON Product', 120),
      price: price(raw.price),
      previousPrice: raw.previousPrice === '' || raw.previousPrice === null || raw.previousPrice === undefined ? null : price(raw.previousPrice),
      category: category(raw.category),
      colour: text(raw.colour || 'Deep Navy', 60),
      label: text(raw.label || raw.img || 'AVERON', 80),
      description: text(raw.description, 1200),
      details: text(raw.details, 1200),
      fit: text(raw.fit, 1200),
      delivery: text(raw.delivery, 1200),
      returns: text(raw.returns, 1200),
      coverImage,
      images: imgs,
      colourImagery,
      materialCraft,
      completeLook,
      sizeGuide,
      shippingCountries,
      supplier: {
        provider: text(raw.supplier?.provider || 'CJ', 20),
        pid: text(raw.supplier?.pid, 200),
        logistics: text(raw.supplier?.logistics || 'CJPacket Ordinary', 80),
        variants: Array.isArray(raw.supplier?.variants) ? raw.supplier.variants.slice(0,100).map(v=>({
          label:text(v?.label || v?.variantKey || v?.variantNameEn,120),
          vid:text(v?.vid,200), sku:text(v?.sku || v?.variantSku,200), image:imageSrc(v?.image || v?.variantImage)
        })).filter(v=>v.vid||v.sku) : [],
        colourSwatches: Array.isArray(raw.supplier?.colourSwatches) ? raw.supplier.colourSwatches.slice(0,40).map(c=>{
          const name=text(c?.name || c?.colour,60);
          const displayName=text(c?.displayName || c?.label || name,60);
          const candidate=text(c?.hex || c?.value,16);
          return {name,displayName:displayName || name,hex:/^#[0-9a-f]{6}$/i.test(candidate)?candidate.toLowerCase():'#d7d1c5',enabled:c?.enabled!==false};
        }).filter(c=>c.name) : [],
        mappings: Array.isArray(raw.supplier?.mappings) ? raw.supplier.mappings.slice(0,100).map(m=>({
          option:text(m?.option || m?.size || m?.label,40),
          cjLabel:text(m?.cjLabel || '',120),
          vid:text(m?.vid,200),
          sku:text(m?.sku,200),
          enabled:m?.enabled !== false
        })).filter(m=>m.option && (m.vid||m.sku)) : []
      }
    };
  }
  function products(raw, fallback=[]){
    if (!Array.isArray(raw)) return fallback.map(product).filter(Boolean);
    const seen = new Set();
    const out = [];
    for (const item of raw.slice(0, MAX_PRODUCTS)) {
      const p = product(item, out.length);
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id); out.push(p);
    }
    return out.length ? out : fallback.map(product).filter(Boolean);
  }
  function cartItem(raw){
    if (!raw || typeof raw !== 'object') return null;
    const pid = id(raw.id); if (!pid) return null;
    return {
      id: pid,
      name: text(raw.name || 'AVERON Product', 120),
      price: price(raw.price),
      colour: text(raw.colour || 'Deep Navy', 60),
      size: text(raw.size || 'M', 20),
      qty: qty(raw.qty),
      image: imageSrc(raw.image || '')
    };
  }
  function cart(raw){
    if (!Array.isArray(raw)) return [];
    return raw.slice(0,100).map(cartItem).filter(Boolean);
  }
  function wishlist(raw){
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map(id).filter(Boolean))].slice(0,200);
  }
  function el(tag, className, textValue){
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  }
  function safeProductHref(pid){
    return 'product.html?id=' + encodeURIComponent(id(pid));
  }

  window.AVERON_SECURITY = {text,id,price,qty,imageSrc,category,safeJson,product,products,cartItem,cart,wishlist,el,safeProductHref,MAX_PRODUCTS};
})();
