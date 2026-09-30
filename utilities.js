/* AVERON — Search, session-only profile and wishlist drawers */
(function(){
  'use strict';
  const S=window.AVERON_SECURITY;if(!S)throw new Error('security.js must load before utilities.js');
  const defaults=[
    {id:'p1',name:'Merino Crewneck — Navy',price:65,category:'Clothing',colour:'Deep Navy',label:'Marylebone',images:[]},
    {id:'p2',name:'Tailored Wool Trouser',price:95,category:'Trousers',colour:'Deep Navy',label:'Mayfair',images:[]},
    {id:'p3',name:'Cotton Oxford Shirt',price:78,category:'Clothing',colour:'White',label:'Chelsea',images:[]},
    {id:'p4',name:'Minimalist Overshirt',price:135,category:'Jackets',colour:'Stone',label:'Soho',images:[]},
    {id:'p5',name:'Fine-Gauge Polo',price:58,category:'Clothing',colour:'Navy',label:'Belgravia',images:[]},
    {id:'p6',name:'Structured Field Jacket',price:165,category:'Jackets',colour:'Olive',label:'Notting Hill',images:[]},
    {id:'p7',name:'Leather Weekend Belt',price:45,category:'Accessories',colour:'Dark Brown',label:"St James's",images:[]},
    {id:'p8',name:'Wool-Blend Scarf',price:52,category:'Accessories',colour:'Charcoal',label:'Knightsbridge',images:[]}
  ];
  const money=n=>'£'+S.price(n).toFixed(2);
  function catalogue(){return S.products(Array.isArray(window.AVERON_PRODUCTS)&&window.AVERON_PRODUCTS.length?window.AVERON_PRODUCTS:S.safeJson(localStorage.getItem('averon_products_v1')||'null',null),defaults)}
  function wishlist(){return S.wishlist(S.safeJson(localStorage.getItem('averon_wishlist')||'[]',[]))}
  const overlay=()=>document.querySelector('[data-overlay]');let lastTrigger=null;
  function closeUtilities(){document.querySelectorAll('.utility-drawer.open').forEach(x=>x.classList.remove('open'));if(!document.querySelector('.cart-drawer.open'))overlay()?.classList.remove('open');document.body.style.overflow='';lastTrigger?.focus?.();lastTrigger=null}
  function openUtility(node){if(!node)return;lastTrigger=document.activeElement;document.querySelectorAll('.utility-drawer.open').forEach(x=>x.classList.remove('open'));node.classList.add('open');overlay()?.classList.add('open');document.body.style.overflow='hidden'}
  function refreshCount(){const n=wishlist().length;document.querySelectorAll('[data-wishlist-count]').forEach(x=>{x.textContent=String(n);x.style.display=n?'flex':'none'});document.querySelectorAll('.wishlist-header-btn').forEach(x=>x.classList.toggle('has-items',n>0))}

  function imageOrPlaceholder(product,className){
    const wrap=S.el('div',className);const src=S.imageSrc(product.images?.[0]);
    if(src){const img=document.createElement('img');img.src=src;img.alt=product.name;img.width=160;img.height=200;img.loading='lazy';img.decoding='async';wrap.appendChild(img)}else wrap.appendChild(S.el('div','ph light'));
    return wrap;
  }
  function renderWishlist(){
    const box=document.querySelector('[data-wishlist-items]');if(!box)return;box.replaceChildren();
    const ids=wishlist(),cat=catalogue(),items=ids.map(pid=>cat.find(p=>p.id===pid)).filter(Boolean);
    if(!items.length){const empty=S.el('div','utility-empty wishlist-empty-state');const heart=S.el('div','empty-heart');heart.setAttribute('aria-hidden','true');heart.innerHTML='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M16 26.5 7 18c-4.1-3.9-1.8-10.2 3.4-10.2 2.2 0 4.2 1.2 5.6 3 1.4-1.8 3.4-3 5.6-3 5.2 0 7.5 6.3 3.4 10.2L16 26.5Z"/></svg>';empty.append(heart,S.el('h4','', 'No saved pieces yet.'),S.el('p','', 'Use the heart on any piece to keep it here for later.'));const a=S.el('a','btn btn-outline btn-sm','Discover New In');a.href='index.html#new-in';empty.appendChild(a);box.appendChild(empty);return}
    items.forEach(p=>{
      const article=S.el('article','wishlist-row');const thumb=S.el('a','wishlist-thumb');thumb.href=S.safeProductHref(p.id);const src=S.imageSrc(p.coverImage)||S.imageSrc(p.images?.[0]);if(src){const img=document.createElement('img');img.src=src;img.alt=p.name;img.width=120;img.height=150;img.loading='lazy';img.decoding='async';thumb.appendChild(img)}else thumb.appendChild(S.el('div','ph light'));
      const copy=S.el('div','wishlist-copy');copy.append(S.el('span','eyebrow',p.category));const name=S.el('a','wishlist-name',p.name);name.href=S.safeProductHref(p.id);copy.append(name,S.el('span','wishlist-price',money(p.price)));const actions=S.el('div','wishlist-actions');const view=S.el('a','link-underline','View piece');view.href=S.safeProductHref(p.id);const add=S.el('button','wishlist-add-btn','Add to bag');add.type='button';add.dataset.addWishToCart=p.id;const rem=S.el('button','utility-text-btn','Remove');rem.type='button';rem.dataset.removeWish=p.id;actions.append(view,add,rem);copy.appendChild(actions);article.append(thumb,copy);box.appendChild(article);
    });
    const footer=S.el('div','wishlist-cart-cta');
    footer.append(S.el('span','eyebrow','Ready when you are'),S.el('p','wishlist-cart-copy','Move your saved pieces straight to your bag without opening each product page.'));
    const all=S.el('button','btn btn-primary btn-block','Add all to bag');all.type='button';all.dataset.addAllWishlist='';footer.appendChild(all);box.appendChild(footer);
    function cartPayload(p){const profile=accountState?.user||null;const size=p.category==='Accessories'?'One Size':S.text(profile?.size||'M',20);return{id:p.id,name:p.name,price:p.price,colour:p.colour||'Deep Navy',size,qty:1}}
    box.querySelectorAll('[data-add-wish-to-cart]').forEach(b=>b.addEventListener('click',()=>{const p=items.find(x=>x.id===b.dataset.addWishToCart);if(!p||!window.AVERON_addToCart)return;closeUtilities();window.AVERON_addToCart(cartPayload(p));}));
    all.addEventListener('click',()=>{if(!window.AVERON_addToCart)return;closeUtilities();items.forEach(p=>window.AVERON_addToCart(cartPayload(p)));window.AVERON_openCart?.();});
    box.querySelectorAll('[data-remove-wish]').forEach(b=>b.addEventListener('click',()=>{
      if(window.AVERON_toggleWishlist) window.AVERON_toggleWishlist(b.dataset.removeWish);
      else { localStorage.setItem('averon_wishlist',JSON.stringify(wishlist().filter(pid=>pid!==b.dataset.removeWish))); renderWishlist(); refreshCount(); }
    }));
  }

  function renderSuggestions(box){const wrap=S.el('div','search-suggestions');wrap.appendChild(S.el('span','eyebrow','Suggested'));['Deep Navy','Jackets','Trousers','Accessories'].forEach(label=>{const b=S.el('button','',label);b.type='button';b.dataset.chip=label.toLowerCase();wrap.appendChild(b)});box.appendChild(wrap);box.querySelectorAll('[data-chip]').forEach(b=>b.addEventListener('click',()=>{const input=document.querySelector('[data-search-input]');if(input){input.value=b.dataset.chip;renderSearch(input.value)}}))}
  function renderSearch(query){
    const box=document.querySelector('[data-search-results]');if(!box)return;box.replaceChildren();const q=S.text(query,100).toLowerCase();if(!q){renderSuggestions(box);return}
    const matches=catalogue().filter(p=>[p.name,p.category,p.colour,p.label].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,30);
    if(!matches.length){const empty=S.el('div','utility-empty');empty.append(S.el('h4','',`No results for “${S.text(query,100)}”.`),S.el('p','','Try a product, category or colour.'));box.appendChild(empty);return}
    box.appendChild(S.el('p','search-count',`${matches.length} result${matches.length===1?'':'s'}`));
    matches.forEach(p=>{const a=S.el('a','search-result-row');a.href=S.safeProductHref(p.id);a.appendChild(imageOrPlaceholder(p,'search-result-thumb'));const copy=S.el('div');copy.append(S.el('span','eyebrow',p.category),S.el('strong','',p.name),S.el('span','',`${p.colour} · ${money(p.price)}`));a.append(copy,S.el('span','search-arrow','→'));box.appendChild(a)});
  }

  let accountState={loaded:false,configured:true,authenticated:false,user:null};
  const LOGIN_RETURN_KEY='averon_login_return';
  function safeReturnPath(value){const v=String(value||'').trim();return /^(?:index|product|clothing|jackets|trousers|accessories|checkout|orders)\.html(?:[?#][^\s]*)?$/.test(v)?v:''}
  function rememberLoginReturn(path){const safe=safeReturnPath(path);if(safe)sessionStorage.setItem(LOGIN_RETURN_KEY,safe)}
  function consumeLoginReturn(){const safe=safeReturnPath(sessionStorage.getItem(LOGIN_RETURN_KEY)||'');sessionStorage.removeItem(LOGIN_RETURN_KEY);return safe}
  async function openLogin(returnTo=''){if(returnTo)rememberLoginReturn(returnTo);await renderAccount('login');openUtility(document.querySelector('[data-account-drawer]'));setTimeout(()=>document.querySelector('[data-account-view] input[type=email]')?.focus(),120)}
  async function loadAccountSession(){
    try{const r=await fetch('/api/auth/session',{headers:{Accept:'application/json'},cache:'no-store'});const data=await r.json();accountState={loaded:true,configured:data.configured!==false,authenticated:!!data.authenticated,user:data.user||null};}
    catch(_){accountState={loaded:true,configured:true,authenticated:false,user:null};}
    return accountState;
  }
  function menuInitials(user){const first=S.text(user?.firstName||'',40),last=S.text(user?.lastName||'',40);return ((first[0]||'')+(last[0]||'')).toUpperCase()||'AV'}
  function syncMenuProfile(){document.querySelectorAll('[data-mobile-menu]').forEach(menu=>{const top=menu.querySelector('.mobile-menu-top');if(!top)return;let profile=top.querySelector('.menu-client-profile');if(!profile){profile=document.createElement('button');profile.type='button';profile.className='menu-client-profile';profile.setAttribute('aria-label','Open account');profile.addEventListener('click',async()=>{menu.classList.remove('open');await loadAccountSession();renderAccount(accountState.authenticated?'auto':'login');openUtility(document.querySelector('[data-account-drawer]'))});top.insertBefore(profile,top.firstChild)}const wordmark=top.querySelector('.footer-wordmark'),u=accountState.authenticated?accountState.user:null;if(u){if(wordmark)wordmark.style.display='none';const name=[u.firstName,u.lastName].filter(Boolean).join(' ')||'AVERON Client';profile.innerHTML='';const mon=document.createElement('span');mon.className='menu-client-monogram';mon.textContent=menuInitials(u);const copy=document.createElement('span');copy.className='menu-client-copy';const email=document.createElement('span');email.className='menu-client-email';email.textContent=S.text(u.email||'',160);const line=document.createElement('span');line.className='menu-client-name';line.textContent=name;const arrow=document.createElement('span');arrow.className='menu-client-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='›';line.appendChild(arrow);copy.append(email,line);profile.append(mon,copy);profile.hidden=false}else{if(wordmark)wordmark.style.display='';profile.hidden=true;profile.replaceChildren()}})}
  function accountMessage(box,text,isError=false){const p=S.el('p','account-note',text);if(isError)p.setAttribute('role','alert');box.appendChild(p);return p}
  function accountField(label,name,type='text',value='',required=true){const l=document.createElement('label');l.appendChild(S.el('span','',label));const input=document.createElement('input');input.name=name;input.type=type;input.required=required;input.value=S.text(value,type==='email'?160:60);input.autocomplete=type==='email'?'email':(type==='password'?'current-password':(name==='firstName'?'given-name':'family-name'));l.appendChild(input);return l}
  function sizeField(value=''){const l=document.createElement('label');l.appendChild(S.el('span','','Preferred size'));const select=document.createElement('select');select.name='size';['XS','S','M','L','XL','32','34','36'].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;if(value===v)o.selected=true;select.appendChild(o)});l.appendChild(select);return l}
  async function renderAccount(mode='auto'){
    const box=document.querySelector('[data-account-view]');const accountDrawer=document.querySelector('[data-account-drawer]');if(accountDrawer)accountDrawer.classList.remove('account-authenticated');if(!box)return;box.replaceChildren();
    if(!accountState.loaded){box.append(S.el('p','account-note','Checking your account…'));await loadAccountSession();box.replaceChildren();}
    if(!accountState.configured){box.append(S.el('span','eyebrow','Account setup'),S.el('h4','','Customer login is ready for Supabase'),S.el('p','account-note','Add SUPABASE_URL and SUPABASE_ANON_KEY to the server environment to activate account creation and sign-in.'));return}
    const a=accountState.user;
    if(accountState.authenticated&&a&&mode!=='edit'){
      if(accountDrawer)accountDrawer.classList.add('account-authenticated');
      const initials=((S.text(a.firstName,40)[0]||'')+(S.text(a.lastName,40)[0]||'')).trim().toUpperCase()||'AV';
      const card=S.el('button','account-profile-card-ref');card.type='button';
      const monogram=S.el('span','account-profile-monogram-ref',initials);
      const copy=S.el('span','account-profile-copy-ref');
      const name=S.el('span','account-profile-name-ref',`${a.firstName||''} ${a.lastName||''}`.trim()||'AVERON client');
      const email=S.el('span','account-profile-email-ref',a.email||'');
      copy.append(name,email);card.append(monogram,copy);box.appendChild(card);
      const links=S.el('div','account-profile-links-ref');
      function createRow(label,action,countText=''){
        const btn=S.el('button','account-link-ref');btn.type='button';
        const left=S.el('span','account-link-label-ref',label);
        btn.appendChild(left);
        if(countText!==''&&countText!=null){btn.appendChild(S.el('span','account-link-count-ref',String(countText)));}
        else btn.appendChild(S.el('span','account-link-arrow-ref','›'));
        btn.onclick=action;return btn;
      }
      const favCount=wishlist().length;
      const profileRow=createRow('Profile Details',()=>renderAccount('edit'));
      const savedRow=createRow('Saved Pieces',()=>{closeUtilities();openDrawer('wishlist')},favCount);
      const orders=createRow('Orders',()=>{window.location.href='orders.html';});
      const checkout=createRow('Checkout',()=>{window.location.href='checkout.html';});
      links.append(profileRow,savedRow,orders,checkout);box.appendChild(links);
      const logout=S.el('button','utility-text-btn account-signout-ref','Sign out');logout.type='button';box.appendChild(logout);
      box.appendChild(S.el('p','account-auth-note-ref','Your account is authenticated securely through AVERON using Supabase Auth.'));
      card.onclick=()=>renderAccount('edit');
      logout.onclick=async()=>{logout.disabled=true;await fetch('/api/auth/logout',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).catch(()=>{});accountState={loaded:true,configured:accountState.configured,authenticated:false,user:null};syncMenuProfile();renderAccount('login')};
      return;
    }
    if(accountState.authenticated&&a&&mode==='edit'){
      const form=S.el('form','account-form');const grid=S.el('div','account-form-grid');grid.append(accountField('First name','firstName','text',a.firstName||''),accountField('Last name','lastName','text',a.lastName||''));form.append(grid,sizeField(a.size||''));const save=S.el('button','btn btn-primary btn-block','Save profile');save.type='submit';const cancel=S.el('button','utility-text-btn','Cancel');cancel.type='button';form.append(save,cancel);box.appendChild(form);cancel.onclick=()=>renderAccount('auto');form.onsubmit=async e=>{e.preventDefault();save.disabled=true;const f=new FormData(form);try{const r=await fetch('/api/auth/profile',{method:'PUT',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({firstName:f.get('firstName'),lastName:f.get('lastName'),size:f.get('size')})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to update profile.');accountState.user=data.user;syncMenuProfile();renderAccount('auto')}catch(err){save.disabled=false;accountMessage(form,err.message||'Unable to update profile.',true)}};return;
    }
    if(!accountState.authenticated&&mode==='recover'){
      const form=S.el('form','account-form');form.append(S.el('span','eyebrow','Account recovery'),S.el('h4','','Reset your password'),S.el('p','account-note','Enter the email address linked to your AVERON account. We will send you a secure password reset link.'));
      form.append(accountField('Email address','email','email'));
      const submit=S.el('button','btn btn-primary btn-block','Send reset link');submit.type='submit';
      const back=S.el('button','utility-text-btn account-auth-switch','Back to sign in');back.type='button';form.append(submit,back);box.appendChild(form);back.onclick=()=>renderAccount('login');
      form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;const f=new FormData(form);try{const r=await fetch('/api/auth/password/recover',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({email:f.get('email')})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to send the reset email.');form.replaceChildren();form.append(S.el('span','eyebrow','Check your inbox'),S.el('h4','','Reset link sent'),S.el('p','account-note',data.message||'If an account exists for that email, a password reset link has been sent.'));const done=S.el('button','utility-text-btn','Back to sign in');done.type='button';done.onclick=()=>renderAccount('login');form.append(done)}catch(err){submit.disabled=false;accountMessage(form,err.message||'Unable to send the reset email.',true)}};return;
    }
    const registering=mode==='register';const form=S.el('form','account-form');if(registering)form.append(S.el('span','eyebrow','New client'),S.el('h4','','Create your AVERON account'));
    if(registering){const grid=S.el('div','account-form-grid');grid.append(accountField('First name','firstName'),accountField('Last name','lastName'));form.append(grid)}
    form.append(accountField('Email address','email','email'));
    const pass=accountField('Password','password','password');pass.querySelector('input').autocomplete=registering?'new-password':'current-password';pass.querySelector('input').minLength=8;form.append(pass);
    if(registering)form.append(sizeField('M'));
    const submit=S.el('button','btn btn-primary btn-block',registering?'Create account':'Sign in');submit.type='submit';
    const google=S.el('a','btn btn-outline btn-block account-google','');google.href='/api/auth/google?next='+encodeURIComponent(safeReturnPath(sessionStorage.getItem(LOGIN_RETURN_KEY)||'')||location.pathname.split('/').pop()||'index.html');google.setAttribute('aria-label','Continue with Google');google.innerHTML='<svg class="google-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"/></svg><span>Continue with Google</span>';
    const divider=S.el('div','account-auth-divider','or');
    const switchBtn=S.el('button','utility-text-btn account-auth-switch',registering?'Already have an account? Sign in':'New to AVERON? Create account');switchBtn.type='button';
    if(!registering){const forgot=S.el('button','utility-text-btn account-forgot-password','Forgot your password?');forgot.type='button';forgot.onclick=()=>renderAccount('recover');form.append(forgot)}
    form.append(submit,divider,google,switchBtn);box.appendChild(form);switchBtn.onclick=()=>renderAccount(registering?'login':'register');
    form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;const f=new FormData(form);const payload={email:f.get('email'),password:f.get('password')};if(registering)Object.assign(payload,{firstName:f.get('firstName'),lastName:f.get('lastName'),size:f.get('size')});try{const r=await fetch(registering?'/api/auth/signup':'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to continue.');if(data.confirmation_required){form.replaceChildren();form.append(S.el('span','eyebrow','Check your inbox'),S.el('h4','','Confirm your email'),S.el('p','account-note','Your AVERON account was created. Use the confirmation email from Supabase, then return here and sign in.'));const back=S.el('button','utility-text-btn','Back to sign in');back.type='button';back.onclick=()=>renderAccount('login');form.append(back);return}accountState={loaded:true,configured:true,authenticated:true,user:data.user||null};if(!accountState.user)await loadAccountSession();syncMenuProfile();const returnTo=consumeLoginReturn();if(returnTo){location.assign(returnTo);return}renderAccount('auto')}catch(err){submit.disabled=false;accountMessage(form,err.message||'Unable to continue.',true)}};
  }

  window.addEventListener('averon:menu-open',async()=>{await loadAccountSession();syncMenuProfile();});
  document.addEventListener('DOMContentLoaded',()=>{
    loadAccountSession().then(()=>{syncMenuProfile();}).catch(()=>syncMenuProfile());
    /* The desktop reference groups Menu and Search on the left. Move the
       existing functional search trigger instead of duplicating it. */
    const header=document.querySelector('header.site'),navLeft=header?.querySelector('.nav-left'),navRight=header?.querySelector('.nav-right');
    if(navLeft&&navRight){
      const burger=navLeft.querySelector('.burger');
      if(burger){burger.classList.add('labelled-header-action');burger.dataset.actionLabel='Menu'}
      const search=navRight.querySelector('[data-open-search]');
      if(search){search.classList.add('labelled-header-action','desktop-search-trigger');search.dataset.actionLabel='Search';navLeft.appendChild(search)}
      navLeft.querySelector('.nav-links')?.classList.add('desktop-category-links');
    }
    document.querySelectorAll('[data-open-search]').forEach(b=>b.addEventListener('click',()=>{document.querySelector('[data-mobile-menu]')?.classList.remove('open');renderSearch('');openUtility(document.querySelector('[data-search-drawer]'));setTimeout(()=>document.querySelector('[data-search-input]')?.focus(),100)}));
    document.querySelectorAll('[data-open-account]').forEach(b=>b.addEventListener('click',async()=>{document.querySelector('[data-mobile-menu]')?.classList.remove('open');await loadAccountSession();renderAccount(accountState.authenticated?'auto':'login');openUtility(document.querySelector('[data-account-drawer]'))}));
    document.querySelectorAll('a[href="checkout.html"]').forEach(link=>link.addEventListener('click',async e=>{if(link.dataset.authBypass==='true')return;await loadAccountSession();if(accountState.authenticated)return;e.preventDefault();await openLogin('checkout.html')}));
    const params=new URLSearchParams(location.search);if(params.get('account')==='login'){const next=safeReturnPath(params.get('next')||'');if(next)rememberLoginReturn(next);openLogin(next);history.replaceState(null,'',location.pathname+(location.hash||''));}
    document.querySelectorAll('[data-open-wishlist]').forEach(b=>b.addEventListener('click',()=>{document.querySelector('[data-mobile-menu]')?.classList.remove('open');renderWishlist();openUtility(document.querySelector('[data-wishlist-drawer]'))}));
    document.querySelectorAll('[data-close-utility]').forEach(b=>b.addEventListener('click',closeUtilities));
    overlay()?.addEventListener('click',()=>{if(document.querySelector('.utility-drawer.open'))closeUtilities()});
    document.querySelector('[data-search-input]')?.addEventListener('input',e=>renderSearch(e.target.value));
    window.addEventListener('averon:wishlist-changed',()=>{refreshCount();renderWishlist()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeUtilities()});refreshCount();
  });
  window.AVERON_closeUtilities=closeUtilities;
  window.AVERON_openLogin=openLogin;
  window.AVERON_loadAccountSession=loadAccountSession;
})();
