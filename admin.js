/* AVERON Content Studio — protected by server-side authentication. */
(function(){
  'use strict';const S=window.AVERON_SECURITY;if(!S)return;
  const studio=document.getElementById('studio');if(studio)studio.hidden=false;
  async function ensureAdminSession(){try{const r=await fetch('/api/admin/auth/session',{headers:{Accept:'application/json'},cache:'no-store'});if(!r.ok)throw new Error();return await r.json()}catch(_){location.replace('/admin-login.html?next='+encodeURIComponent('/admin.html'));throw new Error('Admin sign-in required.')}}
  const adminReady=ensureAdminSession();
  const STORAGE='averon_products_v1';const defaults=[
    {id:'p1',name:'Merino Crewneck — Navy',price:65,category:'Clothing',colour:'Deep Navy',label:'Marylebone',description:'A refined everyday knit with a clean silhouette and understated finish.',details:'Soft merino blend. Cold wash. Lay flat to dry.',fit:'Regular fit. True to size.',images:[]},
    {id:'p2',name:'Tailored Wool Trouser',price:95,category:'Trousers',colour:'Deep Navy',label:'Mayfair',description:'A tailored trouser designed to move between the office and the weekend.',details:'Wool blend. Machine wash cold, inside out. Do not tumble dry.',fit:'Slim-straight fit with a mid-rise waist.',images:[]},
    {id:'p3',name:'Cotton Oxford Shirt',price:78,category:'Clothing',colour:'White',label:'Chelsea',description:'A crisp Oxford shirt refined for modern smart-casual dressing.',details:'100% cotton. Wash cold. Cool iron.',fit:'Modern regular fit.',images:[]},
    {id:'p4',name:'Minimalist Overshirt',price:135,category:'Jackets',colour:'Stone',label:'Soho',description:'A clean overshirt with a structured yet relaxed profile.',details:'Cotton blend. Dry clean recommended.',fit:'Relaxed fit.',images:[]}
  ];
  let products=S.products(S.safeJson(localStorage.getItem(STORAGE)||'null',null),defaults),currentId=products[0]?.id;const $=id=>document.getElementById(id);let pendingImageRemovals=new Set();const productDrafts=new Map();let productDirty=false;let colourImageryState=[],selectedColourImageryKey='';
  function browserCatalogueCache(){
    return products.map(p=>({...p,coverImage:'',images:[],colourImagery:[],materialCraft:{...(p.materialCraft||{}),images:[]},sizeGuide:{...(p.sizeGuide||{}),image:''}}));
  }
  function saveAll(){try{localStorage.setItem(STORAGE,JSON.stringify(browserCatalogueCache()))}catch(_){console.warn('AVERON lightweight browser catalogue cache could not be written.')}}
  function toast(msg){$('toast').textContent=S.text(msg,160);$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2200)}
  async function persistProductOrder(){
    saveAll();
    try{
      const order=products.map(p=>p.id);
      const r=await fetch('/api/admin/catalog/reorder',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({order})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||'Could not save product order on the server.');
      $('save-status').textContent='Catalogue order saved.';
    }catch(err){
      console.error('Catalogue reorder persistence failed:',err);
      $('save-status').textContent='Order saved in this browser, but server order could not be updated.';
      toast('Product order saved locally. Server sync failed.');
    }
  }
  function moveProductById(draggedId,targetId,placeAfter=false){
    const from=products.findIndex(p=>p.id===draggedId),to=products.findIndex(p=>p.id===targetId);
    if(from<0||to<0||from===to)return false;
    const [item]=products.splice(from,1);
    let insertAt=products.findIndex(p=>p.id===targetId);
    if(insertAt<0){products.splice(from,0,item);return false}
    if(placeAfter)insertAt+=1;
    products.splice(insertAt,0,item);
    return true;
  }
  function renderList(){
    const list=$('product-list');list.replaceChildren();let draggedId='';
    products.forEach(p=>{
      const row=document.createElement('div');row.className='product-row'+(p.id===currentId?' active':'');row.dataset.productRow=p.id;
      const open=document.createElement('button');open.type='button';open.className='product-row-open';open.setAttribute('aria-label',`Edit ${p.name}`);
      const img=document.createElement('img');img.src=S.imageSrc(p.coverImage)||S.imageSrc(p.images?.[0])||'assets/logo-navy.png';img.alt='';
      const wrap=document.createElement('span'),name=document.createElement('span'),meta=document.createElement('span');name.className='pname';name.textContent=p.name;meta.className='pmeta';meta.textContent=`£${p.price.toFixed(2)} · ${p.category}`;wrap.append(name,meta);
      open.append(img,wrap,document.createTextNode('›'));open.addEventListener('click',()=>loadProduct(p.id));
      const handle=document.createElement('button');handle.type='button';handle.className='product-drag-handle';handle.textContent='⠿';handle.title='Drag to reorder';handle.setAttribute('aria-label',`Drag ${p.name} to reorder`);handle.draggable=true;
      handle.addEventListener('click',e=>e.stopPropagation());
      handle.addEventListener('dragstart',e=>{draggedId=p.id;row.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',p.id)});
      handle.addEventListener('dragend',()=>{draggedId='';list.querySelectorAll('.product-row').forEach(x=>x.classList.remove('dragging','drag-over'))});
      row.addEventListener('dragover',e=>{if(!draggedId||draggedId===p.id)return;e.preventDefault();e.dataTransfer.dropEffect='move';row.classList.add('drag-over')});
      row.addEventListener('dragleave',()=>row.classList.remove('drag-over'));
      row.addEventListener('drop',async e=>{
        e.preventDefault();row.classList.remove('drag-over');
        const source=draggedId||S.id(e.dataTransfer.getData('text/plain'));if(!source||source===p.id)return;
        const rect=row.getBoundingClientRect(),after=e.clientY>rect.top+rect.height/2;
        if(moveProductById(source,p.id,after)){renderList();await persistProductOrder();toast('Product order updated.')}
      });
      row.append(open,handle);list.appendChild(row);
    });
  }
  function cjVariantsFromDom(){return [...document.querySelectorAll('[data-cj-variant-row]')].map(r=>({label:S.text(r.querySelector('[data-cj-label]')?.value,120),vid:S.text(r.querySelector('[data-cj-vid]')?.value,200),sku:S.text(r.querySelector('[data-cj-sku]')?.value,200),image:S.imageSrc(r.dataset.image||'')})).filter(v=>v.vid||v.sku)}
  function currentMappings(){return [...document.querySelectorAll('[data-averon-map-row]')].map(r=>{const sel=r.querySelector('[data-map-select]');const opt=sel?.selectedOptions?.[0];return {option:S.text(r.querySelector('[data-map-option]')?.value,40),cjLabel:S.text(opt?.dataset?.label||'',120),vid:S.text(sel?.value||'',200),sku:S.text(opt?.dataset?.sku||'',200),enabled:r.querySelector('[data-map-enabled]')?.checked!==false}}).filter(m=>m.option&&(m.vid||m.sku))}
  function currentColourSwatches(){return [...document.querySelectorAll('[data-colour-swatch-row]')].map(r=>{const name=S.text(r.dataset.colourName||r.querySelector('[data-colour-name]')?.textContent,60);const displayName=S.text(r.querySelector('[data-colour-display-name]')?.value||name,60);const raw=S.text(r.querySelector('[data-colour-hex]')?.value,16);return {name,displayName,hex:/^#[0-9a-f]{6}$/i.test(raw)?raw.toLowerCase():'#d7d1c5',enabled:r.querySelector('[data-colour-enabled]')?.checked!==false}}).filter(x=>x.name)}

  const AVERON_SHIPPING_COUNTRIES=['GB','DE','FR','NL','BE','CH','AT','SE','DK','NO','FI','IE','IT','ES','PT','LU','PL','CZ'];
  function currentShippingCountries(){return [...document.querySelectorAll('[data-shipping-country]:checked')].map(x=>String(x.value||'').toUpperCase()).filter(x=>AVERON_SHIPPING_COUNTRIES.includes(x));}
  function loadShippingCountries(raw){const selected=new Set(Array.isArray(raw)&&raw.length?raw:AVERON_SHIPPING_COUNTRIES);document.querySelectorAll('[data-shipping-country]').forEach(input=>input.checked=selected.has(input.value));updateShippingCountryStatus();}
  function updateShippingCountryStatus(){const el=$('shipping-country-status');if(!el)return;const n=currentShippingCountries().length;el.textContent=n?`${n} countr${n===1?'y':'ies'} enabled`:'No countries enabled';}
  let lastCjShippingResults=[];
  function representativeCjVariant(){const mappings=currentMappings().filter(m=>m?.enabled!==false&&(m?.sku||m?.vid));const first=mappings[0];if(first)return {sku:S.text(first.sku,200),vid:S.text(first.vid,200)};const variants=cjVariantsFromDom();return variants.length?{sku:S.text(variants[0].sku,200),vid:S.text(variants[0].vid,200)}:{sku:'',vid:''};}
  function renderCjShippingResults(data){const box=$('shipping-cj-results'),status=$('shipping-cj-status'),apply=$('shipping-apply-cj');if(!box||!status||!apply)return;lastCjShippingResults=Array.isArray(data?.results)?data.results:[];box.replaceChildren();lastCjShippingResults.forEach(r=>{const row=document.createElement('div');row.className='shipping-cj-row';const name=document.createElement('strong');name.textContent=r.name||r.code;const state=document.createElement('span');const resultState=r.status||(r.available?'available':'unconfirmed');if(resultState==='available'){state.className='shipping-cj-ok';state.textContent='✓ Available'}else if(resultState==='confirmed_unavailable'){state.className='shipping-cj-no';state.textContent='✕ Confirmed unavailable'}else{state.className='shipping-cj-warn';state.textContent='⚠ Could not confirm'}const meta=document.createElement('span');meta.className='shipping-cj-meta';if(resultState==='available'){const parts=[];if(r.methods)parts.push(`${r.methods} method${r.methods===1?'':'s'}`);if(Number.isFinite(Number(r.cheapest)))parts.push(`from $${Number(r.cheapest).toFixed(2)}`);if(r.arrival)parts.push(`${r.arrival} days`);if(r.origin)parts.push(`from ${r.origin}`);if(r.source==='freightCalculate')parts.push('VID check');meta.textContent=parts.join(' · ')}else if(resultState==='confirmed_unavailable'){const reason=Array.isArray(r.reasons)&&r.reasons[0]?.reason?r.reasons[0].reason:r.error;meta.textContent=reason||'CJ explicitly rejected the available shipping methods.'}else meta.textContent=r.error||'CJ could not confirm this market. It will not be removed automatically.';row.append(name,state,meta);box.appendChild(row)});box.hidden=!lastCjShippingResults.length;const available=lastCjShippingResults.filter(r=>(r.status||(r.available?'available':'unconfirmed'))==='available').length;const confirmedUnavailable=lastCjShippingResults.filter(r=>r.status==='confirmed_unavailable'||r.confirmedUnavailable===true).length;const unconfirmed=lastCjShippingResults.length-available-confirmedUnavailable;apply.disabled=!lastCjShippingResults.length;const variant=data?.testedVariant?.label||data?.testedVariant?.sku||'';status.textContent=`CJ check complete: ${available} available · ${confirmedUnavailable} confirmed unavailable · ${unconfirmed} unconfirmed${variant?` · tested with ${variant}`:''}. Unconfirmed markets are preserved when you apply the result.`; }
  function markShippingDirty(){productDirty=true;updateShippingCountryStatus();$('save-status').textContent='Unsaved shipping availability.';}
  function currentSupplier(){return {provider:'CJ',pid:S.text($('f-cj-pid')?.value,200),logistics:S.text($('f-cj-logistics')?.value||'CJPacket Ordinary',80),variants:cjVariantsFromDom(),colourSwatches:currentColourSwatches(),mappings:currentMappings()}}
  const sizeToken=/^(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-9]XL|[0-9]{1,3}(?:CM)?)$/i;
  function inferOption(label){const t=S.text(label,120).trim();if(!t)return '';const parts=t.split(/[-/]/).map(x=>x.trim()).filter(Boolean);const tail=parts[parts.length-1]||'';if(sizeToken.test(tail))return S.text(tail.toUpperCase(),40);const words=t.split(/\s+/);const last=words[words.length-1]||'';if(sizeToken.test(last))return S.text(last.toUpperCase(),40);return S.text(tail||t,40)}
  function inferColour(label){const t=S.text(label,120).trim();if(!t)return '';const parts=t.split(/[-/]/).map(x=>x.trim()).filter(Boolean);if(parts.length>1&&sizeToken.test(parts[parts.length-1]))return S.text(parts.slice(0,-1).join(' - '),60);const words=t.split(/\s+/);if(words.length>1&&sizeToken.test(words[words.length-1]))return S.text(words.slice(0,-1).join(' '),60);return ''}
  function defaultSwatchHex(name){const n=String(name||'').toLowerCase();const table=[[/dark blue|deep navy|navy/,'#00293f'],[/black/,'#161616'],[/charcoal|grey|gray/,'#4a4946'],[/stone|beige|cream/,'#c9bfa8'],[/white/,'#f7f5ef'],[/brown/,'#5a4032'],[/olive|green/,'#59634a'],[/red|burgundy/,'#742d35'],[/blue/,'#315a78']];for(const [r,c] of table)if(r.test(n))return c;return '#d7d1c5'}
  function colourEnabledForLabel(label,swatches=currentColourSwatches()){
    const colour=inferColour(label);if(!colour)return true;
    const match=(Array.isArray(swatches)?swatches:[]).find(c=>String(c?.name||'').trim().toLowerCase()===colour.toLowerCase());
    return !match||match.enabled!==false;
  }
  function enabledProductColours(variants=cjVariantsFromDom(),swatches=currentColourSwatches()){
    const detected=[...new Set((variants||[]).map(v=>inferColour(v.label)).filter(Boolean))];
    if(!detected.length){const fallback=S.text($('f-colour')?.value||'',60);if(fallback)detected.push(fallback)}
    const map=new Map((Array.isArray(swatches)?swatches:[]).map(c=>[String(c?.name||'').trim().toLowerCase(),c]));
    return detected.filter(name=>map.get(name.toLowerCase())?.enabled!==false);
  }
  function renderColourSwatches(swatches=[],variants=cjVariantsFromDom()){
    const list=$('averon-colour-swatch-list');if(!list)return;list.replaceChildren();
    const detected=[...new Set((variants||[]).map(v=>inferColour(v.label)).filter(Boolean))];if(!detected.length){const fallback=S.text($('f-colour')?.value||'',60);if(fallback)detected.push(fallback)}
    const saved=new Map((Array.isArray(swatches)?swatches:[]).map(c=>[String(c?.name||'').toLowerCase(),c]));
    if(!detected.length){const note=document.createElement('div');note.className='admin-note';note.textContent='Load CJ variants or enter the product colour to configure its storefront swatch.';list.appendChild(note);return}
    detected.forEach(name=>{
      const prior=saved.get(name.toLowerCase())||{},hex=/^#[0-9a-f]{6}$/i.test(prior.hex||'')?prior.hex.toLowerCase():defaultSwatchHex(name);
      const row=document.createElement('div');row.dataset.colourSwatchRow='1';row.dataset.colourName=name;row.style.cssText='display:grid;grid-template-columns:34px minmax(110px,.7fr) minmax(150px,1fr) 62px minmax(105px,.65fr);gap:8px;align-items:center';
      const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=prior.enabled!==false;enabled.dataset.colourEnabled='1';enabled.setAttribute('aria-label',`Show ${name} on the storefront`);enabled.title=`Show ${name} on the storefront`;enabled.style.cssText='width:18px;height:18px;margin:auto;accent-color:#00293f';
      const label=document.createElement('div');label.dataset.colourName='1';label.textContent=name;label.title='CJ colour name (kept internally for variant matching)';label.style.cssText='border:1px solid #d9d2c4;background:#f7f3ea;padding:12px 13px;min-height:18px';
      const displayName=document.createElement('input');displayName.type='text';displayName.value=S.text(prior.displayName||prior.label||name,60);displayName.maxLength=60;displayName.placeholder='Storefront name, e.g. Midnight Navy';displayName.dataset.colourDisplayName='1';displayName.setAttribute('aria-label',`Storefront name for ${name}`);
      const picker=document.createElement('input');picker.type='color';picker.value=hex;picker.setAttribute('aria-label',`Choose storefront colour for ${name}`);picker.style.cssText='width:62px;height:44px;padding:3px;border:1px solid #d9d2c4;background:#fff;cursor:pointer';
      const text=document.createElement('input');text.type='text';text.value=hex;text.maxLength=7;text.placeholder='#315a78';text.dataset.colourHex='1';
      function setDirty(message='Unsaved storefront colour name / swatch.'){productDirty=true;$('save-status').textContent=message}
      picker.addEventListener('input',()=>{text.value=picker.value;setDirty()});
      text.addEventListener('input',()=>{const v=text.value.trim();if(/^#[0-9a-f]{6}$/i.test(v))picker.value=v;setDirty()});
      displayName.addEventListener('input',setDirty);
      enabled.addEventListener('change',()=>{const mappings=currentMappings();setDirty(`${name} storefront visibility changed.`);renderVariantMappings(mappings,variants,currentColourSwatches());renderColourImageryEditor()});
      row.append(enabled,label,displayName,picker,text);list.appendChild(row)
    })
  }
    function renderVariantMappings(mappings=[],variants=cjVariantsFromDom(),swatches=currentColourSwatches()){
    const list=$('averon-variant-map-list');if(!list)return;list.replaceChildren();
    if(!variants.length){const e=document.createElement('div');e.className='admin-note';e.textContent='Load CJ variants first. Mapping rows will appear automatically.';list.appendChild(e);return}
    const saved=Array.isArray(mappings)?mappings:[],byVid=new Map(saved.filter(m=>m?.vid).map(m=>[m.vid,m])),bySku=new Map(saved.filter(m=>m?.sku).map(m=>[m.sku,m]));
    const rows=variants.map(v=>{const prior=(v.vid&&byVid.get(v.vid))||(v.sku&&bySku.get(v.sku));return prior?{...prior,cjLabel:prior.cjLabel||v.label}:{option:inferOption(v.label),vid:v.vid,sku:v.sku,cjLabel:v.label,enabled:true}}).filter(m=>colourEnabledForLabel(m.cjLabel,swatches));
    const selectableVariants=variants.filter(v=>colourEnabledForLabel(v.label,swatches));
    if(!rows.length){const e=document.createElement('div');e.className='admin-note';e.textContent='No storefront colours are enabled. Turn on at least one colour above to configure its sizes.';list.appendChild(e);return}
    const groups=new Map();
    rows.forEach(m=>{const key=S.text(m.option||inferOption(m.cjLabel),40)||'Other';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m)});
    const sequence=['XXXS','XXS','XS','S','M','L','XL','XXL','XXXL'];
    const rank=v=>{const i=sequence.indexOf(String(v).toUpperCase());if(i>=0)return i;const n=Number(v);return Number.isFinite(n)?100+n:1000};
    [...groups.keys()].sort((x,y)=>rank(x)-rank(y)||x.localeCompare(y)).forEach((groupName,groupIndex)=>{
      const entries=groups.get(groupName);
      const details=document.createElement('details');details.className='variant-size-group';details.open=groupIndex===0;
      const summary=document.createElement('summary');summary.className='variant-size-summary';
      const spacer=document.createElement('span'),title=document.createElement('strong'),count=document.createElement('small'),toggleWrap=document.createElement('label');
      title.textContent=`Size ${groupName}`;toggleWrap.className='variant-group-toggle';toggleWrap.addEventListener('click',e=>e.stopPropagation());
      const groupToggle=document.createElement('input');groupToggle.type='checkbox';groupToggle.dataset.variantGroupToggle=groupName;groupToggle.style.accentColor='#00293f';
      const groupText=document.createElement('span');groupText.textContent='Show all';toggleWrap.append(groupToggle,groupText);summary.append(spacer,title,count,toggleWrap);details.appendChild(summary);
      const rowsBox=document.createElement('div');rowsBox.className='variant-size-rows';const childChecks=[];
      entries.forEach(m=>{
        const row=document.createElement('div');row.dataset.averonMapRow='1';row.className='variant-map-row';row.style.cssText='display:grid;grid-template-columns:42px minmax(110px,.65fr) minmax(260px,1.8fr);gap:8px;align-items:center';
        const enabled=document.createElement('input');enabled.type='checkbox';enabled.dataset.mapEnabled='1';enabled.checked=m.enabled!==false;enabled.setAttribute('aria-label',`Show ${m.cjLabel||groupName} on storefront`);enabled.style.cssText='width:18px;height:18px;margin:auto;accent-color:#00293f';childChecks.push(enabled);
        const option=document.createElement('input');option.dataset.mapOption='1';option.placeholder='AVERON size';option.value=S.text(m.option||groupName,40);
        const select=document.createElement('select');select.dataset.mapSelect='1';
        selectableVariants.forEach(v=>{const o=document.createElement('option');o.value=S.text(v.vid||'',200);o.dataset.sku=S.text(v.sku||'',200);o.dataset.label=S.text(v.label||'',120);o.textContent=`${S.text(v.label||'CJ variant',120)} · ${S.text(v.vid||v.sku,200)}`;if((m.vid&&o.value===m.vid)||(!m.vid&&m.sku&&o.dataset.sku===m.sku))o.selected=true;select.appendChild(o)});
        const dirty=()=>{productDirty=true;updateGroupState();$('save-status').textContent='Unsaved storefront variant visibility / CJ mapping.'};
        enabled.addEventListener('change',dirty);option.addEventListener('input',dirty);option.addEventListener('change',dirty);select.addEventListener('change',dirty);
        row.append(enabled,option,select);rowsBox.appendChild(row);
      });
      function updateGroupState(){const active=childChecks.filter(c=>c.checked).length;groupToggle.checked=active===childChecks.length&&active>0;groupToggle.indeterminate=active>0&&active<childChecks.length;count.textContent=`${active} of ${childChecks.length} active`}
      groupToggle.addEventListener('change',()=>{childChecks.forEach(c=>c.checked=groupToggle.checked);productDirty=true;updateGroupState();$('save-status').textContent=`Size ${groupName} visibility changed.`});
      updateGroupState();details.appendChild(rowsBox);list.appendChild(details);
    });
  }
  function renderCjVariants(variants=[]){const list=$('cj-variant-list');if(!list)return;list.replaceChildren();if(!variants.length){const e=document.createElement('div');e.className='admin-note';e.textContent='No CJ variants loaded yet.';list.appendChild(e);renderVariantMappings([],[]);return}variants.forEach((v,i)=>{const row=document.createElement('div');row.dataset.cjVariantRow='1';row.dataset.image=S.imageSrc(v.image||v.variantImage||'');row.style.cssText='display:grid;grid-template-columns:1.1fr 1.5fr 1.2fr;gap:8px';const label=document.createElement('input');label.dataset.cjLabel='1';label.placeholder='CJ variant';label.value=S.text(v.label||v.variantKey||v.variantNameEn||'',120);const vid=document.createElement('input');vid.dataset.cjVid='1';vid.placeholder='CJ VID';vid.value=S.text(v.vid||'',200);const sku=document.createElement('input');sku.dataset.cjSku='1';sku.placeholder='CJ SKU';sku.value=S.text(v.sku||v.variantSku||'',200);[label,vid,sku].forEach(x=>x.addEventListener('input',()=>{productDirty=true;$('save-status').textContent='Unsaved supplier mapping.'}));row.append(label,vid,sku);list.appendChild(row)})}

  function detectedProductColours(variants=cjVariantsFromDom()){
    const colours=[...new Set((variants||[]).map(v=>inferColour(v.label)).filter(Boolean))];
    if(!colours.length){const fallback=S.text($('f-colour')?.value||'',60);if(fallback)colours.push(fallback)}
    return colours;
  }
  function sanitizeColourImageryState(raw=[]){
    return (Array.isArray(raw)?raw:[]).slice(0,40).map(entry=>({colour:S.text(entry?.colour||entry?.name,60),coverImage:S.imageSrc(entry?.coverImage||''),images:Array.isArray(entry?.images)?entry.images.slice(0,3).map(S.imageSrc).filter(Boolean):[]})).filter(entry=>entry.colour);
  }
  function currentColourImagery(){return sanitizeColourImageryState(colourImageryState)}
  function selectedColourImageryEntry(){return colourImageryState.find(entry=>entry.colour.toLowerCase()===selectedColourImageryKey.toLowerCase())||null}
  function renderColourImageryEditor(){
    const section=$('colour-imagery-section'),tabs=$('colour-imagery-tabs'),editor=$('colour-imagery-editor');if(!section||!tabs||!editor)return;
    const colours=enabledProductColours();section.hidden=colours.length<=1;
    if(colours.length<=1){tabs.replaceChildren();editor.hidden=true;return}
    const prior=new Map(colourImageryState.map(entry=>[entry.colour.toLowerCase(),entry]));
    colourImageryState=colours.map(colour=>prior.get(colour.toLowerCase())||{colour,coverImage:'',images:[]});
    if(!colourImageryState.some(entry=>entry.colour.toLowerCase()===selectedColourImageryKey.toLowerCase()))selectedColourImageryKey=colourImageryState[0]?.colour||'';
    tabs.replaceChildren();
    colourImageryState.forEach(entry=>{const b=document.createElement('button');b.type='button';b.className='colour-imagery-tab'+(entry.colour.toLowerCase()===selectedColourImageryKey.toLowerCase()?' active':'');b.textContent=entry.colour;b.onclick=()=>{selectedColourImageryKey=entry.colour;renderColourImageryEditor()};tabs.appendChild(b)});
    const entry=selectedColourImageryEntry();editor.hidden=!entry;if(!entry)return;$('colour-imagery-title').textContent=`Images for ${entry.colour}`;
    const cover=S.imageSrc(entry.coverImage);$('colour-cover-preview').src=cover||'assets/logo-navy.png';$('colour-cover-img').value='';$('colour-remove-cover').disabled=!cover;
    for(let i=1;i<=3;i++){const src=S.imageSrc(entry.images?.[i-1]);$('colour-preview-'+i).src=src||'assets/logo-navy.png';$('colour-img-'+i).value='';const btn=document.querySelector(`[data-remove-colour-image="${i}"]`);if(btn)btn.disabled=!src}
  }
  function loadColourImagery(raw=[],variants=cjVariantsFromDom()){
    const colours=enabledProductColours(variants),saved=new Map(sanitizeColourImageryState(raw).map(entry=>[entry.colour.toLowerCase(),entry]));
    colourImageryState=colours.map(colour=>saved.get(colour.toLowerCase())||{colour,coverImage:'',images:[]});selectedColourImageryKey=colourImageryState[0]?.colour||'';renderColourImageryEditor();
  }
  function updateSelectedColourImagery(mutator){const entry=selectedColourImageryEntry();if(!entry)return;mutator(entry);productDirty=true;renderColourImageryEditor();$('save-status').textContent='Unsaved colour-specific imagery.'}

  function currentMaterialCraft(){
    const images=[];
    for(let i=1;i<=3;i++){
      const raw=$('material-preview-'+i)?.getAttribute('src')||'';
      images.push(raw==='assets/logo-navy.png'?'':S.imageSrc($('material-preview-'+i)?.src||raw));
    }
    return {enabled:$('material-enabled')?.checked!==false,images:images.filter(Boolean)};
  }
  function currentCompleteLook(){
    return {enabled:$('complete-look-enabled')?.checked===true,products:[...document.querySelectorAll('[data-complete-look-product]:checked')].map(x=>S.id(x.value)).filter(Boolean).slice(0,4)};
  }
  function renderCompleteLookChoices(selected=[]){
    const box=$('complete-look-products');if(!box)return;box.replaceChildren();const chosen=new Set(Array.isArray(selected)?selected:[]);
    products.filter(x=>x.id!==currentId).forEach(prod=>{
      const label=document.createElement('label');label.className='complete-look-admin-item';
      const input=document.createElement('input');input.type='checkbox';input.value=prod.id;input.dataset.completeLookProduct='1';input.checked=chosen.has(prod.id);
      const img=document.createElement('img');img.alt='';img.src=S.imageSrc(prod.coverImage)||S.imageSrc(prod.images?.[0])||'assets/logo-navy.png';
      const copy=document.createElement('span'),name=document.createElement('strong'),meta=document.createElement('small');name.textContent=prod.name;meta.textContent=`£${prod.price.toFixed(2)} · ${prod.category}`;copy.append(name,meta);label.append(input,img,copy);box.appendChild(label);
      input.addEventListener('change',()=>{if(input.checked){const checked=[...box.querySelectorAll('[data-complete-look-product]:checked')];if(checked.length>4){input.checked=false;return toast('Choose up to four Complete the Look products.')}}productDirty=true;$('save-status').textContent='Unsaved Complete the Look selection.'});
    });
  }
  function loadEditorialProductSections(materialCraft={},completeLook={}){
    const material={enabled:materialCraft?.enabled!==false,images:Array.isArray(materialCraft?.images)?materialCraft.images:[]};
    $('material-enabled').checked=material.enabled;$('material-editor').hidden=!material.enabled;
    for(let i=1;i<=3;i++){const src=S.imageSrc(material.images[i-1]);$('material-preview-'+i).src=src||'assets/logo-navy.png';$('material-img-'+i).value='';const btn=document.querySelector(`[data-remove-material-image="${i}"]`);if(btn)btn.disabled=!src}
    const complete={enabled:completeLook?.enabled===true,products:Array.isArray(completeLook?.products)?completeLook.products:[]};
    $('complete-look-enabled').checked=complete.enabled;$('complete-look-editor').hidden=!complete.enabled;renderCompleteLookChoices(complete.products);
  }
  function captureCurrentProductDraft(){
    if(!currentId||!productDirty)return;
    const p=products.find(x=>x.id===currentId);if(!p)return;
    const images=[];for(let i=1;i<=3;i++){const raw=$('preview-'+i).getAttribute('src')||'';images.push(raw==='assets/logo-navy.png'?'':S.imageSrc($('preview-'+i).src||raw))}
    const coverRaw=$('cover-preview').getAttribute('src')||'';const coverImage=coverRaw==='assets/logo-navy.png'?'':S.imageSrc($('cover-preview').src||coverRaw);
    const sizeGuideRaw=$('size-guide-preview').getAttribute('src')||'';const sizeGuideImage=sizeGuideRaw==='assets/logo-navy.png'?'':S.imageSrc($('size-guide-preview').src||sizeGuideRaw);productDrafts.set(currentId,{fields:{name:$('f-name').value,price:$('f-price').value,previousPrice:$('f-previous-price').value,category:$('f-category').value,colour:$('f-colour').value,label:$('f-label').value,description:$('f-description').value,details:$('f-details').value,fit:$('f-fit').value,delivery:$('f-delivery').value,returns:$('f-returns').value,supplier:currentSupplier()},coverImage,images,colourImagery:currentColourImagery(),materialCraft:currentMaterialCraft(),completeLook:currentCompleteLook(),sizeGuide:{enabled:$('size-guide-enabled').checked,image:sizeGuideImage},shippingCountries:currentShippingCountries()});
  }
  function discardProductDrafts(){productDrafts.clear();productDirty=false;pendingImageRemovals.clear()}
  function loadProduct(id,opts={}){const nextId=S.id(id);if(opts.capture!==false)captureCurrentProductDraft();currentId=nextId;pendingImageRemovals.clear();const p=products.find(x=>x.id===currentId);if(!p)return;const draft=productDrafts.get(currentId);const f=draft?.fields||p;$('editor-title').textContent=f.name||p.name;$('f-id').value=p.id;$('f-name').value=f.name;$('f-price').value=f.price;$('f-previous-price').value=(f.previousPrice??'');$('f-category').value=f.category;$('f-colour').value=f.colour;$('f-label').value=f.label;$('f-description').value=f.description;$('f-details').value=f.details;$('f-fit').value=f.fit;$('f-delivery').value=f.delivery||'';$('f-returns').value=f.returns||'';const sg=draft?.sizeGuide!==undefined?draft.sizeGuide:(p.sizeGuide||{});$('size-guide-enabled').checked=sg?.enabled===true;const sgImage=S.imageSrc(sg?.image||'');$('size-guide-preview').src=sgImage||'assets/logo-navy.png';$('size-guide-image').value='';$('size-guide-remove').disabled=!sgImage;$('size-guide-editor').hidden=!$('size-guide-enabled').checked;const sup=f.supplier||p.supplier||{};$('f-cj-pid').value=sup.pid||'';$('f-cj-logistics').value=sup.logistics||'CJPacket Ordinary';renderCjVariants(sup.variants||[]);renderColourSwatches(sup.colourSwatches||[],sup.variants||[]);renderVariantMappings(sup.mappings||[],sup.variants||[]);loadColourImagery(draft?.colourImagery!==undefined?draft.colourImagery:(p.colourImagery||[]),sup.variants||[]);loadEditorialProductSections(draft?.materialCraft!==undefined?draft.materialCraft:(p.materialCraft||{}),draft?.completeLook!==undefined?draft.completeLook:(p.completeLook||{}));loadShippingCountries(draft?.shippingCountries!==undefined?draft.shippingCountries:(p.shippingCountries||[]));lastCjShippingResults=[];if($('shipping-cj-results')){$('shipping-cj-results').hidden=true;$('shipping-cj-results').replaceChildren()}if($('shipping-apply-cj'))$('shipping-apply-cj').disabled=true;if($('shipping-cj-status'))$('shipping-cj-status').textContent='Connect a CJ product, then click “Check with CJ” to test all 18 AVERON markets automatically.';$('cj-fetch-status').textContent=sup.pid?((sup.variants||[]).length+' CJ variant(s) loaded · '+((sup.mappings||[]).length)+' AVERON option(s) mapped.'):'Not connected.';const coverSrc=S.imageSrc(draft?.coverImage!==undefined?draft.coverImage:p.coverImage);$('cover-preview').src=coverSrc||'assets/logo-navy.png';$('cover-img').value='';$('remove-cover-image').disabled=!coverSrc;const slots=draft?.images||p.images||[];for(let i=1;i<=3;i++){const src=S.imageSrc(slots[i-1]);const hasImage=!!src;$('preview-'+i).src=hasImage?src:'assets/logo-navy.png';$('img-'+i).value='';const btn=document.querySelector(`[data-remove-product-image=\"${i}\"]`);if(btn)btn.disabled=!hasImage}productDirty=!!draft;renderList();$('save-status').textContent=draft?'Unsaved changes kept for this product.':'No unsaved changes.'}
  function readImage(file,max=1200){return new Promise((resolve,reject)=>{if(!file)return resolve(null);if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)return reject(new Error('Only PNG, JPEG or WebP images up to 5 MB are allowed.'));const img=new Image(),r=new FileReader();r.onload=()=>{img.onload=()=>{if(!img.width||!img.height||img.width*img.height>40_000_000)return reject(new Error('Image dimensions are too large.'));const scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));const ctx=c.getContext('2d',{alpha:false});ctx.drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82))};img.onerror=()=>reject(new Error('Invalid image file.'));img.src=String(r.result)};r.onerror=()=>reject(new Error('Could not read image.'));r.readAsDataURL(file)})}
  ['f-name','f-price','f-previous-price','f-category','f-colour','f-label','f-description','f-details','f-fit','f-delivery','f-returns','f-cj-pid','f-cj-logistics'].forEach(id=>$(id).addEventListener('input',()=>{productDirty=true;$('save-status').textContent='Unsaved changes kept while you stay in Products.'}));
  $('size-guide-enabled').addEventListener('change',()=>{$('size-guide-editor').hidden=!$('size-guide-enabled').checked;productDirty=true;$('save-status').textContent='Unsaved Size Guide visibility.'});
  $('size-guide-image').addEventListener('change',async e=>{try{const data=await readImage(e.target.files[0],1800);if(data){$('size-guide-preview').src=data;$('size-guide-remove').disabled=false;productDirty=true;$('save-status').textContent='Unsaved Size Guide image.'}}catch(err){e.target.value='';toast(err.message)}});
  $('size-guide-remove').addEventListener('click',()=>{$('size-guide-image').value='';$('size-guide-preview').src='assets/logo-navy.png';$('size-guide-remove').disabled=true;productDirty=true;$('save-status').textContent='Size Guide image will be removed when this product is saved.';});
  $('f-colour').addEventListener('change',()=>{if(!cjVariantsFromDom().length)renderColourSwatches(currentColourSwatches(),[])});
  $('cover-img').addEventListener('change',async e=>{try{const data=await readImage(e.target.files[0]);if(data){$('cover-preview').src=data;$('remove-cover-image').disabled=false;productDirty=true}$('save-status').textContent='Unsaved cover image change kept while you stay in Products.'}catch(err){e.target.value='';toast(err.message)}});
  $('remove-cover-image').addEventListener('click',()=>{$('cover-img').value='';$('cover-preview').src='assets/logo-navy.png';$('remove-cover-image').disabled=true;productDirty=true;$('save-status').textContent='Product cover will be removed when this product is saved.';});
  for(let i=1;i<=3;i++)$('img-'+i).addEventListener('change',async e=>{try{const data=await readImage(e.target.files[0]);if(data){pendingImageRemovals.delete(i);$('preview-'+i).src=data;const btn=document.querySelector(`[data-remove-product-image=\"${i}\"]`);if(btn)btn.disabled=false;productDirty=true}$('save-status').textContent='Unsaved image change kept while you stay in Products.'}catch(err){e.target.value='';toast(err.message)}});
  document.querySelectorAll('[data-remove-product-image]').forEach(btn=>btn.addEventListener('click',()=>{const i=Number(btn.dataset.removeProductImage);if(!i)return;pendingImageRemovals.add(i);$('img-'+i).value='';$('preview-'+i).src='assets/logo-navy.png';btn.disabled=true;productDirty=true;$('save-status').textContent=`Image ${i} will be removed when this product is saved.`;}));
  $('colour-cover-img').addEventListener('change',async e=>{try{const data=await readImage(e.target.files[0],900);if(data)updateSelectedColourImagery(entry=>entry.coverImage=data)}catch(err){e.target.value='';toast(err.message)}});
  $('colour-remove-cover').addEventListener('click',()=>updateSelectedColourImagery(entry=>entry.coverImage=''));
  for(let i=1;i<=3;i++)$('colour-img-'+i).addEventListener('change',async e=>{try{const data=await readImage(e.target.files[0],900);if(data)updateSelectedColourImagery(entry=>{entry.images=Array.isArray(entry.images)?entry.images:[];entry.images[i-1]=data})}catch(err){e.target.value='';toast(err.message)}});
  document.querySelectorAll('[data-remove-colour-image]').forEach(btn=>btn.addEventListener('click',()=>{const i=Number(btn.dataset.removeColourImage);if(!i)return;updateSelectedColourImagery(entry=>{entry.images=Array.isArray(entry.images)?entry.images:[];entry.images[i-1]='';while(entry.images.length&&!entry.images[entry.images.length-1])entry.images.pop()})}));

  $('material-enabled').addEventListener('change',()=>{$('material-editor').hidden=!$('material-enabled').checked;productDirty=true;$('save-status').textContent='Unsaved Material & Craft visibility.'});
  for(let i=1;i<=3;i++)$('material-img-'+i).addEventListener('change',async e=>{try{const data=await readImage(e.target.files[0],1100);if(data){$('material-preview-'+i).src=data;const btn=document.querySelector(`[data-remove-material-image="${i}"]`);if(btn)btn.disabled=false;productDirty=true;$('save-status').textContent='Unsaved Material & Craft image.'}}catch(err){e.target.value='';toast(err.message)}});
  document.querySelectorAll('[data-remove-material-image]').forEach(btn=>btn.addEventListener('click',()=>{const i=Number(btn.dataset.removeMaterialImage);if(!i)return;$('material-img-'+i).value='';$('material-preview-'+i).src='assets/logo-navy.png';btn.disabled=true;productDirty=true;$('save-status').textContent='Material & Craft image will be removed when saved.'}));
  $('complete-look-enabled').addEventListener('change',()=>{$('complete-look-editor').hidden=!$('complete-look-enabled').checked;productDirty=true;$('save-status').textContent='Unsaved Complete the Look visibility.'});

  $('shipping-check-cj')?.addEventListener('click',async()=>{const pid=S.text($('f-cj-pid')?.value,200);if(!pid)return toast('Paste or fetch the CJ Product ID first.');const btn=$('shipping-check-cj'),status=$('shipping-cj-status'),rep=representativeCjVariant();btn.disabled=true;$('shipping-apply-cj').disabled=true;status.textContent='Checking all 18 AVERON markets with CJ…';try{const r=await fetch('/api/admin/cj/shipping-availability',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({pid,sku:rep.sku,vid:rep.vid})});const data=await r.json();if(!r.ok)throw new Error(data.error||'CJ shipping check failed.');renderCjShippingResults(data);toast('CJ shipping availability checked.')}catch(err){lastCjShippingResults=[];$('shipping-cj-results').hidden=true;status.textContent='CJ check failed.';toast(err.message||'Could not check CJ shipping.')}finally{btn.disabled=false}});
  $('shipping-apply-cj')?.addEventListener('click',()=>{if(!lastCjShippingResults.length)return;const byCode=new Map(lastCjShippingResults.map(r=>[r.code,r]));let preserved=0;document.querySelectorAll('[data-shipping-country]').forEach(input=>{const r=byCode.get(input.value);if(!r)return;const state=r.status||(r.available?'available':'unconfirmed');if(state==='available')input.checked=true;else if(state==='confirmed_unavailable'||r.confirmedUnavailable===true)input.checked=false;else preserved++});markShippingDirty();toast(preserved?`CJ availability applied. ${preserved} unconfirmed market${preserved===1?' was':'s were'} preserved.`:'CJ availability applied to this product. Save Product to keep it.');});
  document.querySelectorAll('[data-shipping-country]').forEach(input=>input.addEventListener('change',markShippingDirty));
  $('shipping-select-all')?.addEventListener('click',()=>{document.querySelectorAll('[data-shipping-country]').forEach(x=>x.checked=true);markShippingDirty()});
  $('shipping-clear-all')?.addEventListener('click',()=>{document.querySelectorAll('[data-shipping-country]').forEach(x=>x.checked=false);markShippingDirty()});
  const cjVariantsToggle=$('cj-variants-toggle'),cjVariantsPanel=$('cj-variants-panel');
  function setCjVariantsExpanded(expanded){if(!cjVariantsToggle||!cjVariantsPanel)return;cjVariantsToggle.setAttribute('aria-expanded',String(Boolean(expanded)));cjVariantsPanel.hidden=!expanded;const icon=cjVariantsToggle.querySelector('.supplier-section-toggle-icon');if(icon)icon.textContent=expanded?'−':'+';}
  cjVariantsToggle?.addEventListener('click',()=>setCjVariantsExpanded(cjVariantsToggle.getAttribute('aria-expanded')!=='true'));
  setCjVariantsExpanded(false);

  $('product-form').addEventListener('submit',async e=>{e.preventDefault();const p=products.find(x=>x.id===currentId);if(!p)return;productDirty=true;captureCurrentProductDraft();const draft=productDrafts.get(currentId);if(!draft)return;const candidate=S.product({id:p.id,name:draft.fields.name,price:draft.fields.price,previousPrice:draft.fields.previousPrice,category:draft.fields.category,colour:draft.fields.colour,label:draft.fields.label,description:draft.fields.description,details:draft.fields.details,fit:draft.fields.fit,delivery:draft.fields.delivery,returns:draft.fields.returns,coverImage:draft.coverImage,images:draft.images,colourImagery:draft.colourImagery,materialCraft:draft.materialCraft,completeLook:draft.completeLook,sizeGuide:draft.sizeGuide,shippingCountries:draft.shippingCountries,supplier:draft.fields.supplier},0);if(!candidate.name||candidate.price<0)return toast('Check the product name and price.');if(candidate.previousPrice!==null&&candidate.previousPrice<=candidate.price)return toast('Previous price must be higher than the current price, or left blank.');candidate.coverImage=S.imageSrc(draft.coverImage);candidate.images=(draft.images||[]).map(x=>S.imageSrc(x)).filter(Boolean);candidate.colourImagery=sanitizeColourImageryState(draft.colourImagery);candidate.materialCraft={enabled:draft.materialCraft?.enabled!==false,images:(draft.materialCraft?.images||[]).map(S.imageSrc).filter(Boolean).slice(0,3)};candidate.completeLook={enabled:draft.completeLook?.enabled===true,products:(draft.completeLook?.products||[]).map(S.id).filter(Boolean).slice(0,4)};candidate.sizeGuide={enabled:draft.sizeGuide?.enabled===true,image:S.imageSrc(draft.sizeGuide?.image||'')};if(candidate.sizeGuide.enabled&&!candidate.sizeGuide.image)return toast('Upload a Size Guide image or disable Size Guide before saving.');candidate.shippingCountries=(draft.shippingCountries||[]).filter(x=>AVERON_SHIPPING_COUNTRIES.includes(x));if(!candidate.shippingCountries.length)return toast('Select at least one shipping country for this product.');try{const r=await fetch('/api/admin/catalog/product',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({product:candidate})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Server catalogue could not be updated.');Object.assign(p,data.product||candidate);products=S.products(products,defaults);productDrafts.delete(p.id);productDirty=false;pendingImageRemovals.clear();saveAll();loadProduct(p.id,{capture:false});toast('Product images and catalogue saved successfully.')}catch(err){toast(err.message||'Could not save the supplier mapping.')}});
  $('cj-fetch-btn').onclick=async()=>{const pid=S.text($('f-cj-pid').value,200);if(!pid)return toast('Paste the CJ Product ID (PID) first.');const btn=$('cj-fetch-btn'),status=$('cj-fetch-status');btn.disabled=true;status.textContent='Loading CJ product…';try{const r=await fetch('/api/admin/cj/product?pid='+encodeURIComponent(pid),{headers:{Accept:'application/json'},cache:'no-store'});const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not load CJ product.');const variants=Array.isArray(data.variants)?data.variants:[];const previousSwatches=currentColourSwatches();const previousColourImagery=currentColourImagery();renderCjVariants(variants);renderColourSwatches(previousSwatches,variants);renderVariantMappings([],variants);loadColourImagery(previousColourImagery,variants);status.textContent=`Connected · ${variants.length} variant(s) loaded · mapping created automatically`;productDirty=true;$('save-status').textContent='CJ mapping loaded. Save Product to keep it.';toast('CJ product loaded successfully.')}catch(err){status.textContent='Connection failed.';toast(err.message)}finally{btn.disabled=false}};
  $('new-btn').onclick=()=>{captureCurrentProductDraft();const id='p'+Date.now();products.push(S.product({id,name:'New AVERON Product',price:0,category:'Clothing',colour:'Deep Navy',label:'New In',coverImage:'',images:[],shippingCountries:AVERON_SHIPPING_COUNTRIES},products.length));saveAll();loadProduct(id);toast('New product created.')};
  $('delete-btn').onclick=async()=>{if(products.length===1)return toast('Keep at least one product in the catalogue.');if(!confirm('Delete this product?'))return;const deletingId=currentId;$('delete-btn').disabled=true;try{const r=await fetch('/api/admin/catalog/product/'+encodeURIComponent(deletingId),{method:'DELETE',headers:{Accept:'application/json'}});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Could not delete product from server.');productDrafts.delete(deletingId);products=products.filter(p=>p.id!==deletingId);saveAll();currentId=products[0]?.id||'';if(currentId)loadProduct(currentId,{capture:false});renderList();toast('Product deleted permanently.')}catch(err){console.error('Product deletion failed:',err);toast(err.message||'Could not delete product.')}finally{$('delete-btn').disabled=false}};
  $('export-btn').onclick=()=>{const blob=new Blob([JSON.stringify(products,null,2)],{type:'application/json'}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='averon-catalogue.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0)};
  $('import-file').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(f.size>1024*1024)return toast('Catalogue file must be 1 MB or smaller.');const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(String(r.result));if(!Array.isArray(data)||!data.length||data.length>S.MAX_PRODUCTS)throw new Error();const sanitized=S.products(data,[]);if(!sanitized.length)throw new Error();products=sanitized;discardProductDrafts();saveAll();currentId=products[0].id;loadProduct(currentId,{capture:false});toast('Catalogue imported and sanitised.')}catch{toast('Invalid or unsafe catalogue file.')}};r.readAsText(f)});
  // -------- Content Studio navigation --------
  const tabs=[...document.querySelectorAll('[data-admin-tab]')];
  const panels=[...document.querySelectorAll('[data-admin-panel]')];
  let activeAdminPanel='products';
  function tabBase(name){if(name.startsWith('banners-'))return 'banners';if(name.startsWith('mini-banners-'))return 'mini-banners';return name}
  function tabDevice(name){return name.endsWith('-mobile')?'mobile':'desktop'}
  function showPanel(name){
    const targetTab=tabs.find(t=>t.dataset.adminTab===name);
    if(!targetTab)return;
    const base=tabBase(name),device=tabDevice(name);
    const targetPanel=panels.find(p=>p.dataset.adminPanel===base);
    if(!targetPanel)return;

    // Prepare the target editor first. If preparation fails, the current section stays usable.
    if(base==='banners'){
      if(typeof setBannerDevice!=='function'||typeof loadBanner!=='function')throw new Error('Banner editor is unavailable');
    }
    if(base==='mini-banners'){
      if(typeof setMiniDevice!=='function'||typeof loadMini!=='function')throw new Error('Mini-banner editor is unavailable');
    }

    if(activeAdminPanel==='products'&&base!=='products'){discardProductDrafts();loadProduct(currentId,{capture:false});}
    if(activeAdminPanel==='banners'&&(base!=='banners'||currentBannerDevice!==device)){discardBannerDrafts();}
    if(activeAdminPanel==='mini-banners'&&(base!=='mini-banners'||currentMiniDevice!==device)){discardMiniDrafts();}

    activeAdminPanel=base;
    tabs.forEach(t=>t.classList.toggle('active',t===targetTab));
    panels.forEach(p=>p.hidden=p!==targetPanel);

    if(base==='banners'){setBannerDevice(device);loadBanner(currentBanner,{capture:false});}
    if(base==='mini-banners'){setMiniDevice(device);loadMini(currentMini,{capture:false});}
    if(base==='orders')loadAdminOrders();
  }
  // Delegated navigation survives panel re-renders and repeated switching.
  document.addEventListener('click',e=>{
    const tab=e.target.closest('[data-admin-tab]');
    if(!tab)return;
    e.preventDefault();
    const name=tab.dataset.adminTab;
    if(!name)return;
    try{showPanel(name)}
    catch(err){console.error('Content Studio navigation error:',err);toast('Unable to open that Content Studio section. Please try again.')}
  });

  // -------- Server-backed orders (localhost validation build) --------
  function formatMoney(pence,currency='gbp'){
    try{return new Intl.NumberFormat('en-GB',{style:'currency',currency:String(currency||'gbp').toUpperCase()}).format((Number(pence)||0)/100)}
    catch(_){return `£${((Number(pence)||0)/100).toFixed(2)}`}
  }
  function formatOrderDate(seconds){
    const d=new Date((Number(seconds)||0)*1000);
    return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(d);
  }
  function renderAdminOrders(orders){
    const list=$('orders-admin-list');if(!list)return;list.replaceChildren();
    $('orders-count').textContent=String(orders.length);
    const total=orders.reduce((sum,o)=>sum+(Number(o.amount_total)||0),0);
    $('orders-volume').textContent=formatMoney(total,orders[0]?.currency||'gbp');
    $('orders-latest').textContent=orders.length?formatOrderDate(orders[0].created):'—';
    if(!orders.length){const e=document.createElement('div');e.className='empty-admin';e.textContent='No paid orders have been recorded yet.';list.appendChild(e);return}
    orders.forEach(o=>{
      const card=document.createElement('article');card.className='admin-order';
      const top=document.createElement('div');top.className='admin-order-top';
      const ref=document.createElement('div');ref.className='admin-order-ref';ref.textContent=S.text(o.order_ref||'AVERON Order',50);
      const statusEl=document.createElement('div');statusEl.className='admin-order-status';statusEl.textContent=(o.payment_status==='paid'||o.payment_status==='no_payment_required')?'Paid':S.text(o.payment_status||'Unknown',24);
      top.append(ref,statusEl);
      const meta=document.createElement('div');meta.className='admin-order-meta';
      [formatOrderDate(o.created),S.text(o.customer_email||'No email',160),S.text(o.customer_name||'',120)].filter(Boolean).forEach(t=>{const x=document.createElement('span');x.textContent=t;meta.appendChild(x)});
      const items=document.createElement('div');items.className='admin-order-items';
      (Array.isArray(o.items)?o.items:[]).forEach(i=>{const row=document.createElement('div');row.className='admin-order-item';const left=document.createElement('span');const descriptors=[S.text(i.name||'AVERON piece',160),i.size?`Size ${S.text(i.size,20)}`:'',i.colour?S.text(i.colour,40):''].filter(Boolean);left.textContent=`${Math.max(1,Number(i.quantity)||1)} × ${descriptors.join(' · ')}`;const right=document.createElement('span');right.textContent=formatMoney(i.amount_total,i.currency||o.currency);row.append(left,right);items.appendChild(row)});
      const foot=document.createElement('div');foot.className='admin-order-total';const a=document.createElement('span');a.textContent='Order total';const b=document.createElement('span');b.textContent=formatMoney(o.amount_total,o.currency);foot.append(a,b);
      const state=document.createElement('div');state.className='admin-order-state';
      const fulfillment=document.createElement('span');fulfillment.textContent=o.fulfillment_status==='shipped'?'Shipped':o.fulfillment_status==='cancelled'?'Cancelled':'Not shipped';
      const refund=document.createElement('span');refund.textContent=o.refund_status==='refunded'?'Refunded':o.refund_status==='refund_pending'?'Refund processing':o.refund_status==='requested'?'Refund requested':'No refund request';
      const cj=document.createElement('span');
      const cjLabels={not_started:'CJ: waiting',created_100:'CJ Sandbox: created',confirmed_unpaid_200:'CJ Sandbox: confirmed',paid_300:'CJ Sandbox: paid',processing_400:'CJ Sandbox: processing',shipped_500:'CJ Sandbox: shipped',blocked_live_stripe:'CJ: live blocked',disabled_no_key:'CJ: disabled',error:'CJ Sandbox: error'};
      cj.textContent=cjLabels[o.cj_status]||('CJ: '+S.text(o.cj_status||'not started',40));
      if(o.cj_order_id) cj.title='CJ order '+S.text(o.cj_order_id,120);
      state.append(fulfillment,refund,cj);
      const actions=document.createElement('div');actions.className='admin-order-actions';
      if(o.refund_status!=='refunded'&&o.refund_status!=='refund_pending'){
        const ship=document.createElement('button');ship.type='button';ship.className='admin-btn';ship.textContent=o.fulfillment_status==='shipped'?'Mark Not Shipped':'Mark Shipped';ship.dataset.orderFulfillment=o.session_id;ship.dataset.nextStatus=o.fulfillment_status==='shipped'?'not_shipped':'shipped';actions.appendChild(ship);
      }
      if(o.refund_status==='requested'){const approve=document.createElement('button');approve.type='button';approve.className='admin-btn primary';approve.textContent='Approve Refund';approve.dataset.approveRefund=o.session_id;actions.appendChild(approve);}
      if(['error','not_started','disabled_no_key'].includes(o.cj_status||'not_started')){const retry=document.createElement('button');retry.type='button';retry.className='admin-btn';retry.textContent='Retry CJ Sandbox';retry.dataset.retryCj=o.session_id;actions.appendChild(retry);}
      if(o.cj_error){const err=document.createElement('div');err.className='admin-order-meta';const x=document.createElement('span');x.textContent='CJ: '+S.text(o.cj_error,180);err.appendChild(x);card.append(top,meta,items,foot,state,err,actions);}else{card.append(top,meta,items,foot,state,actions);}list.appendChild(card);
    });
  }
  async function loadAdminOrders(){await adminReady;
    const list=$('orders-admin-list');if(!list)return;
    list.innerHTML='<div class="empty-admin">Loading Stripe-verified orders…</div>';
    try{
      const r=await fetch('/api/admin/orders',{headers:{Accept:'application/json'},cache:'no-store'});
      const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to load orders.');
      renderAdminOrders(Array.isArray(data.orders)?data.orders:[]);
    }catch(err){
      list.replaceChildren();const e=document.createElement('div');e.className='empty-admin';e.textContent=S.text(err.message||'Unable to load orders. Start the AVERON server and try again.',180);list.appendChild(e);
      $('orders-count').textContent='—';$('orders-volume').textContent='—';$('orders-latest').textContent='—';
    }
  }
  const refreshOrders=$('orders-refresh');if(refreshOrders)refreshOrders.addEventListener('click',loadAdminOrders);
  const ordersList=$('orders-admin-list');
  if(ordersList)ordersList.addEventListener('click',async e=>{
    const ship=e.target.closest('[data-order-fulfillment]');
    const approve=e.target.closest('[data-approve-refund]');
    const retryCj=e.target.closest('[data-retry-cj]');
    if(ship){ship.disabled=true;try{const r=await fetch('/api/admin/orders/'+encodeURIComponent(ship.dataset.orderFulfillment)+'/fulfillment',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({status:ship.dataset.nextStatus})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to update shipping status.');await loadAdminOrders();}catch(err){ship.disabled=false;toast(S.text(err.message||'Unable to update shipping status.',140));}}
    if(retryCj){retryCj.disabled=true;retryCj.textContent='Retrying CJ…';try{const r=await fetch('/api/admin/orders/'+encodeURIComponent(retryCj.dataset.retryCj)+'/cj-sandbox-retry',{method:'POST',headers:{'Accept':'application/json'}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to retry CJ sandbox.');toast(d.order?.cj_status==='paid_300'?'CJ Sandbox order is paid.':'CJ Sandbox retry finished.');await loadAdminOrders();}catch(err){retryCj.disabled=false;retryCj.textContent='Retry CJ Sandbox';toast(S.text(err.message||'Unable to retry CJ sandbox.',140));}}
    if(approve){if(!confirm('Approve this refund and send it to Stripe now?'))return;approve.disabled=true;approve.textContent='Refunding…';try{const r=await fetch('/api/admin/orders/'+encodeURIComponent(approve.dataset.approveRefund)+'/approve-refund',{method:'POST',headers:{'Accept':'application/json'}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to approve refund.');toast(d.status==='refunded'?'Refund completed.':'Refund sent to Stripe.');await loadAdminOrders();}catch(err){approve.disabled=false;approve.textContent='Approve Refund';toast(S.text(err.message||'Unable to approve refund.',140));}}
  });

  // -------- Homepage banner editor --------
  const CONTENT_KEY='averon_content_v1';
  const MOBILE_CONTENT_KEY='averon_content_mobile_v1';
  const CONTENT_DEFAULTS={
    hero:{eyebrow:'British Menswear · Est. Modern',title:'DEFINED BY\nSIMPLICITY.',subtitle:'Modern menswear with a timeless British attitude.',buttonText:'Shop New In',buttonLink:'#new-in',image:'',overlayEnabled:true,hotspot:{enabled:false,link:'',x:58,y:68,w:24,h:12}},
    editorial:{eyebrow:'Timeless by Design',title:'Timeless by Design.',subtitle:'Designed to move effortlessly between the city and the weekend.',buttonText:'Explore the Edit',buttonLink:'index.html#collection',image:'',overlayEnabled:true,hotspot:{enabled:false,link:'',x:58,y:68,w:24,h:12}}
  };
  function safeContentLink(v,fallback){let x=String(v||'').trim();if(!x)return fallback||'';if(/^[A-Za-z0-9_-]+$/.test(x)&&!x.includes('.'))x='#'+x;if(/^#[A-Za-z0-9_-]+$/.test(x))return x;try{const u=new URL(x,location.origin);if(!/^https?:$/.test(u.protocol))return fallback||'';if(u.origin!==location.origin)return u.href.slice(0,500);let p=u.pathname.replace(/^\/+/, '');if(!p)p='index.html';if(!/^(?:index|product|clothing|jackets|trousers|accessories|checkout|account|orders|success|edit)\.html$/.test(p))return fallback||'';const search=/^\?[^\s#]*$/.test(u.search)?u.search:'';const hash=u.hash&&/^#[A-Za-z0-9_-]+$/.test(u.hash)?u.hash:'';return p+search+hash}catch(_){return fallback||'';}}
    function sanitizeBannerHotspots(raw,legacy){
    let list=Array.isArray(raw)?raw:(legacy&&typeof legacy==='object'?[legacy]:[]);
    return list.slice(0,8).map((v,i)=>{v=v&&typeof v==='object'?v:{};const n=(x,f,min,max)=>{x=Number(x);return Number.isFinite(x)?Math.min(max,Math.max(min,x)):f};const x=n(v.x,58,0,99),y=n(v.y,68,0,99);return {id:S.text(v.id||('hotspot-'+Date.now()+'-'+i),50),enabled:v.enabled!==false,link:safeContentLink(v.link,''),x,y,w:Math.min(n(v.w,24,1,100),100-x),h:Math.min(n(v.h,12,1,100),100-y)}}).filter(v=>v.w>0&&v.h>0);
  }
  function cleanContent(raw,fallback=CONTENT_DEFAULTS){raw=raw&&typeof raw==='object'?raw:{};const out={};Object.keys(CONTENT_DEFAULTS).forEach(k=>{const d=fallback[k]||CONTENT_DEFAULTS[k],r=raw[k]&&typeof raw[k]==='object'?raw[k]:{};out[k]={eyebrow:S.text(r.eyebrow||d.eyebrow,80),title:S.text(r.title||d.title,140),subtitle:S.text(r.subtitle||d.subtitle,260),buttonText:S.text(r.buttonText||d.buttonText,50),buttonLink:safeContentLink(r.buttonLink,d.buttonLink),image:S.imageSrc(r.image)||S.imageSrc(d.image),overlayEnabled:r.overlayEnabled!==undefined?r.overlayEnabled!==false:d.overlayEnabled!==false,hotspots:sanitizeBannerHotspots(r.hotspots,r.hotspot)}});return out;}
  let desktopContent=cleanContent(S.safeJson(localStorage.getItem(CONTENT_KEY)||'{}',{}));
  let mobileContent=cleanContent(S.safeJson(localStorage.getItem(MOBILE_CONTENT_KEY)||'{}',{}),desktopContent);
  function reloadBannerStores(){
    desktopContent=cleanContent(S.safeJson(localStorage.getItem(CONTENT_KEY)||'{}',{}));
    mobileContent=cleanContent(S.safeJson(localStorage.getItem(MOBILE_CONTENT_KEY)||'{}',{}),desktopContent);
  }
  let currentBanner='hero',currentBannerDevice='desktop',pendingBannerImage=null,removeBannerImage=false;const bannerDrafts=new Map();let bannerDirty=false;
  function bannerStore(){return currentBannerDevice==='mobile'?mobileContent:desktopContent}
  function bannerStorageKey(){return currentBannerDevice==='mobile'?MOBILE_CONTENT_KEY:CONTENT_KEY}
  function saveContent(){try{localStorage.setItem(bannerStorageKey(),JSON.stringify(bannerStore()));return true}catch(_){return false}}
  function bannerLabel(k){return k==='hero'?'Hero Banner':'Editorial Banner'}
  function bannerDeviceSize(){return currentBannerDevice==='mobile'?'1080 × 1500 pixels':'1920 × 750 pixels'}
  function setBannerDevice(device){currentBannerDevice=device==='mobile'?'mobile':'desktop';const label=currentBannerDevice==='mobile'?'Mobile':'Desktop';$('banner-device-heading').textContent=label;$('banner-editor-device').textContent=label;$('banner-sidebar-size').textContent=`${label} banner size: ${bannerDeviceSize()}.`;$('banner-size-note').textContent=`Recommended ${currentBannerDevice} size: ${bannerDeviceSize()}.`;const mobile=currentBannerDevice==='mobile';$('banner-preview-wrap').classList.toggle('mobile-preview',mobile);$('banner-preview').classList.toggle('mobile-preview',mobile);$('banner-preview-note').innerHTML=mobile?'<strong>Mobile preview · 1080 × 1500 pixels · vertical</strong>':'<strong>Desktop preview · 1920 × 750 pixels · horizontal</strong>';}
  let bannerHotspots=[],selectedHotspotId=null;
  function clampHotspot(hs){const n=(v,f,min,max)=>{v=Number(v);return Number.isFinite(v)?Math.min(max,Math.max(min,v)):f};const x=n(hs?.x,58,0,99),y=n(hs?.y,68,0,99);return {id:String(hs?.id||('hotspot-'+Date.now()+'-'+Math.random().toString(36).slice(2,7))),enabled:hs?.enabled!==false,link:String(hs?.link||''),x,y,w:Math.min(n(hs?.w,24,1,100),100-x),h:Math.min(n(hs?.h,12,1,100),100-y)}}
  function selectedHotspot(){return bannerHotspots.find(h=>h.id===selectedHotspotId)||null}
  function hotspotSummary(h,i){return h.link||('Clickable area '+(i+1))}
  function populateSelectedHotspotFields(){
    const sel=selectedHotspot(),settings=$('banner-hotspot-settings');settings.hidden=!sel;if(!sel)return;
    const i=bannerHotspots.findIndex(h=>h.id===sel.id);
    $('banner-hotspot-selected-label').textContent='Clickable area '+(i+1);
    $('banner-hotspot-enabled').checked=sel.enabled;
    $('banner-hotspot-link').value=sel.link;
    $('banner-hotspot-x').value=sel.x.toFixed(1);
    $('banner-hotspot-y').value=sel.y.toFixed(1);
    $('banner-hotspot-w').value=sel.w.toFixed(1);
    $('banner-hotspot-h').value=sel.h.toFixed(1);
  }
  function syncHotspotSelectionVisuals(){
    document.querySelectorAll('.banner-hotspot-row').forEach(row=>row.classList.toggle('active',row.dataset.hotspotId===selectedHotspotId));
    document.querySelectorAll('.banner-hotspot-guide').forEach(guide=>guide.classList.toggle('selected',guide.dataset.hotspotId===selectedHotspotId));
  }
  function syncHotspotGeometry(id,updateFields=false){
    const hs=bannerHotspots.find(h=>h.id===id);if(!hs)return;
    const guide=document.querySelector(`.banner-hotspot-guide[data-hotspot-id="${CSS.escape(id)}"]`);
    if(guide){guide.style.left=hs.x+'%';guide.style.top=hs.y+'%';guide.style.width=hs.w+'%';guide.style.height=hs.h+'%';guide.classList.toggle('inactive',!hs.enabled)}
    if(updateFields&&id===selectedHotspotId){
      $('banner-hotspot-x').value=hs.x.toFixed(1);$('banner-hotspot-y').value=hs.y.toFixed(1);$('banner-hotspot-w').value=hs.w.toFixed(1);$('banner-hotspot-h').value=hs.h.toFixed(1);
    }
  }
  function syncHotspotRow(id){
    const hs=bannerHotspots.find(h=>h.id===id);if(!hs)return;const i=bannerHotspots.findIndex(h=>h.id===id);
    const row=document.querySelector(`.banner-hotspot-row[data-hotspot-id="${CSS.escape(id)}"]`);
    if(row){const strong=row.querySelector('strong'),small=row.querySelector('small');if(strong)strong.textContent='Clickable area '+(i+1)+(hs.enabled?'':' · inactive');if(small)small.textContent=hotspotSummary(hs,i)}
  }
  function renderHotspotsAdmin(){
    const list=$('banner-hotspot-list'),empty=$('banner-hotspot-empty'),settings=$('banner-hotspot-settings'),layer=$('banner-hotspot-layer');
    list.replaceChildren();layer.replaceChildren();empty.hidden=bannerHotspots.length>0;
    bannerHotspots.forEach((hs,i)=>{
      const row=document.createElement('div');row.className='banner-hotspot-row'+(hs.id===selectedHotspotId?' active':'');row.dataset.hotspotId=hs.id;
      const meta=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');
      strong.textContent='Clickable area '+(i+1)+(hs.enabled?'':' · inactive');small.textContent=hotspotSummary(hs,i);meta.append(strong,small);
      const select=document.createElement('button');select.type='button';select.className='admin-btn';select.textContent='Edit';
      select.onclick=e=>{e.stopPropagation();selectHotspot(hs.id)};row.onclick=()=>selectHotspot(hs.id);row.append(meta,select);list.append(row);
      const guide=document.createElement('div');guide.className='banner-hotspot-guide'+(hs.id===selectedHotspotId?' selected':'')+(hs.enabled?'':' inactive');guide.dataset.hotspotId=hs.id;
      guide.style.left=hs.x+'%';guide.style.top=hs.y+'%';guide.style.width=hs.w+'%';guide.style.height=hs.h+'%';
      const label=document.createElement('span');label.textContent='Area '+(i+1);const handle=document.createElement('button');handle.type='button';handle.className='banner-hotspot-resize';handle.setAttribute('aria-label','Resize clickable area '+(i+1));guide.append(label,handle);layer.append(guide);
      enableGuideDrag(guide,handle,hs.id);
    });
    settings.hidden=!selectedHotspot();populateSelectedHotspotFields();
  }
  function selectHotspot(id){selectedHotspotId=id;syncHotspotSelectionVisuals();populateSelectedHotspotFields()}
  function updateSelectedHotspot(patch,opts={}){
    const i=bannerHotspots.findIndex(h=>h.id===selectedHotspotId);if(i<0)return;
    bannerHotspots[i]=clampHotspot({...bannerHotspots[i],...patch});bannerDirty=true;
    syncHotspotGeometry(selectedHotspotId,opts.updateFields===true);syncHotspotRow(selectedHotspotId);
    $('banner-status').textContent='Unsaved invisible clickable area changes.';
  }
  function enableGuideDrag(guide,handle,id){
    const stage=$('banner-preview-stage');const pct=ev=>{const r=stage.getBoundingClientRect();return{x:(ev.clientX-r.left)/r.width*100,y:(ev.clientY-r.top)/r.height*100}};
    guide.addEventListener('pointerdown',ev=>{
      if(ev.target===handle)return;ev.preventDefault();ev.stopPropagation();
      selectedHotspotId=id;syncHotspotSelectionVisuals();populateSelectedHotspotFields();
      const base={...bannerHotspots.find(h=>h.id===id)},start=pct(ev);guide.setPointerCapture(ev.pointerId);
      const move=e=>{const q=pct(e);updateSelectedHotspot({x:base.x+q.x-start.x,y:base.y+q.y-start.y},{updateFields:true})};
      const up=()=>{guide.removeEventListener('pointermove',move);guide.removeEventListener('pointerup',up);guide.removeEventListener('pointercancel',up)};
      guide.addEventListener('pointermove',move);guide.addEventListener('pointerup',up);guide.addEventListener('pointercancel',up);
    });
    handle.addEventListener('pointerdown',ev=>{
      ev.preventDefault();ev.stopPropagation();selectedHotspotId=id;syncHotspotSelectionVisuals();populateSelectedHotspotFields();
      const base={...bannerHotspots.find(h=>h.id===id)},start=pct(ev);handle.setPointerCapture(ev.pointerId);
      const move=e=>{const q=pct(e);updateSelectedHotspot({w:base.w+q.x-start.x,h:base.h+q.y-start.y},{updateFields:true})};
      const up=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up)};
      handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up);
    });
  }
  function captureCurrentBannerDraft(){if(!currentBanner||!bannerDirty)return;const store=bannerStore();bannerDrafts.set(currentBannerDevice+':'+currentBanner,{image:removeBannerImage?'':(pendingBannerImage||store[currentBanner].image),removeImage:removeBannerImage,hotspots:bannerHotspots.map(h=>({...h}))});}
  function discardBannerDrafts(){bannerDrafts.clear();bannerDirty=false;pendingBannerImage=null;removeBannerImage=false;bannerHotspots=[];selectedHotspotId=null}
  function loadBanner(k,opts={}){if(!CONTENT_DEFAULTS[k])return;if(opts.capture!==false)captureCurrentBannerDraft();currentBanner=k;pendingBannerImage=null;removeBannerImage=false;const store=bannerStore(),draft=bannerDrafts.get(currentBannerDevice+':'+k),b=draft||store[k];document.querySelectorAll('[data-banner-select]').forEach(x=>x.classList.toggle('active',x.dataset.bannerSelect===k));if(draft){pendingBannerImage=draft.image&&!draft.removeImage&&draft.image!==store[k].image?draft.image:null;removeBannerImage=!!draft.removeImage}$('banner-editor-title').textContent=bannerLabel(k);bannerHotspots=sanitizeBannerHotspots(b.hotspots,b.hotspot).map(clampHotspot);selectedHotspotId=bannerHotspots[0]?.id||null;renderHotspotsAdmin();$('banner-image').value='';const image=removeBannerImage?'':(b.image||'');const preview=$('banner-preview');preview.src=image||'assets/logo-navy.png';preview.classList.toggle('placeholder',!image);$('banner-reset-image').textContent=currentBannerDevice==='mobile'?'Use Desktop Image':'Remove Image';bannerDirty=!!draft;$('banner-status').textContent=draft?'Unsaved changes kept for this banner.':'No unsaved changes.';}
  document.querySelectorAll('[data-banner-select]').forEach(b=>b.addEventListener('click',()=>loadBanner(b.dataset.bannerSelect)));
  async function readBannerImage(file,max=2200){return new Promise((resolve,reject)=>{if(!file)return resolve(null);if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)return reject(new Error('Use a PNG, JPEG or WebP image up to 10 MB.'));const img=new Image(),r=new FileReader();r.onload=()=>{img.onload=()=>{if(!img.width||!img.height||img.width*img.height>50_000_000)return reject(new Error('Banner dimensions are too large.'));const scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));const ctx=c.getContext('2d',{alpha:false});ctx.fillStyle='#00293f';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);const data=c.toDataURL('image/jpeg',.84);if(!S.imageSrc(data))return reject(new Error('The optimised banner is still too large. Try a smaller image.'));resolve(data)};img.onerror=()=>reject(new Error('Invalid image file.'));img.src=String(r.result)};r.onerror=()=>reject(new Error('Could not read image.'));r.readAsDataURL(file)})}
  $('banner-image').addEventListener('change',async e=>{try{const data=await readBannerImage(e.target.files[0]);if(!data)return;pendingBannerImage=data;removeBannerImage=false;$('banner-preview').src=data;$('banner-preview').classList.remove('placeholder');bannerDirty=true;$('banner-status').textContent=`Unsaved ${currentBannerDevice} banner image.`}catch(err){e.target.value='';toast(err.message)}});
$('banner-hotspot-add').addEventListener('click',()=>{if(bannerHotspots.length>=8)return toast('A maximum of 8 clickable areas can be added to one banner.');const hs=clampHotspot({enabled:true,link:'',x:10+bannerHotspots.length*4,y:70,w:20,h:10});bannerHotspots.push(hs);selectedHotspotId=hs.id;bannerDirty=true;renderHotspotsAdmin();$('banner-status').textContent='New invisible clickable area added. Set its destination link before saving.';});
  $('banner-hotspot-remove').addEventListener('click',()=>{if(!selectedHotspotId)return;bannerHotspots=bannerHotspots.filter(h=>h.id!==selectedHotspotId);selectedHotspotId=bannerHotspots[0]?.id||null;bannerDirty=true;renderHotspotsAdmin();$('banner-status').textContent='Clickable area removed. Save the banner to apply.';});
  $('banner-hotspot-enabled').addEventListener('change',()=>updateSelectedHotspot({enabled:$('banner-hotspot-enabled').checked}));
  $('banner-hotspot-link').addEventListener('input',()=>updateSelectedHotspot({link:$('banner-hotspot-link').value}));
  $('banner-hotspot-x').addEventListener('input',()=>updateSelectedHotspot({x:$('banner-hotspot-x').value}));
  $('banner-hotspot-y').addEventListener('input',()=>updateSelectedHotspot({y:$('banner-hotspot-y').value}));
  $('banner-hotspot-w').addEventListener('input',()=>updateSelectedHotspot({w:$('banner-hotspot-w').value}));
  $('banner-hotspot-h').addEventListener('input',()=>updateSelectedHotspot({h:$('banner-hotspot-h').value}));
  $('banner-reset-image').addEventListener('click',()=>{pendingBannerImage=null;removeBannerImage=true;$('banner-image').value='';const fallback=currentBannerDevice==='mobile'?desktopContent[currentBanner].image:'';$('banner-preview').src=fallback||'assets/logo-navy.png';$('banner-preview').classList.toggle('placeholder',!fallback);bannerDirty=true;$('banner-status').textContent=currentBannerDevice==='mobile'?'Mobile image will fall back to the desktop artwork when saved.':'Banner image will be removed when saved.';});
  $('banner-form').addEventListener('submit',async e=>{e.preventDefault();bannerDirty=true;captureCurrentBannerDraft();const key=currentBannerDevice+':'+currentBanner,d=CONTENT_DEFAULTS[currentBanner],draft=bannerDrafts.get(key),store=bannerStore();if(!draft)return;const invalidHotspot=(draft.hotspots||[]).find(h=>h.enabled&&!safeContentLink(h.link,''));if(invalidHotspot){toast('Each active clickable area needs a valid internal destination, for example product.html, #new-in or /clothing.html.');return;}const fallback=currentBannerDevice==='mobile'?desktopContent[currentBanner]:d;store[currentBanner]={eyebrow:fallback.eyebrow,title:fallback.title,subtitle:fallback.subtitle,buttonText:fallback.buttonText,buttonLink:fallback.buttonLink,image:draft.removeImage?'':S.imageSrc(draft.image),overlayEnabled:false,hotspots:(draft.hotspots||[]).map(clampHotspot).map(h=>({id:h.id,enabled:h.enabled,link:safeContentLink(h.link,''),x:h.x,y:h.y,w:h.w,h:h.h}))};const localOk=saveContent();const serverOk=await persistSiteContentServer();if(!serverOk){$('banner-status').textContent='Could not save to the server. Your unsaved banner is still open.';toast('Banner was not saved. Please try again.');return;}backupAllContentLocally();bannerDrafts.delete(key);bannerDirty=false;pendingBannerImage=null;removeBannerImage=false;loadBanner(currentBanner,{capture:false});$('banner-status').textContent=localOk?'Saved to server and browser backup.':'Saved to server. Browser backup is full.';toast(`${currentBannerDevice==='mobile'?'Mobile':'Desktop'} banner saved.`)});
  setBannerDevice('desktop');loadBanner('hero',{capture:false});

  // -------- Mini banner editor --------
  const MINI_KEY='averon_mini_content_v1';
  const MOBILE_MINI_KEY='averon_mini_content_mobile_v1';
  const MINI_DEFAULTS={
    intro:{eyebrow:'The Art of Understatement',title:'Refined essentials,\nconsidered details.',subtitle:'Refined essentials, considered details and timeless silhouettes — designed for modern British living. Nothing shouts. Everything is deliberate.',buttonText:'',buttonLink:'',image:'',linkedProducts:[]},
    'category-clothing':{eyebrow:'Shop',title:'Clothing',subtitle:'',buttonText:'',buttonLink:'clothing.html',image:''},
    'category-jackets':{eyebrow:'Shop',title:'Jackets',subtitle:'',buttonText:'',buttonLink:'jackets.html',image:''},
    'category-trousers':{eyebrow:'Shop',title:'Trousers',subtitle:'',buttonText:'',buttonLink:'trousers.html',image:''},
    'category-accessories':{eyebrow:'Shop',title:'Accessories',subtitle:'',buttonText:'',buttonLink:'accessories.html',image:''},
    'city-edit':{eyebrow:'',title:'The City Edit',subtitle:'Oxford Shirt · Tailored Trouser · Watch · Sunglasses',buttonText:'Shop the Edit',buttonLink:'product.html',image:'',linkedProducts:[]},
    'weekend-edit':{eyebrow:'',title:'The Weekend Edit',subtitle:'Merino Tee · Overshirt Jacket · Relaxed Trouser · Wool Scarf',buttonText:'Shop the Edit',buttonLink:'product.html',image:'',linkedProducts:[]}
  };
  function cleanMini(raw,fallback=MINI_DEFAULTS){raw=raw&&typeof raw==='object'?raw:{};const out={};Object.keys(MINI_DEFAULTS).forEach(k=>{const d=fallback[k]||MINI_DEFAULTS[k],r=raw[k]&&typeof raw[k]==='object'?raw[k]:{};out[k]={eyebrow:S.text(r.eyebrow||d.eyebrow,80),title:S.text(r.title||d.title,140),subtitle:S.text(r.subtitle||d.subtitle,260),buttonText:S.text(r.buttonText||d.buttonText,50),buttonLink:safeContentLink(r.buttonLink,d.buttonLink),image:S.imageSrc(r.image)||S.imageSrc(d.image),linkedProducts:Array.isArray(r.linkedProducts)?r.linkedProducts.map(S.id).filter(Boolean).slice(0,12):(Array.isArray(d.linkedProducts)?d.linkedProducts:[])}});return out;}
  let desktopMinis=cleanMini(S.safeJson(localStorage.getItem(MINI_KEY)||'{}',{}));
  let mobileMinis=cleanMini(S.safeJson(localStorage.getItem(MOBILE_MINI_KEY)||'{}',{}),desktopMinis);
  function reloadMiniStores(){
    desktopMinis=cleanMini(S.safeJson(localStorage.getItem(MINI_KEY)||'{}',{}));
    mobileMinis=cleanMini(S.safeJson(localStorage.getItem(MOBILE_MINI_KEY)||'{}',{}),desktopMinis);
  }

  function siteContentSnapshot(){return {desktopContent,mobileContent,desktopMinis,mobileMinis}}
  function backupAllContentLocally(){
    try{localStorage.setItem(CONTENT_KEY,JSON.stringify(desktopContent))}catch(_){}
    try{localStorage.setItem(MOBILE_CONTENT_KEY,JSON.stringify(mobileContent))}catch(_){}
    try{localStorage.setItem(MINI_KEY,JSON.stringify(desktopMinis))}catch(_){}
    try{localStorage.setItem(MOBILE_MINI_KEY,JSON.stringify(mobileMinis))}catch(_){}
  }
  async function persistSiteContentServer(){
    try{
      const r=await fetch('/api/admin/site-content',{method:'PUT',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({content:siteContentSnapshot()})});
      const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Server content save failed.');return true;
    }catch(err){console.error('Site content server save failed:',err);return false}
  }
  async function hydrateSiteContentFromServer(){
    await adminReady;
    try{
      const r=await fetch('/api/site-content',{headers:{Accept:'application/json'},cache:'no-store'}),data=await r.json();
      if(!r.ok)throw new Error(data.error||'Could not load site content.');
      if(data.initialized&&data.content){
        desktopContent=cleanContent(data.content.desktopContent||{});
        mobileContent=cleanContent(data.content.mobileContent||{},desktopContent);
        desktopMinis=cleanMini(data.content.desktopMinis||{});
        mobileMinis=cleanMini(data.content.mobileMinis||{},desktopMinis);
        backupAllContentLocally();
      }else{
        // First run after this update: migrate the existing browser content instead of erasing it.
        await persistSiteContentServer();
      }
      if(activeAdminPanel==='banners')loadBanner(currentBanner,{capture:false});
      if(activeAdminPanel==='mini-banners')loadMini(currentMini,{capture:false});
    }catch(err){console.warn('Server content hydration failed; browser backup retained.',err)}
  }
  let currentMini='intro',currentMiniDevice='desktop',pendingMiniImage=null,removeMiniImage=false;const miniDrafts=new Map();let miniDirty=false;
  function miniStore(){return currentMiniDevice==='mobile'?mobileMinis:desktopMinis}
  function miniStorageKey(){return currentMiniDevice==='mobile'?MOBILE_MINI_KEY:MINI_KEY}
  function saveMinis(){try{localStorage.setItem(miniStorageKey(),JSON.stringify(miniStore()));return true}catch(_){return false}}
  const miniLabels={intro:'Refined Essentials','category-clothing':'Category — Clothing','category-jackets':'Category — Jackets','category-trousers':'Category — Trousers','category-accessories':'Category — Accessories','city-edit':'The City Edit','weekend-edit':'The Weekend Edit'};
  function setMiniDevice(device){currentMiniDevice=device==='mobile'?'mobile':'desktop';const label=currentMiniDevice==='mobile'?'Mobile':'Desktop';$('mini-device-heading').textContent=label;$('mini-editor-device').textContent=label;if(currentMiniDevice==='mobile')$('mini-sidebar-help').innerHTML='<strong>Mobile mini banner size:</strong><br>All mini banners: 1080 × 1350 pixels.<br>These mobile slots use a dedicated vertical 4:5 crop.';else $('mini-sidebar-help').innerHTML='<strong>Desktop mini banner sizes:</strong><br>Refined Essentials: 1200 × 1500 pixels.<br>Category tiles: 900 × 1200 pixels.<br>City / Weekend Edit: 1000 × 1200 pixels.<br>All desktop mini-banner previews are vertical and match their exact slot proportions.';applyMiniPreviewFrame(currentMini);}
  function miniRecommendedSize(k){if(currentMiniDevice==='mobile')return 'Recommended mobile size: 1080 × 1350 pixels.';if(k==='intro')return 'Recommended desktop size: 1200 × 1500 pixels.';if(k==='city-edit'||k==='weekend-edit')return 'Recommended desktop size: 1000 × 1200 pixels.';return 'Recommended desktop size: 900 × 1200 pixels.';}
  function miniPreviewSpec(k){
    if(currentMiniDevice==='mobile')return {w:1080,h:1350,label:'Mobile preview · 1080 × 1350 pixels · vertical'};
    if(k==='intro')return {w:1200,h:1500,label:'Desktop preview · 1200 × 1500 pixels · vertical'};
    if(k==='city-edit'||k==='weekend-edit')return {w:1000,h:1200,label:'Desktop preview · 1000 × 1200 pixels · vertical'};
    return {w:900,h:1200,label:'Desktop preview · 900 × 1200 pixels · vertical'};
  }
  function applyMiniPreviewFrame(k){
    const spec=miniPreviewSpec(k),preview=$('mini-preview'),wrap=$('mini-preview-wrap'),note=$('mini-preview-note');
    if(preview)preview.style.aspectRatio=`${spec.w} / ${spec.h}`;
    if(note)note.innerHTML=`<strong>${spec.label}</strong>`;
    if(wrap)wrap.classList.toggle('mobile-mini-preview',currentMiniDevice==='mobile');
  }
  const miniCategoryKeys=new Set(['category-clothing','category-jackets','category-trousers','category-accessories']);
  function miniSupportsEditProducts(k){return !miniCategoryKeys.has(k)}
  function selectedMiniProducts(){return [...document.querySelectorAll('#mini-products-list input[type="checkbox"]:checked')].map(x=>S.id(x.value)).filter(Boolean).slice(0,12)}
  function renderMiniProductChoices(selected=[]){
    const field=$('mini-products-field'),list=$('mini-products-list');if(!field||!list)return;
    const enabled=miniSupportsEditProducts(currentMini);field.hidden=!enabled;list.replaceChildren();if(!enabled)return;
    const chosen=new Set((Array.isArray(selected)?selected:[]).map(S.id));
    products.forEach(p=>{const label=document.createElement('label');label.style.cssText='display:flex;align-items:center;gap:9px;padding:9px 10px;border:1px solid var(--admin-line);background:#fff;cursor:pointer';const input=document.createElement('input');input.type='checkbox';input.value=p.id;input.checked=chosen.has(p.id);input.addEventListener('change',()=>{miniDirty=true;$('mini-status').textContent=`Unsaved ${currentMiniDevice} Edit product selection.`});const span=document.createElement('span');span.textContent=p.name;label.append(input,span);list.appendChild(label)});
    if(!products.length){const empty=document.createElement('p');empty.className='admin-note';empty.textContent='Add products to the catalogue first.';list.appendChild(empty)}
  }
  function captureCurrentMiniDraft(){if(!currentMini||!miniDirty)return;const store=miniStore();miniDrafts.set(currentMiniDevice+':'+currentMini,{eyebrow:$('mini-eyebrow').value,title:$('mini-title').value,subtitle:$('mini-subtitle').value,buttonText:$('mini-button-text').value,buttonLink:$('mini-button-link').value,image:removeMiniImage?'':(pendingMiniImage||store[currentMini].image),removeImage:removeMiniImage,linkedProducts:miniSupportsEditProducts(currentMini)?selectedMiniProducts():[]});}
  function discardMiniDrafts(){miniDrafts.clear();miniDirty=false;pendingMiniImage=null;removeMiniImage=false}
  function loadMini(k,opts={}){if(!MINI_DEFAULTS[k])return;if(opts.capture!==false)captureCurrentMiniDraft();currentMini=k;pendingMiniImage=null;removeMiniImage=false;const store=miniStore(),draft=miniDrafts.get(currentMiniDevice+':'+k),b=draft||store[k];document.querySelectorAll('[data-mini-select]').forEach(x=>x.classList.toggle('active',x.dataset.miniSelect===k));if(draft){pendingMiniImage=draft.image&&!draft.removeImage&&draft.image!==store[k].image?draft.image:null;removeMiniImage=!!draft.removeImage}$('mini-editor-title').textContent=miniLabels[k]||'Mini Banner';$('mini-size-note').textContent=miniRecommendedSize(k);applyMiniPreviewFrame(k);$('mini-eyebrow').value=b.eyebrow;$('mini-title').value=b.title;$('mini-subtitle').value=b.subtitle;$('mini-button-text').value=b.buttonText;$('mini-button-link').value=b.buttonLink;renderMiniProductChoices(b.linkedProducts||[]);$('mini-image').value='';const image=removeMiniImage?'':(b.image||'');const preview=$('mini-preview');preview.src=image||'assets/logo-navy.png';preview.classList.toggle('placeholder',!image);$('mini-reset-image').textContent=currentMiniDevice==='mobile'?'Use Desktop Image':'Remove Image';miniDirty=!!draft;$('mini-status').textContent=draft?'Unsaved changes kept for this mini banner.':'No unsaved changes.';}
  document.querySelectorAll('[data-mini-select]').forEach(b=>b.addEventListener('click',()=>loadMini(b.dataset.miniSelect)));
  $('mini-image').addEventListener('change',async e=>{try{const data=await readBannerImage(e.target.files[0],1600);if(!data)return;pendingMiniImage=data;removeMiniImage=false;$('mini-preview').src=data;$('mini-preview').classList.remove('placeholder');miniDirty=true;$('mini-status').textContent=`Unsaved ${currentMiniDevice} mini-banner image.`}catch(err){e.target.value='';toast(err.message)}});
  ['mini-eyebrow','mini-title','mini-subtitle','mini-button-text','mini-button-link'].forEach(id=>$(id).addEventListener('input',()=>{miniDirty=true;$('mini-status').textContent=`Unsaved ${currentMiniDevice} mini-banner changes.`}));
  $('mini-reset-image').addEventListener('click',()=>{pendingMiniImage=null;removeMiniImage=true;$('mini-image').value='';const fallback=currentMiniDevice==='mobile'?desktopMinis[currentMini].image:'';$('mini-preview').src=fallback||'assets/logo-navy.png';$('mini-preview').classList.toggle('placeholder',!fallback);miniDirty=true;$('mini-status').textContent=currentMiniDevice==='mobile'?'Mobile image will fall back to the desktop artwork when saved.':'Mini-banner image will be removed when saved.';});
  $('mini-form').addEventListener('submit',async e=>{e.preventDefault();miniDirty=true;captureCurrentMiniDraft();const key=currentMiniDevice+':'+currentMini,d=MINI_DEFAULTS[currentMini],draft=miniDrafts.get(key),store=miniStore(),fallback=currentMiniDevice==='mobile'?desktopMinis[currentMini]:d;if(!draft)return;const linkedProducts=miniSupportsEditProducts(currentMini)?(Array.isArray(draft.linkedProducts)?draft.linkedProducts.map(S.id).filter(Boolean).slice(0,12):[]):[];store[currentMini]={eyebrow:S.text(draft.eyebrow||fallback.eyebrow,80),title:S.text(draft.title||fallback.title,140),subtitle:S.text(draft.subtitle||fallback.subtitle,260),buttonText:S.text(draft.buttonText||(linkedProducts.length?'Shop the Edit':fallback.buttonText),50),buttonLink:linkedProducts.length?`edit.html?edit=${encodeURIComponent(currentMini)}`:safeContentLink(draft.buttonLink,fallback.buttonLink),image:draft.removeImage?'':S.imageSrc(draft.image),linkedProducts};const localOk=saveMinis();const serverOk=await persistSiteContentServer();if(!serverOk){$('mini-status').textContent='Could not save to the server. Your unsaved mini banner is still open.';toast('Mini banner was not saved. Please try again.');return;}backupAllContentLocally();miniDrafts.delete(key);miniDirty=false;pendingMiniImage=null;removeMiniImage=false;loadMini(currentMini,{capture:false});$('mini-status').textContent=localOk?'Saved to server and browser backup.':'Saved to server. Browser backup is full.';toast(`${currentMiniDevice==='mobile'?'Mobile':'Desktop'} mini banner saved.`)});
  setMiniDevice('desktop');loadMini('intro',{capture:false});

  window.addEventListener('storage',e=>{
    if(e.key===CONTENT_KEY||e.key===MOBILE_CONTENT_KEY){reloadBannerStores();if(activeAdminPanel==='banners')loadBanner(currentBanner,{capture:false})}
    if(e.key===MINI_KEY||e.key===MOBILE_MINI_KEY){reloadMiniStores();if(activeAdminPanel==='mini-banners')loadMini(currentMini,{capture:false})}
  });

  $('logout-btn').textContent='Sign Out';$('logout-btn').onclick=async()=>{try{await fetch('/api/admin/auth/logout',{method:'POST',headers:{Accept:'application/json'}})}catch(_){}location.replace('/admin-login.html')};
  adminReady.then(async()=>{
    try{
      const r=await fetch('/api/catalog',{headers:{Accept:'application/json'},cache:'no-store'});
      const data=await r.json();
      if(r.ok&&Array.isArray(data.products)&&data.products.length){
        products=S.products(data.products,defaults);
        currentId=products.some(p=>p.id===currentId)?currentId:products[0]?.id;
        saveAll();
      }
    }catch(err){console.warn('Admin could not refresh the server catalogue; lightweight browser cache retained.',err)}
    renderList();
    if(currentId)loadProduct(currentId,{capture:false});
    hydrateSiteContentFromServer();
  });
})();
