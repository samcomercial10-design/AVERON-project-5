(function(){
  'use strict';
  const STORE='averon_orders_v1';
  const box=document.querySelector('[data-orders-list]');
  const count=document.querySelector('[data-orders-count]');
  const money=(pence,currency='gbp')=>new Intl.NumberFormat('en-GB',{style:'currency',currency:String(currency||'gbp').toUpperCase()}).format((Number(pence)||0)/100);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function read(){try{const x=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
  function formatDate(sec){const d=new Date((Number(sec)||0)*1000);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'long',year:'numeric'}).format(d)}
  function stateHtml(state){
    const label=esc(state?.customer_status_label||'Order confirmed');
    const code=esc(state?.customer_status||'confirmed');
    const tracking=String(state?.tracking_number||'').trim();
    const method=String(state?.shipping_method||'').trim();
    const completed=code==='shipped'||code==='delivered';
    const shippedIcon=code==='shipped'?`<span class="order-status-shipped-icon" aria-hidden="true"><svg class="order-status-truck" viewBox="0 0 64 42" focusable="false"><path d="M5 7h34v21H5z"/><path d="M39 14h10l10 10v4H39z"/><circle cx="17" cy="34" r="5"/><circle cx="49" cy="34" r="5"/></svg><span class="order-status-shipped-check">✓</span></span>`:'';
    const doneIcon=code==='delivered'?'<span class="order-status-check" aria-hidden="true">✓</span>':'';
    return `<div class="order-delivery-state" data-status-code="${code}">
      <div class="order-delivery-copy"><span class="eyebrow">Delivery status</span><strong class="order-status-label">${doneIcon}<span>${label}</span>${shippedIcon}</strong>${method?`<span>${esc(method)}</span>`:''}</div>
      ${tracking?`<div class="order-tracking"><span class="eyebrow">Tracking</span><strong>${esc(tracking)}</strong></div>`:''}
    </div>`;
  }
  async function accountOrders(){try{const r=await fetch('/api/account/orders',{headers:{Accept:'application/json'},cache:'no-store'});if(r.status===401)return null;const data=await r.json();if(!r.ok)return null;return Array.isArray(data.orders)?data.orders:[]}catch(_){return null}}
  async function render(){
    if(!box)return;const remote=await accountOrders();const orders=remote===null?read():remote;if(count)count.textContent=remote===null?`${orders.length} order${orders.length===1?'':'s'} saved on this browser`:`${orders.length} order${orders.length===1?'':'s'} linked to your AVERON account`;
    if(!orders.length){box.innerHTML='<section class="orders-empty"><span class="eyebrow">Order history</span><h2 class="serif">No orders yet.</h2><p>Your verified AVERON purchases will appear here after checkout.</p><a class="btn btn-primary" href="index.html#new-in">Discover New In</a></section>';return;}
    box.innerHTML=orders.map((o)=>{
      const items=Array.isArray(o.items)?o.items:[];
      return `<article class="order-card" id="${esc(o.ref||'')}">
        <div class="order-card-head"><div><span class="eyebrow">Order ${esc(o.ref||'AVERON')}</span><h2 class="serif">${esc(formatDate(o.created)||'Confirmed order')}</h2></div><span class="order-paid">Paid</span></div>
        <div class="order-meta"><span>${esc(o.customer_email||'Customer')}</span><strong>${esc(money(o.amount_total,o.currency))}</strong></div>
        <div class="order-items">${items.map(i=>`<div class="order-item"><div><strong>${esc(i.name||'AVERON piece')}</strong><span>Quantity ${esc(i.quantity||1)}</span></div><span>${esc(money(i.amount_total,i.currency||o.currency))}</span></div>`).join('') || '<div class="order-item"><div><strong>AVERON order</strong><span>Item details unavailable</span></div></div>'}</div>
        <div data-order-state="${esc(o.id||'')}">${stateHtml(null)}</div>
        <div class="order-card-foot"><span>Payment confirmed</span><button class="order-refund-btn link-underline" type="button" data-refund-id="${esc(o.id||'')}" data-refund-email="${esc(o.customer_email||'')}">Request refund</button></div>
      </article>`;
    }).join('');
    const hash=decodeURIComponent(location.hash.replace(/^#/,''));if(hash){requestAnimationFrame(()=>document.getElementById(hash)?.scrollIntoView({behavior:'smooth',block:'center'}));}
    refreshStatuses();
  }
  async function refreshStatuses(){
    const nodes=[...document.querySelectorAll('[data-order-state]')];
    await Promise.all(nodes.map(async node=>{
      const id=node.dataset.orderState;if(!id)return;
      try{
        const r=await fetch('/api/order-status?session_id='+encodeURIComponent(id),{headers:{'Accept':'application/json'},cache:'no-store'});
        if(!r.ok)return;
        const data=await r.json();
        node.innerHTML=stateHtml(data);
      }catch(_){/* Keep the last known customer-safe fallback. */}
    }));
  }
  document.addEventListener('click',async(e)=>{
    const btn=e.target.closest('[data-refund-id]');if(!btn)return;
    const ok=confirm('Request a refund for this order? If it has not shipped yet, the refund will be sent to Stripe immediately. If it has already shipped, AVERON will review the request first.');if(!ok)return;
    btn.disabled=true;const old=btn.textContent;btn.textContent='Requesting…';
    try{const r=await fetch('/api/refund-request',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({session_id:btn.dataset.refundId,customer_email:btn.dataset.refundEmail})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to request refund.');btn.textContent=data.status==='refunded'?'Refunded':(data.status==='refund_pending'?'Refund processing':'Refund requested');btn.classList.add('is-requested');await refreshStatuses();}
    catch(err){btn.disabled=false;btn.textContent=old;alert(err.message||'Unable to request refund.');}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshStatuses();});
  document.addEventListener('DOMContentLoaded',()=>{render();setInterval(refreshStatuses,30000);});
})();
