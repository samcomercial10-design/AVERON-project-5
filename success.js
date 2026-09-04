(function(){
  'use strict';
  const params=new URLSearchParams(location.search);const sessionId=params.get('session_id')||'';
  const status=document.querySelector('[data-success-status]');
  const details=document.querySelector('[data-success-details]');
  const viewOrder=document.querySelector('[data-view-order]');
  const STORE='averon_orders_v1';
  const cleanText=(v,max=180)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
  function shortRef(id){const tail=cleanText(id,255).replace(/[^A-Za-z0-9]/g,'').slice(-8).toUpperCase();return tail?`AV-${tail}`:'AVERON';}
  function readOrders(){try{const x=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
  function saveVerifiedOrder(data){
    const order={
      id:cleanText(data.id,255),ref:cleanText(data.order_ref,40)||shortRef(data.id),payment_status:cleanText(data.payment_status,32),status:cleanText(data.status,32),
      customer_email:cleanText(data.customer_email,160),amount_total:Number.isInteger(data.amount_total)?data.amount_total:0,
      currency:cleanText(data.currency||'gbp',8).toLowerCase(),created:Number.isFinite(Number(data.created))?Number(data.created):Math.floor(Date.now()/1000),
      items:Array.isArray(data.items)?data.items.slice(0,50).map(i=>({name:cleanText(i.name,160),quantity:Math.max(1,Math.min(20,Math.floor(Number(i.quantity)||1))),amount_total:Number.isInteger(i.amount_total)?i.amount_total:0,currency:cleanText(i.currency||data.currency||'gbp',8).toLowerCase()})):[]
    };
    const orders=readOrders().filter(x=>x&&x.id!==order.id);orders.unshift(order);
    try{localStorage.setItem(STORE,JSON.stringify(orders.slice(0,20)))}catch(_){}
    return order;
  }
  async function run(){
    if(!sessionId){if(status)status.textContent='We could not verify this payment session.';return;}
    try{
      const r=await fetch('/api/checkout-session?session_id='+encodeURIComponent(sessionId),{headers:{'Accept':'application/json'}});
      const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to verify payment.');
      if(data.payment_status==='paid'||data.payment_status==='no_payment_required'){
        localStorage.removeItem('averon_cart');
        const order=saveVerifiedOrder(data);
        if(status)status.textContent='Payment confirmed. Your order is now recorded.';
        if(details){const total=Number.isInteger(data.amount_total)?new Intl.NumberFormat('en-GB',{style:'currency',currency:(data.currency||'gbp').toUpperCase()}).format(data.amount_total/100):'';details.textContent=[data.customer_email,total].filter(Boolean).join(' · ');}
        if(viewOrder){viewOrder.href='orders.html#'+encodeURIComponent(order.ref);viewOrder.hidden=false;}
      }else if(status) status.textContent='Your payment is still processing. We will confirm it once Stripe marks it as paid.';
    }catch(err){if(status)status.textContent='Your payment page returned successfully, but automatic verification is unavailable right now.';}
  }
  document.addEventListener('DOMContentLoaded',run);
})();
