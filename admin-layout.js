(function(){
'use strict';
const registry=Array.isArray(window.AVERON_LAYOUT_REGISTRY)?window.AVERON_LAYOUT_REGISTRY:[];
const $=id=>document.getElementById(id), studio=$('layout-studio'), list=$('layout-list'), status=$('layout-status');
let saved={entries:{}}, draft={}, dirty=false;
function toast(msg){const t=$('toast');t.textContent=String(msg||'').slice(0,180);t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
async function auth(){try{const r=await fetch('/api/admin/auth/session',{headers:{Accept:'application/json'},cache:'no-store'});if(!r.ok)throw new Error();studio.hidden=false}catch(_){location.replace('/admin-login.html?next='+encodeURIComponent('/admin-layout.html'));throw _}}
function stateFor(item){const s=draft[item.id]||saved.entries?.[item.id]||{};return {text:typeof s.text==='string'?s.text:item.defaultText}}
function touch(id,next){draft[id]=next;dirty=true;status.textContent='Unsaved text changes.'}
function card(item){const st=stateFor(item),c=document.createElement('article');c.className='card';c.dataset.search=(item.defaultText+' '+item.page+' '+item.section).toLowerCase();c.dataset.page=item.page;
 const h=document.createElement('div');h.className='card-head';const hw=document.createElement('div');const strong=document.createElement('strong');strong.textContent=item.defaultText.length>70?item.defaultText.slice(0,70)+'…':item.defaultText;const meta=document.createElement('div');meta.className='meta';meta.textContent=item.section+' · '+item.tag;hw.append(strong,meta);h.append(hw);
 const tf=document.createElement('div');tf.className='text-field';const lab=document.createElement('label');lab.textContent='Text';const ta=document.createElement('textarea');ta.value=st.text;ta.addEventListener('input',()=>{touch(item.id,{text:ta.value})});tf.append(lab,ta);
 c.append(h,tf);return c}
function groupName(item){
 const home={
  'index-the-art-of-understatement':'Editorial Intro','index-refined-essentials-considered-details':'Editorial Intro','index-refined-essentials-considered-details-and-':'Editorial Intro','index-shop-the-edit':'Editorial Intro',
  'index-the-collection':'The Collection · Shop by Category','index-shop-by-category':'The Collection · Shop by Category',
  'index-new-in-3':'New In · Modern Essentials','index-modern-essentials-timeless-attitude':'New In · Modern Essentials',
  'index-the-averon-edit':'The AVERON Edit','index-a-considered-selection-of-modern-essential':'The AVERON Edit'
 };
 if(home[item.id])return home[item.id];
 if(item.page==='index.html'){
  if(/^index-(the-collection|shop-by-category|shop(?:-|$)|clothing-3|jackets-3|trousers-3|accessories-3)/.test(item.id))return 'The Collection · Shop by Category';
  if(/^index-(new-in-3|modern-essentials)/.test(item.id))return 'New In · Modern Essentials';
  if(/^index-(the-averon-edit|a-considered-selection|oxford-shirt|tailored-trouser|watch$|sunglasses|merino-tee|overshirt-jacket|relaxed-trouser|wool-scarf|shop-the-edit-[23])/.test(item.id))return 'The AVERON Edit';
  if(item.section==='Header & navigation')return 'Header & Navigation';
  if(item.section==='Footer')return 'Footer';
  if(item.section==='Panels & cart')return 'Panels & Cart';
 }
 return item.section||'Page content';
}
function render(){const q=$('layout-search').value.trim().toLowerCase(),pg=$('layout-page').value;list.replaceChildren();const filtered=registry.filter(i=>(pg==='all'||i.page===pg)&&(!q||(i.defaultText+' '+i.page+' '+i.section+' '+groupName(i)).toLowerCase().includes(q)));$('layout-count').textContent=filtered.length+' text item'+(filtered.length===1?'':'s');
 const byPage=new Map();filtered.forEach(i=>{if(!byPage.has(i.page))byPage.set(i.page,new Map());const groups=byPage.get(i.page),name=groupName(i);if(!groups.has(name))groups.set(name,[]);groups.get(name).push(i)});
 for(const [page,groups] of byPage){const pageHead=document.createElement('h2');pageHead.style.cssText='font-family:Fraunces,serif;font-size:26px;margin:24px 0 10px';pageHead.textContent=page;list.append(pageHead);for(const [name,items] of groups){const g=document.createElement('section');g.className='group collapsed';const sum=document.createElement('button');sum.type='button';sum.className='group-summary';const strong=document.createElement('strong');strong.textContent=name;const meta=document.createElement('span');meta.textContent=items.length+' text'+(items.length===1?'':'s')+' · expand';sum.append(strong,meta);const body=document.createElement('div');body.className='group-body';const cards=document.createElement('div');cards.className='cards';items.forEach(i=>cards.append(card(i)));body.append(cards);sum.onclick=()=>{g.classList.toggle('collapsed');meta.textContent=items.length+' text'+(items.length===1?'':'s')+(g.classList.contains('collapsed')?' · expand':' · collapse')};g.append(sum,body);list.append(g)}}if(!filtered.length){const e=document.createElement('div');e.className='empty';e.textContent='No matching text items.';list.append(e)}}
async function load(){await auth();try{const r=await fetch('/api/site-layout',{headers:{Accept:'application/json'},cache:'no-store'}),d=await r.json();if(r.ok&&d.layout)saved=d.layout}catch(_){}const pages=[...new Set(registry.map(x=>x.page))].sort();pages.forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=p;$('layout-page').append(o)});render()}
$('layout-search').addEventListener('input',render);$('layout-page').addEventListener('change',render);
$('save-layout').onclick=async()=>{const merged={};for(const item of registry){const st=draft[item.id]||saved.entries?.[item.id];if(st&&typeof st.text==='string'&&st.text!==item.defaultText)merged[item.id]={text:st.text}}status.textContent='Saving…';try{const r=await fetch('/api/admin/site-layout',{method:'PUT',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({layout:{entries:merged}})}),d=await r.json();if(!r.ok)throw new Error(d.error||'Could not save text.');saved=d.layout||{entries:merged};draft={};dirty=false;status.textContent='Saved to the server.';toast('Site text saved.');render()}catch(err){status.textContent='Save failed. Changes are still open.';toast(err.message)}};
$('reset-current').onclick=()=>{const q=$('layout-search').value.trim().toLowerCase(),pg=$('layout-page').value;const visible=registry.filter(i=>(pg==='all'||i.page===pg)&&(!q||(i.defaultText+' '+i.page+' '+i.section).toLowerCase().includes(q)));if(!visible.length)return;visible.forEach(i=>{draft[i.id]={text:i.defaultText}});dirty=true;status.textContent='Visible text restored to defaults. Save to publish.';render()};
$('logout').onclick=async()=>{try{await fetch('/api/admin/auth/logout',{method:'POST',headers:{Accept:'application/json'}})}catch(_){}location.replace('/admin-login.html')};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});load();
})();
