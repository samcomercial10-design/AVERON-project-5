'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const Stripe = require('stripe');
const {DatabaseSync} = require('node:sqlite');
const { performance } = require('perf_hooks');
const observability = require('./observability');
observability.installStructuredConsole();
const catalog = require('./products.server.json');
const cjSandboxMap = require('./cj-sandbox-map.json');

function safeEnv(value, max) { return String(value ?? '').trim().slice(0, max); }

const app = express();
const port = Number(process.env.PORT || 4242);
const ADMIN_COOKIE='averon_admin_session';
const CUSTOMER_ACCESS_COOKIE='averon_customer_access';
const CUSTOMER_REFRESH_COOKIE='averon_customer_refresh';
const ADMIN_SESSION_HOURS=Math.max(1,Math.min(72,Number(process.env.ADMIN_SESSION_HOURS||12)));
const ADMIN_EMAIL=safeEnv(process.env.ADMIN_EMAIL||'',160).toLowerCase();
const ADMIN_PASSWORD_HASH=safeEnv(process.env.ADMIN_PASSWORD_HASH||'',400);
const ADMIN_SECURE_COOKIE=String(process.env.ADMIN_SECURE_COOKIE||'').toLowerCase()==='true'||String(process.env.NODE_ENV||'').toLowerCase()==='production'||String(process.env.SITE_URL||'').startsWith('https://');
const adminLoginAttempts=new Map();
const secretKey = process.env.STRIPE_SECRET_KEY || '';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const cjApiKey = process.env.CJ_API_KEY || '';
const CJ_OPEN_ID = safeEnv(process.env.CJ_OPEN_ID || '', 200);
const SUPABASE_URL=safeEnv(process.env.SUPABASE_URL||'',500).replace(/\/$/,'');
const SUPABASE_ANON_KEY=safeEnv(process.env.SUPABASE_ANON_KEY||'',1000);
const CUSTOMER_SECURE_COOKIE=String(process.env.CUSTOMER_SECURE_COOKIE||'').toLowerCase()==='true'||String(process.env.NODE_ENV||'').toLowerCase()==='production'||String(process.env.SITE_URL||'').startsWith('https://');
const CJ_API_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';
const cjSandboxLogistics = safeEnv(process.env.CJ_SANDBOX_LOGISTICS || 'CJPacket Ordinary', 50);
const cjStripeSandboxAutomation = String(process.env.CJ_STRIPE_SANDBOX_AUTOMATION || 'true').toLowerCase() !== 'false';
// Production automation is deliberately opt-in. When enabled, Stripe LIVE paid sessions
// can create a real CJ order. CJ_AUTO_PAY_BALANCE additionally lets CJ deduct the order
// from the CJ account balance via createOrderV2 payType=2.
const cjLiveAutomation = String(process.env.CJ_LIVE_AUTOMATION || 'false').toLowerCase() === 'true';
const cjAutoPayBalance = String(process.env.CJ_AUTO_PAY_BALANCE || 'false').toLowerCase() === 'true';
const cjLiveLogisticsDefault = safeEnv(process.env.CJ_LIVE_LOGISTICS_DEFAULT || 'CJPacket Ordinary', 50);
const cjFromCountryCode = safeEnv(process.env.CJ_FROM_COUNTRY_CODE || 'CN', 3).toUpperCase() || 'CN';
let cjTokenCache = null;
const stripe = secretKey ? new Stripe(secretKey) : null;
const productMap = new Map(catalog.map(p => [p.id, p]));
const dbPath = process.env.AVERON_DB_PATH ? path.resolve(process.env.AVERON_DB_PATH) : path.join(__dirname, 'averon-orders.db');
const db = new DatabaseSync(dbPath);
const dbPrepare = sql => observability.timedDbPrepare(db, sql);
const dbExec = sql => observability.timedDbExec(db, sql);

dbExec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS orders (
    session_id TEXT PRIMARY KEY,
    order_ref TEXT NOT NULL UNIQUE,
    payment_status TEXT NOT NULL,
    stripe_status TEXT NOT NULL,
    customer_email TEXT NOT NULL DEFAULT '',
    customer_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    amount_total INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'gbp',
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL,
    items_json TEXT NOT NULL DEFAULT '[]',
    payment_intent_id TEXT NOT NULL DEFAULT '',
    fulfillment_status TEXT NOT NULL DEFAULT 'not_shipped',
    refund_status TEXT NOT NULL DEFAULT 'none',
    stripe_refund_id TEXT NOT NULL DEFAULT '',
    cj_order_id TEXT NOT NULL DEFAULT '',
    cj_order_number TEXT NOT NULL DEFAULT '',
    cj_status TEXT NOT NULL DEFAULT 'not_started',
    cj_error TEXT NOT NULL DEFAULT '',
    cj_sandbox INTEGER NOT NULL DEFAULT 1,
    cj_updated INTEGER NOT NULL DEFAULT 0,
    cj_tracking_number TEXT NOT NULL DEFAULT '',
    cj_logistics_name TEXT NOT NULL DEFAULT '',
    cj_message_type TEXT NOT NULL DEFAULT '',
    supabase_user_id TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created DESC);
  CREATE TABLE IF NOT EXISTS refund_requests (
    session_id TEXT PRIMARY KEY,
    order_ref TEXT NOT NULL,
    customer_email TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'requested',
    requested INTEGER NOT NULL,
    updated INTEGER NOT NULL,
    FOREIGN KEY(session_id) REFERENCES orders(session_id)
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    created INTEGER NOT NULL,
    expires INTEGER NOT NULL,
    user_agent_hash TEXT NOT NULL DEFAULT ''
  );
`);

// Keep existing local databases compatible with newer order/refund fields.
// Check the schema first so an already-applied migration is not logged as a DB error.
// This keeps startup logs actionable while preserving safe, idempotent migrations.
const orderColumns = new Set(
  db.prepare('PRAGMA table_info(orders)').all().map(column => String(column.name || ''))
);
for (const migration of [
  { name: 'payment_intent_id', sql: "ALTER TABLE orders ADD COLUMN payment_intent_id TEXT NOT NULL DEFAULT ''" },
  { name: 'fulfillment_status', sql: "ALTER TABLE orders ADD COLUMN fulfillment_status TEXT NOT NULL DEFAULT 'not_shipped'" },
  { name: 'refund_status', sql: "ALTER TABLE orders ADD COLUMN refund_status TEXT NOT NULL DEFAULT 'none'" },
  { name: 'stripe_refund_id', sql: "ALTER TABLE orders ADD COLUMN stripe_refund_id TEXT NOT NULL DEFAULT ''" },
  { name: 'cj_order_id', sql: "ALTER TABLE orders ADD COLUMN cj_order_id TEXT NOT NULL DEFAULT ''" },
  { name: 'cj_order_number', sql: "ALTER TABLE orders ADD COLUMN cj_order_number TEXT NOT NULL DEFAULT ''" },
  { name: 'cj_status', sql: "ALTER TABLE orders ADD COLUMN cj_status TEXT NOT NULL DEFAULT 'not_started'" },
  { name: 'cj_error', sql: "ALTER TABLE orders ADD COLUMN cj_error TEXT NOT NULL DEFAULT ''" },
  { name: 'cj_sandbox', sql: "ALTER TABLE orders ADD COLUMN cj_sandbox INTEGER NOT NULL DEFAULT 1" },
  { name: 'cj_updated', sql: "ALTER TABLE orders ADD COLUMN cj_updated INTEGER NOT NULL DEFAULT 0" },
  { name: 'cj_tracking_number', sql: "ALTER TABLE orders ADD COLUMN cj_tracking_number TEXT NOT NULL DEFAULT ''" },
  { name: 'cj_logistics_name', sql: "ALTER TABLE orders ADD COLUMN cj_logistics_name TEXT NOT NULL DEFAULT ''" },
  { name: 'cj_message_type', sql: "ALTER TABLE orders ADD COLUMN cj_message_type TEXT NOT NULL DEFAULT ''" },
  { name: 'supabase_user_id', sql: "ALTER TABLE orders ADD COLUMN supabase_user_id TEXT NOT NULL DEFAULT ''" }
]) {
  if (!orderColumns.has(migration.name)) {
    dbExec(migration.sql);
    orderColumns.add(migration.name);
  }
}

// Create indexes that depend on migrated columns only after migrations have run.
dbExec(`CREATE INDEX IF NOT EXISTS idx_orders_supabase_user ON orders(supabase_user_id, created DESC);`);

const upsertOrder = dbPrepare(`
  INSERT INTO orders (
    session_id, order_ref, payment_status, stripe_status, customer_email, customer_name,
    phone, amount_total, currency, created, updated, items_json, payment_intent_id, supabase_user_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(session_id) DO UPDATE SET
    payment_status=excluded.payment_status,
    stripe_status=excluded.stripe_status,
    customer_email=excluded.customer_email,
    customer_name=excluded.customer_name,
    phone=excluded.phone,
    amount_total=excluded.amount_total,
    currency=excluded.currency,
    updated=excluded.updated,
    items_json=excluded.items_json,
    payment_intent_id=CASE WHEN excluded.payment_intent_id <> '' THEN excluded.payment_intent_id ELSE orders.payment_intent_id END,
    supabase_user_id=CASE WHEN excluded.supabase_user_id <> '' THEN excluded.supabase_user_id ELSE orders.supabase_user_id END
`);
const listOrdersStmt = dbPrepare(`
  SELECT session_id, order_ref, payment_status, stripe_status, customer_email, customer_name,
         phone, amount_total, currency, created, updated, items_json, payment_intent_id,
         fulfillment_status, refund_status, stripe_refund_id, cj_order_id, cj_order_number,
         cj_status, cj_error, cj_sandbox, cj_updated, cj_tracking_number, cj_logistics_name, cj_message_type, supabase_user_id
  FROM orders ORDER BY created DESC LIMIT ?
`);

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(observability.requestContextMiddleware);

function safeText(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function supabaseConfigured(){
  return /^https:\/\/[A-Za-z0-9.-]+\.supabase\.co$/i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;
}
function clearCustomerCookies(res){
  const options={httpOnly:true,sameSite:'lax',secure:CUSTOMER_SECURE_COOKIE,path:'/'};
  res.clearCookie(CUSTOMER_ACCESS_COOKIE,options);
  res.clearCookie(CUSTOMER_REFRESH_COOKIE,options);
}
function setCustomerCookies(res,payload){
  const access=safeText(payload?.access_token||'',5000),refresh=safeText(payload?.refresh_token||'',5000);
  if(!access||!refresh)return false;
  const accessSeconds=Math.max(300,Math.min(7200,Number(payload?.expires_in)||3600));
  res.cookie(CUSTOMER_ACCESS_COOKIE,access,{httpOnly:true,sameSite:'lax',secure:CUSTOMER_SECURE_COOKIE,path:'/',maxAge:accessSeconds*1000});
  res.cookie(CUSTOMER_REFRESH_COOKIE,refresh,{httpOnly:true,sameSite:'lax',secure:CUSTOMER_SECURE_COOKIE,path:'/',maxAge:30*24*3600*1000});
  return true;
}
async function supabaseAuthRequest(endpoint,{method='GET',body,accessToken}={}){
  if(!supabaseConfigured())return {ok:false,status:503,data:{error:'Customer authentication is not configured.'}};
  try{
    const response=await fetch(`${SUPABASE_URL}/auth/v1${endpoint}`,{
      method,
      headers:{
        apikey:SUPABASE_ANON_KEY,
        Authorization:`Bearer ${accessToken||SUPABASE_ANON_KEY}`,
        ...(body?{'Content-Type':'application/json'}:{})
      },
      body:body?JSON.stringify(body):undefined,
      signal:AbortSignal.timeout(12000)
    });
    const data=await response.json().catch(()=>({}));
    return {ok:response.ok,status:response.status,data};
  }catch(err){
    console.error('Supabase Auth request failed:',err.message);
    return {ok:false,status:502,data:{error:'Customer authentication service is temporarily unavailable.'}};
  }
}
function publicCustomerUser(user){
  if(!user)return null;
  const meta=user.user_metadata&&typeof user.user_metadata==='object'?user.user_metadata:{};
  return {
    id:safeText(user.id,100),
    email:safeText(user.email,160),
    email_confirmed:Boolean(user.email_confirmed_at||user.confirmed_at),
    firstName:safeText(meta.first_name||'',60),
    lastName:safeText(meta.last_name||'',60),
    size:safeText(meta.preferred_size||'',20)
  };
}
async function getCustomerAuth(req,res,{refresh=true}={}){
  if(!supabaseConfigured())return null;
  const cookies=parseCookies(req);
  let access=safeText(cookies[CUSTOMER_ACCESS_COOKIE]||'',5000);
  const refreshToken=safeText(cookies[CUSTOMER_REFRESH_COOKIE]||'',5000);
  if(access){
    const current=await supabaseAuthRequest('/user',{accessToken:access});
    if(current.ok&&current.data?.id){req.customerAccessToken=access;return current.data;}
  }
  if(refresh&&refreshToken){
    const renewed=await supabaseAuthRequest('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refreshToken}});
    if(renewed.ok&&renewed.data?.access_token){
      setCustomerCookies(res,renewed.data);
      const current=await supabaseAuthRequest('/user',{accessToken:renewed.data.access_token});
      if(current.ok&&current.data?.id){req.customerAccessToken=renewed.data.access_token;return current.data;}
    }
  }
  clearCustomerCookies(res);
  return null;
}
function requestOriginCandidates(req){
  const out=new Set();
  const configured=String(process.env.SITE_URL||'').trim().replace(/\/$/,'');
  if(configured)out.add(configured);

  const forwardedProto=String(req.get('x-forwarded-proto')||'').split(',')[0].trim();
  const forwardedHost=String(req.get('x-forwarded-host')||'').split(',')[0].trim();
  if(forwardedProto&&forwardedHost)out.add(`${forwardedProto}://${forwardedHost}`);

  const host=String(req.get('host')||'').trim();
  if(host){
    out.add(`${req.protocol}://${host}`);
    // Render terminates TLS at its proxy, so Express can see http internally while the browser uses https.
    if(!isLocalRequest(req))out.add(`https://${host}`);
  }
  return [...out].map(v=>v.replace(/\/$/,''));
}
function sameOriginCustomerRequest(req){
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return true;
  const origin=String(req.get('origin')||'').replace(/\/$/,''),referer=String(req.get('referer')||'');
  const expected=requestOriginCandidates(req);
  if(origin)return expected.includes(origin);
  if(referer)return expected.some(base=>referer===base||referer.startsWith(base+'/'));
  return isLocalRequest(req);
}
function safeQty(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(1, Math.min(20, n)) : 1;
}
function originFor(req) {
  const configured = String(process.env.SITE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  const forwardedProto=String(req.get('x-forwarded-proto')||'').split(',')[0].trim();
  const forwardedHost=String(req.get('x-forwarded-host')||'').split(',')[0].trim();
  if(forwardedProto&&forwardedHost)return `${forwardedProto}://${forwardedHost}`.replace(/\/$/,'');
  const host=String(req.get('host')||'').trim();
  if(host&&!isLocalRequest(req))return `https://${host}`;
  return `${req.protocol}://${host}`;
}
function orderRefFor(id) {
  const tail = safeText(id, 255).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
  return `AV-${tail || Date.now().toString(36).toUpperCase()}`;
}
function isLocalRequest(req) {
  const host = String(req.hostname || '').toLowerCase();
  return ['localhost','127.0.0.1','::1'].includes(host);
}
function parseItemsJson(value) {
  try { const data = JSON.parse(value || '[]'); return Array.isArray(data) ? data : []; }
  catch (_) { return []; }
}
function customerOrderStatus(row) {
  const cj = safeText(row?.cj_status || '', 80).toLowerCase();
  const fulfillment = safeText(row?.fulfillment_status || '', 40).toLowerCase();
  const refund = safeText(row?.refund_status || '', 40).toLowerCase();

  if (refund === 'refunded') return {code:'refunded', label:'Refunded'};
  if (fulfillment === 'cancelled') return {code:'cancelled', label:'Cancelled'};
  if (['delivered_600','completed_700'].includes(cj)) return {code:'delivered', label:'Delivered'};
  if (fulfillment === 'shipped' || cj === 'shipped_500') return {code:'shipped', label:'Shipped'};
  if (cj === 'processing_400' || cj === 'cj_unshipped') return {code:'processing', label:'Processing'};
  if (cj === 'paid_300') return {code:'confirmed', label:'Order confirmed'};
  if (cj === 'confirmed_unpaid_200') return {code:'awaiting_supplier_payment', label:'Confirmed'};
  if (cj === 'created_100') return {code:'submitted', label:'Submitted to supplier'};
  if (cj === 'error') return {code:'attention', label:'Order requires attention'};
  return {code:'confirmed', label:'Order confirmed'};
}

function rowToOrder(row) {
  if (!row) return null;
  const display = customerOrderStatus(row);
  return {
    ...row,
    items: parseItemsJson(row.items_json),
    items_json: undefined,
    customer_status: display.code,
    customer_status_label: display.label,
    tracking_number: safeText(row.cj_tracking_number || '', 200),
    shipping_method: safeText(row.cj_logistics_name || '', 120)
  };
}

function cjDateMs(value) {
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : 0;
}

async function getCjAccessToken({force = false} = {}) {
  if (!cjApiKey) throw new Error('CJ_API_KEY is not configured.');

  // Keep CJ credentials server-side. Refresh a little before expiry and never send
  // the access token to the browser. For this local test build, the token cache
  // intentionally lives only in server memory.
  if (!force && cjTokenCache?.accessToken) {
    const expiry = cjDateMs(cjTokenCache.accessTokenExpiryDate);
    if (!expiry || expiry - Date.now() > 5 * 60 * 1000) {
      observability.trackCache('cj_access_token', 'hit');
      return cjTokenCache;
    }
  }
  observability.trackCache('cj_access_token', 'miss');

  const response = await fetch(`${CJ_API_BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({apiKey: cjApiKey}),
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.result || !payload?.data?.accessToken) {
    const message = safeText(payload?.message || `CJ authentication failed with HTTP ${response.status}.`, 240);
    const error = new Error(message);
    error.cjCode = payload?.code;
    throw error;
  }
  cjTokenCache = payload.data;
  return cjTokenCache;
}

async function cjRequest(endpoint, options = {}) {
  const token = await getCjAccessToken();
  const response = await fetch(`${CJ_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'CJ-Access-Token': token.accessToken,
      ...(options.body ? {'Content-Type': 'application/json'} : {}),
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.result === false || payload?.success === false) {
    const message = safeText(payload?.message || `CJ request failed with HTTP ${response.status}.`, 240);
    const error = new Error(message);
    error.cjCode = payload?.code;
    throw error;
  }
  return payload;
}


async function getCjWebhookOpenId() {
  // Prefer the saved openId from .env so webhook verification does not depend
  // on a live CJ API request. CJ documents openId as the HMAC signing secret.
  if (CJ_OPEN_ID) return CJ_OPEN_ID;

  const token = await getCjAccessToken();
  const tokenOpenId = token?.openId ?? token?.open_id;
  if (tokenOpenId !== undefined && tokenOpenId !== null && String(tokenOpenId).trim()) {
    return String(tokenOpenId).trim();
  }
  const settings = await cjRequest('/setting/get', {method:'GET'});
  const settingsOpenId = settings?.data?.openId ?? settings?.data?.open_id;
  if (settingsOpenId === undefined || settingsOpenId === null || !String(settingsOpenId).trim()) {
    throw new Error('CJ openId is unavailable; webhook signatures cannot be verified.');
  }
  return String(settingsOpenId).trim();
}

function cjWebhookSignature(rawBody, openId) {
  return crypto.createHmac('sha256', Buffer.from(String(openId), 'utf8'))
    .update(rawBody)
    .digest('base64');
}

function safeSignatureEquals(expected, received) {
  const a = Buffer.from(String(expected || ''), 'utf8');
  const b = Buffer.from(String(received || ''), 'utf8');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function cjStatusFromPush(orderStatus) {
  const status = safeText(orderStatus || '', 60).toUpperCase();
  const map = {
    CREATED: 'created_100',
    UNPAID: 'confirmed_unpaid_200',
    PAID: 'paid_300',
    PROCESSING: 'processing_400',
    UNSHIPPED: 'processing_400',
    PENDING: 'processing_400',
    DISPATCHED: 'shipped_500',
    SHIPPED: 'shipped_500',
    DELIVERED: 'delivered_600',
    COMPLETED: 'completed_700',
    CLOSED: 'closed'
  };
  return map[status] || (status ? `cj_${status.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : 'updated');
}

function cjSandboxVariantFor(item) {
  const mapping = cjSandboxMap?.[item.product_id];
  if (!mapping) throw new Error(`No CJ sandbox mapping for AVERON product ${item.product_id || 'unknown'}.`);
  const size = safeText(item.size || '', 20).toUpperCase();
  const colour = safeText(item.colour || '', 60).toUpperCase();
  const comboKey = colour && size ? `${colour}|${size}` : '';
  const variant = (comboKey && mapping.variants?.[comboKey]) || mapping.variants?.[size] || null;
  if (!variant?.vid && !variant?.sku) throw new Error(`No CJ sandbox variant mapping for ${item.product_id}${colour ? ` colour ${colour}` : ''}${size ? ` size ${size}` : ''}.`);
  return {variant, mapping, size, colour};
}

const EUROPE_CHECKOUT_COUNTRIES = Object.freeze([
  'GB','DE','FR','NL','BE','CH','AT','SE','DK','NO','FI','IE','IT','ES','PT','LU','PL','CZ'
]);

const CJ_COUNTRY_NAMES = Object.freeze({
  AT:'Austria', BE:'Belgium', BG:'Bulgaria', HR:'Croatia', CY:'Cyprus', CZ:'Czech Republic',
  DK:'Denmark', EE:'Estonia', FI:'Finland', FR:'France', DE:'Germany', GR:'Greece', HU:'Hungary',
  IE:'Ireland', IT:'Italy', LV:'Latvia', LT:'Lithuania', LU:'Luxembourg', MT:'Malta', NL:'Netherlands',
  PL:'Poland', PT:'Portugal', RO:'Romania', SK:'Slovakia', SI:'Slovenia', ES:'Spain', SE:'Sweden',
  NO:'Norway', CH:'Switzerland', GB:'United Kingdom'
});

function cjCountryName(code) {
  const c = safeText(code || 'GB', 3).toUpperCase();
  return CJ_COUNTRY_NAMES[c] || c;
}

function cjShippingFromStripeSession(session) {
  const details = session?.collected_information?.shipping_details || session?.shipping_details || {};
  const fallbackAddress = session?.customer_details?.address || {};
  const address = details?.address || fallbackAddress || {};
  const name = safeText(details?.name || session?.customer_details?.name || 'AVERON Sandbox Customer', 120);
  const phone = safeText(session?.customer_details?.phone || '07000000000', 40);
  const countryCode = safeText(address?.country || 'GB', 3).toUpperCase() || 'GB';
  const line1 = safeText(address?.line1 || '1 Sandbox Test Street', 180);
  const line2 = safeText(address?.line2 || '', 120);
  return {
    shippingZip: safeText(address?.postal_code || 'SW1A 1AA', 30),
    shippingCountryCode: countryCode,
    shippingCountry: cjCountryName(countryCode),
    shippingProvince: safeText(address?.state || address?.city || 'England', 80),
    shippingCity: safeText(address?.city || 'London', 80),
    shippingCustomerName: name,
    shippingAddress: safeText([line1, line2].filter(Boolean).join(', '), 260),
    shippingPhone: phone,
    email: safeText(session?.customer_details?.email || session?.customer_email || 'sandbox@example.com', 160)
  };
}

function updateCjState(sessionId, fields = {}) {
  const allowed = ['cj_order_id','cj_order_number','cj_status','cj_error','cj_sandbox','cj_updated','cj_tracking_number','cj_logistics_name','cj_message_type','fulfillment_status'];
  const entries = Object.entries(fields).filter(([k]) => allowed.includes(k));
  if (!entries.length) return;
  const sql = `UPDATE orders SET ${entries.map(([k]) => `${k}=?`).join(', ')} WHERE session_id=?`;
  dbPrepare(sql).run(...entries.map(([,v]) => v), sessionId);
}


function normalizeSupplierOption(value) {
  return safeText(value || '', 80).trim().toUpperCase().replace(/\s+/g, ' ');
}

function cjLiveVariantFor(item) {
  const product = productMap.get(safeText(item?.product_id, 48));
  if (!product) throw new Error(`AVERON product ${item?.product_id || 'unknown'} is missing from the server catalogue.`);

  const supplier = product.supplier && typeof product.supplier === 'object' ? product.supplier : {};
  if (safeText(supplier.provider || 'CJ', 20).toUpperCase() !== 'CJ') {
    throw new Error(`AVERON product ${product.id} is not configured for CJ fulfilment.`);
  }
  if (!safeText(supplier.pid, 200)) {
    throw new Error(`AVERON product ${product.id} has no CJ product mapping.`);
  }

  const mappings = Array.isArray(supplier.mappings)
    ? supplier.mappings.filter(m => m && m.enabled !== false && (m.vid || m.sku))
    : [];
  if (!mappings.length) {
    throw new Error(`AVERON product ${product.id} has no enabled CJ variant mappings.`);
  }

  const wantedSize = normalizeSupplierOption(item?.size);
  const wantedColour = normalizeSupplierOption(item?.colour);

  let candidates = mappings.filter(m => normalizeSupplierOption(m.option) === wantedSize);
  if (!candidates.length && wantedSize) {
    candidates = mappings.filter(m => normalizeSupplierOption(m.cjLabel).includes(wantedSize));
  }
  if (!candidates.length) candidates = mappings;

  if (wantedColour && candidates.length > 1) {
    const colourMatch = candidates.find(m => normalizeSupplierOption(m.cjLabel).includes(wantedColour));
    if (colourMatch) candidates = [colourMatch];
  }

  const mapping = candidates[0];
  if (!mapping?.vid && !mapping?.sku) {
    throw new Error(`No CJ variant is mapped for ${product.name || product.id}${wantedSize ? ` size ${item.size}` : ''}${wantedColour ? ` colour ${item.colour}` : ''}.`);
  }

  return {
    product,
    supplier,
    mapping: {
      vid: safeText(mapping.vid || '', 200),
      sku: safeText(mapping.sku || '', 200)
    }
  };
}

function cjShippingFromStripeSessionLive(session) {
  const details = session?.collected_information?.shipping_details || session?.shipping_details || {};
  const fallbackAddress = session?.customer_details?.address || {};
  const address = details?.address || fallbackAddress || {};
  const name = safeText(details?.name || session?.customer_details?.name || '', 120);
  const phone = safeText(session?.customer_details?.phone || '', 40);
  const countryCode = safeText(address?.country || '', 3).toUpperCase();
  const line1 = safeText(address?.line1 || '', 180);
  const line2 = safeText(address?.line2 || '', 120);
  const postalCode = safeText(address?.postal_code || '', 30);
  const city = safeText(address?.city || '', 80);
  const province = safeText(address?.state || address?.city || '', 80);

  if (!name || !countryCode || !line1 || !postalCode || !city) {
    throw new Error('Stripe paid session is missing the delivery address required for CJ fulfilment.');
  }

  return {
    shippingZip: postalCode,
    shippingCountryCode: countryCode,
    shippingCountry: cjCountryName(countryCode),
    shippingProvince: province || city,
    shippingCity: city,
    shippingCustomerName: name,
    shippingAddress: safeText([line1, line2].filter(Boolean).join(', '), 260),
    shippingPhone: phone,
    email: safeText(session?.customer_details?.email || session?.customer_email || '', 160)
  };
}

async function syncStripeLiveOrderToCj(sessionId) {
  if (!cjLiveAutomation) {
    updateCjState(sessionId, {
      cj_status:'live_automation_disabled',
      cj_error:'CJ_LIVE_AUTOMATION is disabled.',
      cj_sandbox:0,
      cj_updated:Math.floor(Date.now()/1000)
    });
    return;
  }
  if (!cjApiKey) {
    updateCjState(sessionId, {
      cj_status:'disabled_no_key',
      cj_error:'CJ_API_KEY is missing.',
      cj_sandbox:0,
      cj_updated:Math.floor(Date.now()/1000)
    });
    return;
  }
  if (!String(sessionId || '').startsWith('cs_live_')) {
    throw new Error('Live CJ fulfilment only accepts Stripe live Checkout Sessions.');
  }

  const row = dbPrepare('SELECT * FROM orders WHERE session_id=?').get(sessionId);
  if (!row) throw new Error('Stripe order was not persisted before CJ live sync.');
  const order = rowToOrder(row);
  if (!order.items.length) throw new Error('Order has no items to map to CJ.');

  // Idempotency guard: once a CJ order id has been stored, never create another supplier order.
  if (safeText(order.cj_order_id || '', 200)) {
    console.log('AVERON CJ LIVE: order already linked; skipping duplicate creation.', order.order_ref, order.cj_order_id);
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!['paid','no_payment_required'].includes(session.payment_status)) {
      throw new Error(`Stripe session ${sessionId} is not paid.`);
    }

    const products = [];
    let orderLogistics = '';
    for (const [index, item] of order.items.entries()) {
      const {supplier,mapping} = cjLiveVariantFor(item);
      if (!orderLogistics) {
        orderLogistics = safeText(supplier.logistics || cjLiveLogisticsDefault, 50) || cjLiveLogisticsDefault;
      }
      products.push({
        ...(mapping.vid ? {vid:mapping.vid} : {}),
        ...(mapping.sku ? {sku:mapping.sku} : {}),
        quantity:safeQty(item.quantity),
        storeLineItemId:safeText(`${order.order_ref}-${index+1}`, 80)
      });
    }

    const shipping = cjShippingFromStripeSessionLive(session);
    const cjOrderNumber = safeText(`AVERON-${order.order_ref.replace(/[^A-Za-z0-9-]/g,'')}`, 50);
    const payType = cjAutoPayBalance ? 2 : 3;

    updateCjState(sessionId, {
      cj_status:cjAutoPayBalance ? 'submitting_for_balance_payment' : 'submitting_unpaid',
      cj_error:'',
      cj_sandbox:0,
      cj_logistics_name:orderLogistics,
      cj_updated:Math.floor(Date.now()/1000)
    });

    const createBody = {
      orderNumber:cjOrderNumber,
      ...shipping,
      remark:cjAutoPayBalance
        ? 'AVERON Stripe LIVE -> CJ automatic fulfilment and CJ balance payment.'
        : 'AVERON Stripe LIVE -> CJ automatic order creation. Supplier payment is manual.',
      payType,
      logisticName:orderLogistics,
      fromCountryCode:cjFromCountryCode,
      platform:'Api',
      orderFlow:1,
      isSandbox:0,
      products
    };

    // CJ documents payType=2 as the create -> cart -> confirm -> balance-deduction flow.
    // payType=3 creates the real order without initiating supplier payment.
    const created = await cjRequest('/shopping/order/createOrderV2', {
      method:'POST',
      body:JSON.stringify(createBody)
    });

    const cjOrderId = safeText(created?.data?.orderId || created?.data?.shipmentOrderId || '', 200);
    const returnedNumber = safeText(created?.data?.orderNumber || cjOrderNumber, 120);
    if (!cjOrderId) {
      throw new Error('CJ accepted the live request but did not return an order id. Check CJ Orders before retrying.');
    }

    updateCjState(sessionId, {
      cj_order_id:cjOrderId,
      cj_order_number:returnedNumber,
      cj_status:cjAutoPayBalance ? 'paid_300' : 'created_unpaid_live',
      cj_error:'',
      cj_sandbox:0,
      cj_logistics_name:orderLogistics,
      cj_updated:Math.floor(Date.now()/1000)
    });

    console.log(
      'AVERON Stripe LIVE -> CJ:',
      order.order_ref,
      cjOrderId,
      cjAutoPayBalance ? 'balance payment requested' : 'created unpaid'
    );
  } catch (err) {
    updateCjState(sessionId, {
      cj_status:'error',
      cj_error:safeText(err.message,240),
      cj_sandbox:0,
      cj_updated:Math.floor(Date.now()/1000)
    });
    console.error('AVERON Stripe LIVE -> CJ failed:', sessionId, err.message, err.cjCode || '');
  }
}

function queueCjAutomationForPaidStripeSession(session) {
  if (!session?.id) return;
  const live = session.livemode === true || String(session.id).startsWith('cs_live_');
  if (live) {
    setImmediate(() => syncStripeLiveOrderToCj(session.id).catch(err => console.error('CJ live background sync failed:', err.message)));
  } else {
    setImmediate(() => syncStripeTestOrderToCjSandbox(session.id).catch(err => console.error('CJ sandbox background sync failed:', err.message)));
  }
}

async function syncStripeTestOrderToCjSandbox(sessionId) {
  if (!cjStripeSandboxAutomation) return;
  if (!cjApiKey) {
    updateCjState(sessionId,{cj_status:'disabled_no_key',cj_error:'CJ_API_KEY is missing.',cj_updated:Math.floor(Date.now()/1000)});
    return;
  }
  // Critical safety gate: this build NEVER sends live Stripe orders to CJ.
  if (!String(sessionId || '').startsWith('cs_test_')) {
    updateCjState(sessionId,{cj_status:'blocked_live_stripe',cj_error:'Live Stripe sessions are blocked from CJ automation in this sandbox build.',cj_updated:Math.floor(Date.now()/1000)});
    return;
  }

  const row = dbPrepare('SELECT * FROM orders WHERE session_id=?').get(sessionId);
  if (!row) throw new Error('Stripe order was not persisted before CJ sandbox sync.');
  const order = rowToOrder(row);
  if (!order.items.length) throw new Error('Order has no items to map to CJ.');

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    let orderLogistics = cjSandboxLogistics;
    const products = order.items.map((item, index) => {
      const {variant,mapping} = cjSandboxVariantFor(item);
      if(index===0 && mapping?.logistics) orderLogistics=safeText(mapping.logistics,50)||cjSandboxLogistics;
      return {
        ...(variant.vid ? {vid:safeText(variant.vid,80)} : {}),
        ...(variant.sku ? {sku:safeText(variant.sku,80)} : {}),
        quantity: safeQty(item.quantity),
        storeLineItemId: safeText(`${order.order_ref}-${index+1}`, 80)
      };
    });

    let cjOrderId = safeText(order.cj_order_id || '', 200);
    let cjOrderNumber = safeText(order.cj_order_number || '', 120);
    if (!cjOrderId) {
      const shipping = cjShippingFromStripeSession(session);
      cjOrderNumber = safeText(`AVERON-SBX-${order.order_ref.replace(/[^A-Za-z0-9-]/g,'')}`, 80);
      const createBody = {
        orderNumber: cjOrderNumber,
        ...shipping,
        remark: 'AVERON Stripe TEST -> CJ SANDBOX automation. No real fulfilment.',
        logisticName: orderLogistics,
        fromCountryCode: 'CN',
        platform: 'Api',
        shopLogisticsType: 2,
        orderFlow: 1,
        isSandbox: 1,
        products
      };
      const created = await cjRequest('/shopping/order/createOrderV3',{method:'POST',body:JSON.stringify(createBody)});
      cjOrderId = safeText(created?.data?.orderId || '', 200);
      cjOrderNumber = safeText(created?.data?.orderNumber || cjOrderNumber, 120);
      if (!cjOrderId) throw new Error('CJ created the sandbox request but returned no orderId.');
      updateCjState(sessionId,{cj_order_id:cjOrderId,cj_order_number:cjOrderNumber,cj_status:'created_100',cj_error:'',cj_sandbox:1,cj_updated:Math.floor(Date.now()/1000)});
    }

    const current = dbPrepare('SELECT cj_status FROM orders WHERE session_id=?').get(sessionId)?.cj_status || '';
    if (!['confirmed_unpaid_200','paid_300','processing_400','shipped_500'].includes(current)) {
      await cjRequest('/shopping/order/confirmOrder',{method:'PATCH',body:JSON.stringify({orderId:cjOrderId})});
      updateCjState(sessionId,{cj_status:'confirmed_unpaid_200',cj_error:'',cj_updated:Math.floor(Date.now()/1000)});
    }

    const afterConfirm = dbPrepare('SELECT cj_status FROM orders WHERE session_id=?').get(sessionId)?.cj_status || '';
    if (!['paid_300','processing_400','shipped_500'].includes(afterConfirm)) {
      await cjRequest('/shopping/sandbox/simulatePay',{method:'POST',body:JSON.stringify({orderId:cjOrderId})});
      updateCjState(sessionId,{cj_status:'paid_300',cj_error:'',cj_updated:Math.floor(Date.now()/1000)});
    }

    console.log('AVERON Stripe TEST -> CJ SANDBOX:', order.order_ref, cjOrderId, 'paid_300');
  } catch (err) {
    updateCjState(sessionId,{cj_status:'error',cj_error:safeText(err.message,240),cj_sandbox:1,cj_updated:Math.floor(Date.now()/1000)});
    console.error('AVERON Stripe TEST -> CJ SANDBOX failed:', sessionId, err.message, err.cjCode || '');
  }
}

async function persistPaidSession(sessionOrId) {
  if (!stripe) throw new Error('Stripe is not configured.');
  const id = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId?.id;
  if (!id) throw new Error('Missing checkout session id.');

  const session = typeof sessionOrId === 'object' && sessionOrId?.id
    ? sessionOrId
    : await stripe.checkout.sessions.retrieve(id);

  if (!['paid','no_payment_required'].includes(session.payment_status)) return null;

  const lineItems = await stripe.checkout.sessions.listLineItems(id, {
    limit: 50,
    expand: ['data.price.product']
  });
  const items = lineItems.data.map(item => {
    const product = item.price && typeof item.price.product === 'object' ? item.price.product : null;
    const metadata = product?.metadata || {};
    return {
      product_id: safeText(metadata.averon_product_id, 48),
      name: safeText(item.description || product?.name || 'AVERON piece', 160),
      quantity: safeQty(item.quantity || 1),
      size: safeText(metadata.size || '', 20),
      colour: safeText(metadata.colour || '', 40),
      amount_total: Number.isInteger(item.amount_total) ? item.amount_total : 0,
      currency: safeText(item.currency || session.currency || 'gbp', 8).toLowerCase()
    };
  });

  const now = Math.floor(Date.now()/1000);
  const created = Number.isFinite(Number(session.created)) ? Number(session.created) : now;
  const orderRef = orderRefFor(id);
  upsertOrder.run(
    id,
    orderRef,
    safeText(session.payment_status, 32),
    safeText(session.status || '', 32),
    safeText(session.customer_details?.email || session.customer_email || '', 160),
    safeText(session.customer_details?.name || '', 120),
    safeText(session.customer_details?.phone || '', 40),
    Number.isInteger(session.amount_total) ? session.amount_total : 0,
    safeText(session.currency || 'gbp', 8).toLowerCase(),
    created,
    now,
    JSON.stringify(items),
    safeText(typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || '', 255),
    safeText(session.metadata?.supabase_user_id || '', 100)
  );
  return rowToOrder(dbPrepare('SELECT * FROM orders WHERE session_id = ?').get(id));
}

// ---------- Server-side Content Studio authentication ----------
function adminConfigured(){return Boolean(ADMIN_EMAIL&&/^scrypt\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/.test(ADMIN_PASSWORD_HASH));}
function b64urlBuffer(v){return Buffer.from(String(v||'').replace(/-/g,'+').replace(/_/g,'/'),'base64');}
function verifyAdminPassword(password){if(!adminConfigured())return false;try{const[,salt64,hash64]=ADMIN_PASSWORD_HASH.split('$');const expected=b64urlBuffer(hash64);const actual=crypto.scryptSync(String(password||''),b64urlBuffer(salt64),64);return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual)}catch(_){return false}}
function parseCookies(req){const out={};for(const part of String(req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i<=0)continue;const k=part.slice(0,i).trim(),v=part.slice(i+1).trim();try{out[k]=decodeURIComponent(v)}catch(_){out[k]=v}}return out}
function adminTokenHash(t){return crypto.createHash('sha256').update(String(t||'')).digest('hex')}
function adminUserAgentHash(req){return crypto.createHash('sha256').update(String(req.get('user-agent')||'')).digest('hex')}
function getAdminSession(req){const token=parseCookies(req)[ADMIN_COOKIE]||'';if(token.length<40)return null;const now=Math.floor(Date.now()/1000);const row=dbPrepare('SELECT token_hash,email,created,expires,user_agent_hash FROM admin_sessions WHERE token_hash=? AND expires>?').get(adminTokenHash(token),now);if(!row)return null;if(row.user_agent_hash&&row.user_agent_hash!==adminUserAgentHash(req))return null;return{token,...row}}
function clearAdminCookie(res){res.clearCookie(ADMIN_COOKIE,{httpOnly:true,sameSite:'strict',secure:ADMIN_SECURE_COOKIE,path:'/'})}
function setAdminCookie(res,token){res.cookie(ADMIN_COOKIE,token,{httpOnly:true,sameSite:'strict',secure:ADMIN_SECURE_COOKIE,path:'/',maxAge:ADMIN_SESSION_HOURS*3600000})}
function sameOriginAdminRequest(req){if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return true;const origin=String(req.get('origin')||'').replace(/\/$/,''),referer=String(req.get('referer')||''),expected=requestOriginCandidates(req);if(origin)return expected.includes(origin);if(referer)return expected.some(base=>referer===base||referer.startsWith(base+'/'));return isLocalRequest(req)}
function requireAdmin(req,res,next){if(!adminConfigured())return res.status(503).json({error:'Admin authentication is not configured on the server.'});const session=getAdminSession(req);if(!session){clearAdminCookie(res);return res.status(401).json({error:'Admin sign-in required.'})}if(!sameOriginAdminRequest(req))return res.status(403).json({error:'Admin request origin rejected.'});req.adminSession=session;res.setHeader('Cache-Control','no-store');next()}
function requireAdminPage(req,res,next){if(!adminConfigured())return res.redirect('/admin-login.html?setup=1');if(!getAdminSession(req)){clearAdminCookie(res);return res.redirect('/admin-login.html?next='+encodeURIComponent(req.originalUrl||'/admin.html'))}res.setHeader('Cache-Control','no-store');next()}
function loginAttemptState(req){const key=String(req.ip||req.socket?.remoteAddress||'unknown'),now=Date.now();let state=adminLoginAttempts.get(key);if(!state||now-state.first>900000)state={count:0,first:now,blockedUntil:0};return{key,state,now}}

function databaseHealth() {
  const started = performance.now();
  try {
    const row = dbPrepare('SELECT 1 AS ok').get();
    return {status: row?.ok === 1 ? 'ok' : 'degraded', latency_ms: Number((performance.now()-started).toFixed(3))};
  } catch (err) {
    observability.log('error','health_database_failed',{error:observability.serializeError(err)});
    return {status:'down', latency_ms:Number((performance.now()-started).toFixed(3))};
  }
}
function healthPayload() {
  const database = databaseHealth();
  const memory = process.memoryUsage();
  const production = String(process.env.NODE_ENV||'').toLowerCase()==='production';
  const checks = {
    database,
    stripe: {status: stripe ? 'configured' : 'not_configured'},
    cj: {status: cjApiKey ? 'configured' : 'not_configured'},
    customer_auth: {status: supabaseConfigured() ? 'configured' : 'not_configured'},
    admin_auth: {status: adminConfigured() ? 'configured' : 'not_configured'},
    secure_cookie: {status: ADMIN_SECURE_COOKIE ? 'enabled' : (production ? 'misconfigured' : 'development')}
  };
  const coreOk = database.status === 'ok' && (!production || (adminConfigured() && ADMIN_SECURE_COOKIE));
  return {
    status: coreOk ? 'ok' : 'degraded',
    service:'averon',
    timestamp:new Date().toISOString(),
    uptime_seconds:Math.floor(process.uptime()),
    checks,
    process:{pid:process.pid,node:process.version,memory_bytes:{rss:memory.rss,heap_used:memory.heapUsed}}
  };
}
app.get('/healthz',(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const payload=healthPayload();
  return res.status(payload.status==='ok'?200:503).json(payload);
});
app.get('/readyz',(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const payload=healthPayload();
  return res.status(payload.status==='ok'?200:503).json({ready:payload.status==='ok',...payload});
});
// Stripe requires the exact raw request body to verify webhook signatures.
app.post('/webhook', express.raw({type: 'application/json', limit: '1mb'}), async (req, res) => {
  if (!stripe || !webhookSecret) return res.status(503).send('Stripe webhook is not configured.');
  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send('Invalid webhook signature.');
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const order = await persistPaidSession(session);
      console.log('AVERON paid Checkout Session:', session.id, session.payment_status, order ? order.order_ref : '');
      // Stripe TEST continues through CJ sandbox. Stripe LIVE can optionally create a real
      // CJ order and, only when explicitly enabled, ask CJ to deduct the supplier cost
      // from the CJ account balance. Stripe funds are never transferred directly to CJ.
      if (order) queueCjAutomationForPaidStripeSession(session);
    } else if (event.type === 'checkout.session.async_payment_failed') {
      console.warn('AVERON delayed payment failed:', event.data.object.id);
    }
    return res.sendStatus(200);
  } catch (err) {
    console.error('AVERON order persistence failed:', err);
    return res.sendStatus(500);
  }
});


// CJ webhook receiver. CJ signs the exact raw JSON body with HMAC-SHA256
// using this account's openId as the secret and sends the Base64 digest in `sign`.
// Keep this route BEFORE express.json() so signature verification uses untouched bytes.
app.post('/webhook/cj', express.raw({type: 'application/json', limit: '1mb'}), async (req, res) => {
  if (!cjApiKey && !CJ_OPEN_ID) return res.status(503).json({code:503,result:false,message:'CJ webhook verification is not configured.'});
  const receivedSign = safeText(req.headers.sign || '', 500);
  if (!receivedSign || !Buffer.isBuffer(req.body)) {
    return res.status(400).json({code:400,result:false,message:'Missing CJ signature or raw body.'});
  }

  try {
    const openId = await getCjWebhookOpenId();
    const expectedSign = cjWebhookSignature(req.body, openId);
    if (!safeSignatureEquals(expectedSign, receivedSign)) {
      console.warn('CJ webhook rejected: invalid signature.');
      return res.status(401).json({code:401,result:false,message:'Invalid signature.'});
    }

    let payload;
    try { payload = JSON.parse(req.body.toString('utf8')); }
    catch (_) { return res.status(400).json({code:400,result:false,message:'Invalid JSON.'}); }

    const type = safeText(payload?.type || '', 40).toUpperCase();
    const messageType = safeText(payload?.messageType || '', 40).toUpperCase();
    const params = payload?.params && typeof payload.params === 'object' ? payload.params : {};

    // For now AVERON only consumes ORDER pushes. Other CJ topics are acknowledged
    // safely so they cannot trigger order mutations by accident.
    if (type !== 'ORDER') {
      console.log('CJ webhook verified (ignored topic):', type || 'UNKNOWN', messageType || '');
      return res.status(200).json({code:200,result:true,message:'Success'});
    }

    const cjOrderId = safeText(params.cjOrderId || params.orderId || '', 200);
    const cjOrderNumber = safeText(params.orderNumber || '', 120);
    const orderStatus = safeText(params.orderStatus || '', 60);
    const trackNumber = safeText(params.trackNumber || '', 200);
    const logisticName = safeText(params.logisticName || '', 120);
    const now = Math.floor(Date.now()/1000);

    let row = null;
    if (cjOrderId) row = dbPrepare('SELECT * FROM orders WHERE cj_order_id=? LIMIT 1').get(cjOrderId);
    if (!row && cjOrderNumber) row = dbPrepare('SELECT * FROM orders WHERE cj_order_number=? LIMIT 1').get(cjOrderNumber);

    if (!row) {
      // Acknowledge valid CJ pushes even when they belong to an order that AVERON
      // does not know, preventing unnecessary CJ retries while preserving safety.
      console.warn('CJ webhook verified but no AVERON order matched:', cjOrderId || cjOrderNumber || '(no id)');
      return res.status(200).json({code:200,result:true,message:'Success'});
    }

    const nextCjStatus = cjStatusFromPush(orderStatus);
    const fulfillmentStatus = ['DISPATCHED','SHIPPED','DELIVERED','COMPLETED'].includes(orderStatus.toUpperCase())
      ? 'shipped'
      : safeText(row.fulfillment_status || 'not_shipped', 40);

    updateCjState(row.session_id, {
      ...(cjOrderId ? {cj_order_id:cjOrderId} : {}),
      ...(cjOrderNumber ? {cj_order_number:cjOrderNumber} : {}),
      cj_status: nextCjStatus,
      cj_error: '',
      cj_tracking_number: trackNumber,
      cj_logistics_name: logisticName,
      cj_message_type: messageType,
      fulfillment_status: fulfillmentStatus,
      cj_updated: now
    });

    console.log('CJ -> AVERON webhook:', row.order_ref, orderStatus || messageType || 'UPDATE', trackNumber || '');
    return res.status(200).json({code:200,result:true,message:'Success'});
  } catch (err) {
    console.error('CJ webhook processing failed:', err.message);
    return res.status(500).json({code:500,result:false,message:'Webhook processing failed.'});
  }
});

// Admin product payloads may include up to three base64-encoded preview images.
// Keep the CJ webhook raw-body route above this middleware for signature verification.
app.use(express.json({limit: '96mb'}));

// Homepage banner / mini-banner content is persisted server-side so artwork survives
// refreshes, browser storage limits and different storefront sessions.
const SITE_CONTENT_FILE = path.join(__dirname, 'site-content.server.json');
function siteContentImage(value){
  const v=String(value||'').trim();
  if(!v)return '';
  if(v.length>3_200_000)return '';
  if(/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(v))return v;
  if(/^(?:\.\/)?assets\/[A-Za-z0-9._/-]+$/.test(v))return v;
  return '';
}
function siteContentLink(value){
  const v=safeText(value,500).trim();
  if(!v)return '';
  if(/^#[A-Za-z0-9_-]+$/.test(v))return v;
  if(/^(?:index|product|clothing|jackets|trousers|accessories|checkout|account|orders|success|edit)\.html(?:\?[^\s#]*)?(?:#[A-Za-z0-9_-]+)?$/.test(v))return v;
  try{const u=new URL(v);if(/^https?:$/.test(u.protocol))return u.href.slice(0,500)}catch(_){}
  return '';
}
function sanitizeSiteContentEntry(raw,withOverlay=false){
  raw=raw&&typeof raw==='object'?raw:{};
  const entry={
    eyebrow:safeText(raw.eyebrow,80),title:safeText(raw.title,140),subtitle:safeText(raw.subtitle,260),
    buttonText:safeText(raw.buttonText,50),buttonLink:siteContentLink(raw.buttonLink),image:siteContentImage(raw.image)
  };
  if(Array.isArray(raw.linkedProducts))entry.linkedProducts=[...new Set(raw.linkedProducts.map(x=>safeText(x,48)).filter(x=>/^[A-Za-z0-9_-]{1,48}$/.test(x)))].slice(0,12);
  if(withOverlay){
    entry.overlayEnabled=raw.overlayEnabled!==false;
    const source=Array.isArray(raw.hotspots)?raw.hotspots:(raw.hotspot&&typeof raw.hotspot==='object'?[raw.hotspot]:[]);
    entry.hotspots=source.slice(0,8).map((h,i)=>{
      h=h&&typeof h==='object'?h:{};const n=(x,f,min,max)=>{x=Number(x);return Number.isFinite(x)?Math.min(max,Math.max(min,x)):f};
      const x=n(h.x,58,0,99),y=n(h.y,68,0,99);
      return {id:safeText(h.id||('hotspot-'+(i+1)),50),enabled:h.enabled!==false,link:siteContentLink(h.link),x,y,w:Math.min(n(h.w,24,1,100),100-x),h:Math.min(n(h.h,12,1,100),100-y)};
    }).filter(h=>h.w>0&&h.h>0);
  }
  return entry;
}
function sanitizeSiteContentGroup(raw,withOverlay=false){
  raw=raw&&typeof raw==='object'?raw:{};const out={};
  for(const [key,val] of Object.entries(raw).slice(0,24)){
    if(!/^[A-Za-z0-9_-]{1,48}$/.test(key))continue;
    out[key]=sanitizeSiteContentEntry(val,withOverlay);
  }
  return out;
}
function sanitizeSiteContentPayload(raw){
  raw=raw&&typeof raw==='object'?raw:{};
  return {
    desktopContent:sanitizeSiteContentGroup(raw.desktopContent,true),
    mobileContent:sanitizeSiteContentGroup(raw.mobileContent,true),
    desktopMinis:sanitizeSiteContentGroup(raw.desktopMinis,false),
    mobileMinis:sanitizeSiteContentGroup(raw.mobileMinis,false)
  };
}
function readSiteContent(){
  try{if(!fs.existsSync(SITE_CONTENT_FILE))return null;return sanitizeSiteContentPayload(JSON.parse(fs.readFileSync(SITE_CONTENT_FILE,'utf8')))}
  catch(err){console.error('Site content read failed:',err.message);return null}
}
function writeSiteContent(content){
  const safe=sanitizeSiteContentPayload(content);
  const tmp=SITE_CONTENT_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(safe,null,2)+'\n','utf8');fs.renameSync(tmp,SITE_CONTENT_FILE);return safe;
}
app.get('/api/site-content',(req,res)=>{
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  const content=readSiteContent();return res.json({ok:true,initialized:Boolean(content),content:content||null});
});

app.get('/api/auth/session',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!supabaseConfigured())return res.json({configured:false,authenticated:false});
  const user=await getCustomerAuth(req,res);
  return res.json({configured:true,authenticated:Boolean(user),user:publicCustomerUser(user)});
});
app.post('/api/auth/signup',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!sameOriginCustomerRequest(req))return res.status(403).json({error:'Request origin rejected.'});
  const email=safeText(req.body?.email,160).toLowerCase(),password=String(req.body?.password||'').slice(0,256);
  const firstName=safeText(req.body?.firstName,60),lastName=safeText(req.body?.lastName,60),size=safeText(req.body?.size,20);
  if(!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Enter a valid email address.'});
  if(password.length<8)return res.status(400).json({error:'Use at least 8 characters for your password.'});
  const result=await supabaseAuthRequest('/signup',{method:'POST',body:{email,password,data:{first_name:firstName,last_name:lastName,preferred_size:size}}});
  if(!result.ok)return res.status(result.status===429?429:(result.status>=500?502:400)).json({error:safeText(result.data?.msg||result.data?.error_description||result.data?.message||result.data?.error||'Unable to create your account.',240)});
  const authenticated=setCustomerCookies(res,result.data);
  return res.status(201).json({ok:true,authenticated,user:publicCustomerUser(result.data?.user),confirmation_required:!authenticated});
});
app.post('/api/auth/login',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!sameOriginCustomerRequest(req))return res.status(403).json({error:'Request origin rejected.'});
  const email=safeText(req.body?.email,160).toLowerCase(),password=String(req.body?.password||'').slice(0,256);
  if(!email||!password)return res.status(400).json({error:'Email and password are required.'});
  const result=await supabaseAuthRequest('/token?grant_type=password',{method:'POST',body:{email,password}});
  if(!result.ok)return res.status(result.status===429?429:401).json({error:'Invalid email or password, or the email has not been confirmed yet.'});
  setCustomerCookies(res,result.data);
  return res.json({ok:true,authenticated:true,user:publicCustomerUser(result.data?.user)});
});
app.post('/api/auth/password/recover',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!sameOriginCustomerRequest(req))return res.status(403).json({error:'Request origin rejected.'});
  if(!supabaseConfigured())return res.status(503).json({error:'Customer authentication is not configured.'});
  const email=safeText(req.body?.email,160).toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Enter a valid email address.'});
  const redirectTo=`${originFor(req)}/`;
  const result=await supabaseAuthRequest(`/recover?redirect_to=${encodeURIComponent(redirectTo)}`,{method:'POST',body:{email}});
  if(!result.ok){
    const status=result.status===429?429:(result.status>=500?502:400);
    return res.status(status).json({error:safeText(result.data?.msg||result.data?.error_description||result.data?.message||result.data?.error||'Unable to send the password reset email.',240)});
  }
  return res.json({ok:true,message:'If an account exists for that email, a password reset link has been sent.'});
});
app.post('/api/auth/password/update',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!sameOriginCustomerRequest(req))return res.status(403).json({error:'Request origin rejected.'});
  if(!supabaseConfigured())return res.status(503).json({error:'Customer authentication is not configured.'});
  const accessToken=safeText(req.body?.access_token||'',5000);
  const password=String(req.body?.password||'').slice(0,256);
  if(!accessToken)return res.status(400).json({error:'This password reset link is invalid or incomplete.'});
  if(password.length<8)return res.status(400).json({error:'Use at least 8 characters for your new password.'});
  const current=await supabaseAuthRequest('/user',{accessToken});
  if(!current.ok||!current.data?.id)return res.status(401).json({error:'This password reset link is invalid or has expired. Request a new one.'});
  const result=await supabaseAuthRequest('/user',{method:'PUT',accessToken,body:{password}});
  if(!result.ok){
    const status=result.status>=500?502:400;
    return res.status(status).json({error:safeText(result.data?.msg||result.data?.error_description||result.data?.message||result.data?.error||'Unable to update your password.',240)});
  }
  clearCustomerCookies(res);
  return res.json({ok:true,message:'Your password has been updated. You can now sign in with your new password.'});
});
app.get('/api/auth/google',(req,res)=>{
  if(!supabaseConfigured())return res.redirect('/index.html?account=login&auth_error=not_configured');
  const requested=safeText(req.query?.next||'index.html',120);
  const next=/^(?:index|product|clothing|jackets|trousers|accessories|checkout|orders)\.html(?:[?#][^\s]*)?$/.test(requested)?requested:'index.html';
  const callback=`${originFor(req)}/auth-callback.html?next=${encodeURIComponent(next)}`;
  const url=new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  url.searchParams.set('provider','google');
  url.searchParams.set('redirect_to',callback);
  return res.redirect(302,url.toString());
});
app.post('/api/auth/oauth/session',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!sameOriginCustomerRequest(req))return res.status(403).json({error:'Request origin rejected.'});
  if(!supabaseConfigured())return res.status(503).json({error:'Customer authentication is not configured.'});
  const access_token=safeText(req.body?.access_token||'',5000),refresh_token=safeText(req.body?.refresh_token||'',5000);
  if(!access_token||!refresh_token)return res.status(400).json({error:'OAuth session is incomplete.'});
  const current=await supabaseAuthRequest('/user',{accessToken:access_token});
  if(!current.ok||!current.data?.id)return res.status(401).json({error:'Unable to verify the Google sign-in session.'});
  setCustomerCookies(res,{access_token,refresh_token,expires_in:Number(req.body?.expires_in)||3600});
  return res.json({ok:true,authenticated:true,user:publicCustomerUser(current.data)});
});
app.post('/api/auth/logout',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!sameOriginCustomerRequest(req))return res.status(403).json({error:'Request origin rejected.'});
  const access=safeText(parseCookies(req)[CUSTOMER_ACCESS_COOKIE]||'',5000);
  if(access)await supabaseAuthRequest('/logout',{method:'POST',accessToken:access});
  clearCustomerCookies(res);
  return res.json({ok:true});
});
app.put('/api/auth/profile',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!sameOriginCustomerRequest(req))return res.status(403).json({error:'Request origin rejected.'});
  const user=await getCustomerAuth(req,res);
  if(!user)return res.status(401).json({error:'Sign in to update your profile.'});
  const access=safeText(req.customerAccessToken||parseCookies(req)[CUSTOMER_ACCESS_COOKIE]||'',5000);
  const firstName=safeText(req.body?.firstName,60),lastName=safeText(req.body?.lastName,60),size=safeText(req.body?.size,20);
  const result=await supabaseAuthRequest('/user',{method:'PUT',accessToken:access,body:{data:{first_name:firstName,last_name:lastName,preferred_size:size}}});
  if(!result.ok)return res.status(result.status>=500?502:400).json({error:safeText(result.data?.msg||result.data?.message||'Unable to update your profile.',240)});
  return res.json({ok:true,user:publicCustomerUser(result.data)});
});
app.get('/api/account/orders',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const user=await getCustomerAuth(req,res);
  if(!user)return res.status(401).json({error:'Sign in to view account orders.'});
  const rows=dbPrepare('SELECT * FROM orders WHERE supabase_user_id=? ORDER BY created DESC LIMIT 100').all(safeText(user.id,100));
  return res.json({orders:rows.map(row=>{const o=rowToOrder(row);return {id:o.session_id,ref:o.order_ref,payment_status:o.payment_status,customer_email:o.customer_email,amount_total:o.amount_total,currency:o.currency,created:o.created,items:o.items,customer_status:o.customer_status,customer_status_label:o.customer_status_label,tracking_number:o.tracking_number,shipping_method:o.shipping_method,refund_status:o.refund_status};})});
});
app.post('/api/admin/auth/login',(req,res)=>{res.setHeader('Cache-Control','no-store');if(!adminConfigured())return res.status(503).json({error:'Admin authentication is not configured yet.'});const{key,state,now}=loginAttemptState(req);if(state.blockedUntil&&now<state.blockedUntil)return res.status(429).json({error:'Too many sign-in attempts. Try again in 15 minutes.'});const email=safeText(req.body?.email,160).toLowerCase(),password=String(req.body?.password||'').slice(0,256);if(email!==ADMIN_EMAIL||!verifyAdminPassword(password)){state.count++;if(state.count>=5)state.blockedUntil=now+900000;adminLoginAttempts.set(key,state);return res.status(401).json({error:'Invalid email or password.'})}adminLoginAttempts.delete(key);dbPrepare('DELETE FROM admin_sessions WHERE expires<=?').run(Math.floor(Date.now()/1000));const token=crypto.randomBytes(32).toString('base64url'),created=Math.floor(Date.now()/1000),expires=created+ADMIN_SESSION_HOURS*3600;dbPrepare('INSERT INTO admin_sessions (token_hash,email,created,expires,user_agent_hash) VALUES (?,?,?,?,?)').run(adminTokenHash(token),ADMIN_EMAIL,created,expires,adminUserAgentHash(req));setAdminCookie(res,token);return res.json({ok:true,email:ADMIN_EMAIL,expires})});
app.get('/api/admin/auth/session',(req,res)=>{res.setHeader('Cache-Control','no-store');const session=getAdminSession(req);if(!session)return res.status(401).json({authenticated:false});return res.json({authenticated:true,email:session.email,expires:session.expires})});
app.post('/api/admin/auth/logout',(req,res)=>{res.setHeader('Cache-Control','no-store');const session=getAdminSession(req);if(session)dbPrepare('DELETE FROM admin_sessions WHERE token_hash=?').run(session.token_hash);clearAdminCookie(res);return res.json({ok:true})});
app.use('/api/admin',requireAdmin);

app.put('/api/admin/site-content',(req,res)=>{
  try{
    const saved=writeSiteContent(req.body?.content||{});
    return res.json({ok:true,content:saved});
  }catch(err){
    console.error('Admin site content save failed:',err);
    return res.status(500).json({error:'Could not persist banner content on the server.'});
  }
});


function splitCjVariantLabel(label){
  const raw=safeText(label,120).trim();
  if(!raw)return {colour:'',size:''};
  const parts=raw.split(/\s*[-/]\s*/).filter(Boolean);
  const last=(parts[parts.length-1]||'').toUpperCase();
  if(parts.length>1 && /^(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-9]XL|[0-9]{1,3}(?:CM)?)$/.test(last)) return {colour:parts.slice(0,-1).join(' - ').trim(),size:last};
  return {colour:'',size:last};
}


app.get('/api/catalog', (req,res)=>{
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Expires','0');
  return res.json({ok:true,products:catalog});
});

app.post('/api/admin/catalog/reorder', (req,res)=>{
  try{
    const requested=Array.isArray(req.body?.order)?req.body.order.slice(0,200).map(x=>safeText(x,48)).filter(x=>/^[A-Za-z0-9_-]{1,48}$/.test(x)):[];
    if(!requested.length)return res.status(400).json({error:'A product order is required.'});
    const seen=new Set(),ordered=[];
    for(const id of requested){
      if(seen.has(id))continue;
      const product=catalog.find(p=>safeText(p?.id,48)===id);
      if(product){seen.add(id);ordered.push(product)}
    }
    for(const product of catalog){
      const id=safeText(product?.id,48);
      if(id&&!seen.has(id)){seen.add(id);ordered.push(product)}
    }
    catalog.splice(0,catalog.length,...ordered);
    fs.writeFileSync(path.join(__dirname,'products.server.json'),JSON.stringify(catalog,null,2)+'\n','utf8');
    return res.json({ok:true,order:catalog.map(p=>p.id)});
  }catch(err){
    console.error('Admin catalogue reorder failed:',err);
    return res.status(500).json({error:'Could not persist the catalogue order on the server.'});
  }
});

app.delete('/api/admin/catalog/product/:id', (req,res)=>{
  try{
    const id=safeText(req.params?.id,48).trim();
    if(!/^[A-Za-z0-9_-]{1,48}$/.test(id))return res.status(400).json({error:'Invalid product id.'});
    if(catalog.length<=1)return res.status(400).json({error:'Keep at least one product in the catalogue.'});
    const index=catalog.findIndex(p=>safeText(p?.id,48)===id);
    if(index<0)return res.status(404).json({error:'Product not found.'});
    const [removed]=catalog.splice(index,1);
    const file=path.join(__dirname,'products.server.json'),tmp=file+'.tmp';
    fs.writeFileSync(tmp,JSON.stringify(catalog,null,2)+'\n','utf8');
    fs.renameSync(tmp,file);
    return res.json({ok:true,deleted:id,product:removed});
  }catch(err){
    console.error('Admin product deletion failed:',err);
    return res.status(500).json({error:'Could not persist product deletion on the server.'});
  }
});

app.post('/api/admin/catalog/product', (req,res)=>{
  try {
    const raw=req.body?.product;
    if(!raw||typeof raw!=='object') return res.status(400).json({error:'A product payload is required.'});
    const id=safeText(raw.id,48).trim();
    const name=safeText(raw.name,120).trim();
    const price=Number(raw.price);
    if(!/^[A-Za-z0-9_-]{1,48}$/.test(id)||!name||!Number.isFinite(price)||price<0) return res.status(400).json({error:'Invalid product id, name or price.'});
    const supplier=raw.supplier&&typeof raw.supplier==='object'?raw.supplier:{};
    const pid=safeText(supplier.pid,200).trim();
    const logistics=safeText(supplier.logistics||'CJPacket Ordinary',80).trim()||'CJPacket Ordinary';
    const variants=Array.isArray(supplier.variants)?supplier.variants.slice(0,100).map(v=>({label:safeText(v?.label,120),vid:safeText(v?.vid,200),sku:safeText(v?.sku,200)})).filter(v=>v.vid||v.sku):[];
    const colourSwatches=Array.isArray(supplier.colourSwatches)?supplier.colourSwatches.slice(0,40).map(c=>{const name=safeText(c?.name||c?.colour,60).trim();const displayName=safeText(c?.displayName||c?.label||name,60).trim()||name;const candidate=safeText(c?.hex||c?.value,16).trim();return {name,displayName,hex:/^#[0-9a-f]{6}$/i.test(candidate)?candidate.toLowerCase():'#d7d1c5',enabled:c?.enabled!==false}}).filter(c=>c.name):[];
    const mappings=Array.isArray(supplier.mappings)?supplier.mappings.slice(0,100).map(m=>({option:safeText(m?.option,40).trim(),cjLabel:safeText(m?.cjLabel,120),vid:safeText(m?.vid,200),sku:safeText(m?.sku,200),enabled:m?.enabled!==false})).filter(m=>m.option&&(m.vid||m.sku)):[];
    if(pid && !mappings.some(m=>m.enabled!==false)) return res.status(400).json({error:'Enable at least one AVERON size before saving.'});
    const coverImage=safeText(raw.coverImage,4500000);
    const images=Array.isArray(raw.images)?raw.images.slice(0,3).map(x=>safeText(x,4500000)).filter(Boolean):[];
    const colourImagery=Array.isArray(raw.colourImagery)?raw.colourImagery.slice(0,40).map(entry=>({colour:safeText(entry?.colour||entry?.name,60).trim(),coverImage:safeText(entry?.coverImage,4500000),images:Array.isArray(entry?.images)?entry.images.slice(0,3).map(x=>safeText(x,4500000)).filter(Boolean):[]})).filter(entry=>entry.colour):[];
    const materialCraft={enabled:raw.materialCraft?.enabled!==false,images:Array.isArray(raw.materialCraft?.images)?raw.materialCraft.images.slice(0,3).map(x=>safeText(x,4500000)).filter(Boolean):[]};
    const completeLook={enabled:raw.completeLook?.enabled===true,products:Array.isArray(raw.completeLook?.products)?[...new Set(raw.completeLook.products.map(x=>safeText(x,48)).filter(x=>/^[A-Za-z0-9_-]{1,48}$/.test(x)))].slice(0,4):[]};
    const sizeGuide={enabled:raw.sizeGuide?.enabled===true,image:safeText(raw.sizeGuide?.image,4500000)};
    if(sizeGuide.enabled&&!sizeGuide.image) return res.status(400).json({error:'A Size Guide image is required when Size Guide is enabled.'});
    const shippingCountries=Array.isArray(raw.shippingCountries)?[...new Set(raw.shippingCountries.map(x=>safeText(x,2).toUpperCase()).filter(x=>EUROPE_CHECKOUT_COUNTRIES.includes(x)))]:[];
    const serverProduct={id,name,price:Math.round(price*100)/100,category:safeText(raw.category,40),colour:safeText(raw.colour,60),label:safeText(raw.label,80),description:safeText(raw.description,1200),details:safeText(raw.details,1200),fit:safeText(raw.fit,1200),delivery:safeText(raw.delivery,1200),returns:safeText(raw.returns,1200),coverImage,images,colourImagery,materialCraft,completeLook,sizeGuide,shippingCountries:shippingCountries.length?shippingCountries:[...EUROPE_CHECKOUT_COUNTRIES],supplier:{provider:'CJ',pid,logistics,variants,colourSwatches,mappings}};
    const index=catalog.findIndex(p=>p.id===id);if(index>=0)catalog[index]=serverProduct;else catalog.push(serverProduct);productMap.set(id,serverProduct);
    fs.writeFileSync(path.join(__dirname,'products.server.json'),JSON.stringify(catalog,null,2)+'\n','utf8');
    if(pid){
      const mapped={averon_name:name,cj_product_id:pid,logistics,test_only:true,variants:{}};
      for(const m of mappings){if(m.enabled===false)continue;const entry={vid:m.vid,sku:m.sku,label:m.cjLabel};const size=m.option.toUpperCase();mapped.variants[size]=entry;const parsed=splitCjVariantLabel(m.cjLabel);if(parsed.colour&&parsed.size)mapped.variants[`${parsed.colour.toUpperCase()}|${size}`]=entry;}
      cjSandboxMap[id]=mapped;
    }else delete cjSandboxMap[id];
    fs.writeFileSync(path.join(__dirname,'cj-sandbox-map.json'),JSON.stringify(cjSandboxMap,null,2)+'\n','utf8');
    return res.json({ok:true,product:serverProduct,mapped_options:mappings.length});
  } catch(err){console.error('Admin catalogue save failed:',err);return res.status(500).json({error:'Could not persist the product mapping on the server.'});}
});

// AVERON market shipping checker.
// Strategy:
// 1) Use CJ's simple VID-based Freight Calculation first. This is the closest
//    match to the shipping selector shown on a CJ product page.
// 2) If that returns no method, retry with Freight Calculation Tip using the
//    product's live logistics data.
// 3) If Tip is also empty, call Unavailable Shipping Methods with the exact same
//    payload. Only a diagnostic response that contains explicit unavailable
//    methods can mark a market as confirmed_unavailable. Ambiguous API failures
//    become unconfirmed and are NEVER auto-removed from AVERON.
app.post('/api/admin/cj/shipping-availability', async (req,res)=>{
  try{
    if(!cjApiKey) return res.status(503).json({error:'CJ_API_KEY is not configured on the server.'});
    const pid=safeText(req.body?.pid,200).trim();
    if(!pid) return res.status(400).json({error:'CJ PID is required.'});

    const requestedSku=safeText(req.body?.sku,200).trim();
    const requestedVid=safeText(req.body?.vid,200).trim();
    const productPayload=await cjRequest('/product/query?pid='+encodeURIComponent(pid),{method:'GET'});
    const product=productPayload?.data||{};
    let variants=Array.isArray(product.variants)?product.variants:[];
    if(!variants.length){
      const variantPayload=await cjRequest('/product/variant/query?pid='+encodeURIComponent(pid),{method:'GET'});
      variants=Array.isArray(variantPayload?.data)?variantPayload.data:[];
    }
    const representative=variants.find(v=>requestedVid&&safeText(v?.vid,200)===requestedVid)
      || variants.find(v=>requestedSku&&safeText(v?.variantSku,200)===requestedSku)
      || variants[0] || {};
    const sku=safeText(representative.variantSku||requestedSku||product.productSku||'',200).trim();
    const vid=safeText(representative.vid||requestedVid||'',200).trim();
    if(!vid) return res.status(422).json({error:'CJ did not return a VID that can be used for the freight check.'});
    if(!sku) return res.status(422).json({error:'CJ did not return a SKU that can be used for the detailed freight check.'});

    const weight=Math.max(1,Math.round(Number(representative.variantWeight)||Number(product.productWeight)||Number(product.packingWeight)||100));
    const length=Math.max(0,Number(representative.variantLength)||0);
    const width=Math.max(0,Number(representative.variantWidth)||0);
    const height=Math.max(0,Number(representative.variantHeight)||0);
    const volume=Math.max(1,Number(representative.variantVolume)||((length&&width&&height)?length*width*height:1));
    const props=Array.isArray(product.productProEnSet)&&product.productProEnSet.length
      ? product.productProEnSet.map(x=>safeText(x,80)).filter(Boolean)
      : ['COMMON'];

    // Always keep the configured/default CJ origin as a fallback. Inventory APIs
    // can occasionally omit a route that the product-page calculator still offers.
    let inventoryOrigins=[];
    try{
      const stockPayload=await cjRequest('/product/stock/getInventoryByPid?pid='+encodeURIComponent(pid),{method:'GET'});
      const inventories=Array.isArray(stockPayload?.data?.inventories)?stockPayload.data.inventories:[];
      inventoryOrigins=[...new Set(inventories
        .filter(x=>Number(x?.totalInventoryNum)>0||Number(x?.cjInventoryNum)>0||Number(x?.factoryInventoryNum)>0)
        .map(x=>safeText(x?.countryCode,3).toUpperCase()).filter(Boolean))];
    }catch(err){
      console.warn('CJ inventory lookup failed during shipping check:',err.message);
    }
    const defaultOrigin=safeText(cjFromCountryCode||'CN',3).toUpperCase()||'CN';
    const origins=[...new Set([defaultOrigin,...inventoryOrigins])];

    const priceOf=m=>Number(m?.totalPostageFee??m?.logisticPrice??m?.wrapPostage??m?.discountFee??m?.postage);
    const availableSummary=(methods,origin,source)=>{
      const clean=(Array.isArray(methods)?methods:[]).filter(m=>!m?.error&&!m?.errorEn);
      clean.sort((a,b)=>{
        const ap=priceOf(a),bp=priceOf(b);
        return (Number.isFinite(ap)?ap:1e9)-(Number.isFinite(bp)?bp:1e9);
      });
      const cheapest=clean[0]||{};
      const price=priceOf(cheapest);
      return {
        status:'available',available:true,confirmedUnavailable:false,origin,source,
        methods:clean.length,cheapest:Number.isFinite(price)?price:null,
        arrival:safeText(cheapest.logisticAging||cheapest.arrivalTime||cheapest.option?.arrivalTime||'',60),
        logistics:safeText(cheapest.logisticName||cheapest.option?.enName||cheapest.channel?.enName||'',120),
        error:''
      };
    };

    const results=[];
    for(const country of EUROPE_CHECKOUT_COUNTRIES){
      let result=null;
      const notes=[];
      let diagnosticReasons=[];

      // Pass 1: simple VID-based calculation. CJ documents this as
      // startCountryCode + endCountryCode + [{quantity, vid}].
      for(const origin of origins){
        try{
          const simple=await cjRequest('/logistic/freightCalculate',{
            method:'POST',
            body:JSON.stringify({startCountryCode:origin,endCountryCode:country,products:[{quantity:1,vid}]})
          });
          const methods=Array.isArray(simple?.data)?simple.data:[];
          if(methods.length){
            result=availableSummary(methods,origin,'freightCalculate');
            break;
          }
          notes.push(`Simple quote returned no method from ${origin}.`);
        }catch(err){
          notes.push(`Simple quote ${origin}: ${safeText(err.message,120)}`);
        }
      }

      // Pass 2 and 3: detailed quote + diagnostic. These are fallbacks only.
      if(!result){
        for(const origin of origins){
          const tipBody={reqDTOS:[{
            srcAreaCode:origin,
            destAreaCode:country,
            weight,length,width,height,volume,
            wrapWeight:0,
            totalGoodsAmount:Number(representative.variantSellPrice)||Number(product.sellPrice)||1,
            productProp:props,
            skuList:[sku],
            platforms:['Shopify'],
            freightTrialSkuList:[{
              sku,vid,skuQuantity:1,skuWeight:weight,skuVolume:volume,productPropList:props
            }]
          }]};

          try{
            const tip=await cjRequest('/logistic/freightCalculateTip',{method:'POST',body:JSON.stringify(tipBody)});
            const methods=Array.isArray(tip?.data)?tip.data.filter(m=>!m?.error&&!m?.errorEn):[];
            if(methods.length){
              result=availableSummary(methods,origin,'freightCalculateTip');
              break;
            }
            notes.push(`Detailed quote returned no method from ${origin}.`);
          }catch(err){
            notes.push(`Detailed quote ${origin}: ${safeText(err.message,120)}`);
            continue;
          }

          try{
            const diag=await cjRequest('/logistic/unavailableShippingMethods',{method:'POST',body:JSON.stringify(tipBody)});
            const availableList=Array.isArray(diag?.data?.availableList)?diag.data.availableList:[];
            const unavailableList=Array.isArray(diag?.data?.unavailableList)?diag.data.unavailableList:[];
            if(availableList.length){
              result={
                status:'available',available:true,confirmedUnavailable:false,origin,source:'unavailableShippingMethods',
                methods:availableList.length,cheapest:null,arrival:'',
                logistics:safeText(availableList[0]?.optionName||'',120),
                error:'CJ diagnostic reports at least one available shipping method.'
              };
              break;
            }
            if(unavailableList.length){
              diagnosticReasons=unavailableList.slice(0,4).map(x=>({
                method:safeText(x?.optionName,100),
                code:Number(x?.errorCode)||null,
                reason:safeText(x?.errorEn,180)
              }));
            }
          }catch(err){
            notes.push(`Diagnostic ${origin}: ${safeText(err.message,120)}`);
          }
        }
      }

      if(!result){
        if(diagnosticReasons.length){
          result={
            status:'confirmed_unavailable',available:false,confirmedUnavailable:true,origin:'',
            source:'unavailableShippingMethods',methods:0,cheapest:null,arrival:'',logistics:'',
            error:diagnosticReasons[0]?.reason||'CJ explicitly rejected the available shipping methods.',
            reasons:diagnosticReasons
          };
        }else{
          result={
            status:'unconfirmed',available:false,confirmedUnavailable:false,origin:'',
            source:'',methods:0,cheapest:null,arrival:'',logistics:'',
            error:'CJ did not return enough evidence to confirm availability or unavailability. This market will not be auto-removed.',
            debug:notes.slice(-4)
          };
        }
      }

      results.push({code:country,name:cjCountryName(country),...result});
    }

    const counts={
      available:results.filter(x=>x.status==='available').length,
      confirmedUnavailable:results.filter(x=>x.status==='confirmed_unavailable').length,
      unconfirmed:results.filter(x=>x.status==='unconfirmed').length
    };
    return res.json({
      ok:true,pid,
      testedVariant:{sku,vid,label:safeText(representative.variantKey||representative.variantNameEn||'',120),weight},
      origins,results,counts,checkedAt:new Date().toISOString()
    });
  }catch(err){
    console.error('CJ shipping availability check failed:',err.message);
    return res.status(502).json({error:safeText(err.message||'CJ shipping availability check failed.',240)});
  }
});

// Admin-only CJ product importer. The CJ token never reaches the browser.
app.get('/api/admin/cj/product', async (req,res)=>{
  try{
    if(!cjApiKey) return res.status(503).json({error:'CJ_API_KEY is not configured on the server.'});
    const pid=safeText(req.query?.pid,200);
    if(!pid) return res.status(400).json({error:'CJ PID is required.'});
    const payload=await cjRequest('/product/query?pid='+encodeURIComponent(pid),{method:'GET'});
    const product=payload?.data||{};
    let variants=Array.isArray(product.variants)?product.variants:[];
    if(!variants.length){
      const v=await cjRequest('/product/variant/query?pid='+encodeURIComponent(pid),{method:'GET'});
      variants=Array.isArray(v?.data)?v.data:[];
    }
    return res.json({ok:true,product:{pid:safeText(product.pid||pid,200),name:safeText(product.productNameEn||'',200),sku:safeText(product.productSku||'',200),image:safeText(product.bigImage||'',500)},variants:variants.slice(0,100).map(v=>({label:safeText(v.variantKey||v.variantNameEn||'',120),vid:safeText(v.vid||'',200),sku:safeText(v.variantSku||'',200),image:safeText(v.variantImage||'',500),price:Number(v.variantSellPrice)||0,weight:Number(v.variantWeight)||0}))});
  }catch(err){console.error('CJ admin product lookup failed:',err.message);return res.status(502).json({error:safeText(err.message||'CJ lookup failed.',240)});}
});

app.get('/api/admin/ops/metrics',(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  return res.json(observability.metricsSnapshot());
});

// Do not expose backend/configuration/database files through the static server.
app.use((req, res, next) => {
  // Keep implementation, credentials, operational tooling and database artifacts server-side.
  // The storefront/admin browser assets are intentionally public; these files are not.
  const blockedFiles = new Set([
    '/server.js','/observability.js','/create-admin-hash.js',
    '/package.json','/package-lock.json','/products.server.json','/cj-sandbox-map.json','/site-content.server.json',
    '/.env','/.env.example','/.gitignore',
    '/averon-orders.db','/averon-orders.db-wal','/averon-orders.db-shm'
  ]);
  const blockedPath = req.path === '/scripts' || req.path.startsWith('/scripts/') ||
    req.path === '/tests' || req.path.startsWith('/tests/');
  if (blockedFiles.has(req.path) || blockedPath || /\.(?:md|db|sqlite|sqlite3)$/i.test(req.path)) {
    return res.sendStatus(404);
  }
  next();
});

// Sandbox tooling is useful locally but should not be discoverable on the public storefront.
app.use((req, res, next) => {
  const production = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (production && req.path === '/cj-products.html') return res.sendStatus(404);
  next();
});

app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) return res.status(503).json({error: 'Stripe is not configured on the server.'});

  try {
    const authUser = await getCustomerAuth(req,res);
    if (!authUser) return res.status(401).json({error:'Sign in to continue to checkout.',code:'AUTH_REQUIRED'});
    const incoming = Array.isArray(req.body?.items) ? req.body.items.slice(0, 50) : [];
    if (!incoming.length) return res.status(400).json({error: 'Your bag is empty.'});

    // Important: prices and product names come ONLY from the server catalogue.
    const normalized = [];
    for (const raw of incoming) {
      const id = safeText(raw?.id, 48);
      const product = productMap.get(id);
      if (!product) return res.status(400).json({error: `Unknown product: ${id || 'invalid id'}`});
      normalized.push({
        product,
        qty: safeQty(raw?.qty),
        size: safeText(raw?.size || 'M', 20),
        colour: safeText(raw?.colour || '', 40)
      });
    }

    const shippingSets=normalized.map(({product})=>{const configured=Array.isArray(product.shippingCountries)&&product.shippingCountries.length?product.shippingCountries.filter(code=>EUROPE_CHECKOUT_COUNTRIES.includes(code)):[...EUROPE_CHECKOUT_COUNTRIES];return new Set(configured);});
    const allowedShippingCountries=EUROPE_CHECKOUT_COUNTRIES.filter(code=>shippingSets.every(set=>set.has(code)));
    if(!allowedShippingCountries.length)return res.status(400).json({error:'The products in your bag do not share a common delivery country. Please adjust your bag and try again.',code:'NO_COMMON_SHIPPING_COUNTRY'});
    const subtotalPence = normalized.reduce((sum, item) => sum + Math.round(item.product.price * 100) * item.qty, 0);
    const shippingOptions = subtotalPence >= 7500
      ? [
          {shipping_rate_data:{type:'fixed_amount',fixed_amount:{amount:0,currency:'gbp'},display_name:'Standard Delivery'}},
          {shipping_rate_data:{type:'fixed_amount',fixed_amount:{amount:895,currency:'gbp'},display_name:'Express Delivery'}}
        ]
      : [
          {shipping_rate_data:{type:'fixed_amount',fixed_amount:{amount:495,currency:'gbp'},display_name:'Standard Delivery'}},
          {shipping_rate_data:{type:'fixed_amount',fixed_amount:{amount:895,currency:'gbp'},display_name:'Express Delivery'}}
        ];

    const lineItems = normalized.map(({product, qty, size, colour}) => ({
      quantity: qty,
      price_data: {
        currency: 'gbp',
        unit_amount: Math.round(product.price * 100),
        product_data: {
          name: product.name,
          metadata: {averon_product_id: product.id, size, colour}
        }
      }
    }));

    const base = originFor(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      billing_address_collection: 'auto',
      shipping_address_collection: {allowed_countries: allowedShippingCountries},
      shipping_options: shippingOptions,
      phone_number_collection: {enabled: true},
      customer_creation: 'always',
      ...(authUser?.email ? {customer_email: safeText(authUser.email,160)} : {}),
      allow_promotion_codes: true,
      success_url: `${base}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/checkout.html?cancelled=1`,
      metadata: {store: 'AVERON', supabase_user_id: safeText(authUser?.id||'',100)}
    });

    return res.json({url: session.url});
  } catch (err) {
    console.error('Stripe Checkout creation failed:', err);
    return res.status(500).json({error: 'Unable to start secure checkout. Please try again.'});
  }
});

app.get('/api/order-status', (req, res) => {
  res.setHeader('Cache-Control','no-store');
  const sessionId = safeText(req.query?.session_id, 255);
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return res.status(400).json({error:'Invalid session id.'});
  }

  const row = dbPrepare(`
    SELECT fulfillment_status, refund_status, cj_status, cj_tracking_number, cj_logistics_name
    FROM orders
    WHERE session_id = ?
  `).get(sessionId);

  if (!row) return res.status(404).json({error:'Order not found.'});

  const display = customerOrderStatus(row);
  return res.json({
    customer_status: display.code,
    customer_status_label: display.label,
    tracking_number: safeText(row.cj_tracking_number || '', 200),
    shipping_method: safeText(row.cj_logistics_name || '', 120)
  });
});

app.get('/api/checkout-session', async (req, res) => {
  if (!stripe) return res.status(503).json({error: 'Stripe is not configured on the server.'});
  const id = safeText(req.query?.session_id, 255);
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({error: 'Invalid session id.'});
  try {
    const session = await stripe.checkout.sessions.retrieve(id);
    const lineItems = await stripe.checkout.sessions.listLineItems(id, {limit: 50, expand:['data.price.product']});
    let order = null;
    if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
      order = await persistPaidSession(session);
    }
    return res.json({
      id: session.id,
      order_ref: order?.order_ref || orderRefFor(session.id),
      payment_status: session.payment_status,
      status: session.status || '',
      customer_email: session.customer_details?.email || '',
      amount_total: session.amount_total,
      currency: session.currency,
      created: session.created,
      items: lineItems.data.map(item => {
        const product = item.price && typeof item.price.product === 'object' ? item.price.product : null;
        const metadata = product?.metadata || {};
        return {
          product_id: safeText(metadata.averon_product_id,48),
          name: safeText(item.description || product?.name || 'AVERON piece', 160),
          quantity: safeQty(item.quantity || 1),
          size: safeText(metadata.size || '',20),
          colour: safeText(metadata.colour || '',40),
          amount_total: Number.isInteger(item.amount_total) ? item.amount_total : 0,
          currency: item.currency || session.currency || 'gbp'
        };
      })
    });
  } catch (err) {
    console.error('Checkout verification failed:', err.message);
    return res.status(404).json({error: 'Checkout session not found.'});
  }
});

// Local Content Studio order feed.
// Public deployments must use real server-side authentication before this endpoint is enabled.
app.post('/api/refund-request', async (req, res) => {
  if (!stripe) return res.status(503).json({error:'Stripe is not configured on the server.'});
  const sessionId = safeText(req.body?.session_id, 255);
  const email = safeText(req.body?.customer_email, 160).toLowerCase();
  if (!sessionId || !email) return res.status(400).json({error:'Missing order details.'});
  const order = dbPrepare('SELECT * FROM orders WHERE session_id = ?').get(sessionId);
  if (!order || String(order.customer_email || '').toLowerCase() !== email) return res.status(404).json({error:'Order could not be verified.'});
  if (!['paid','no_payment_required'].includes(order.payment_status)) return res.status(409).json({error:'This order is not eligible for a refund.'});
  if (order.refund_status === 'refunded') return res.json({ok:true,status:'refunded',order_ref:order.order_ref,already_refunded:true});

  const now = Math.floor(Date.now()/1000);
  if (order.fulfillment_status === 'not_shipped') {
    try {
      let paymentIntentId = safeText(order.payment_intent_id,255);
      if (!paymentIntentId) {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        paymentIntentId = safeText(typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || '',255);
        if (paymentIntentId) dbPrepare('UPDATE orders SET payment_intent_id=?, updated=? WHERE session_id=?').run(paymentIntentId,now,sessionId);
      }
      if (!paymentIntentId) return res.status(409).json({error:'This payment cannot be refunded automatically yet. Please contact AVERON support.'});
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        metadata: {averon_order_ref: order.order_ref, reason: 'customer_request_before_shipment'}
      }, {idempotencyKey: `averon-refund-${sessionId}`});
      const refundStatus = refund.status === 'succeeded' ? 'refunded' : 'refund_pending';
      dbPrepare(`UPDATE orders SET refund_status=?, stripe_refund_id=?, fulfillment_status=CASE WHEN ?='refunded' THEN 'cancelled' ELSE fulfillment_status END, updated=? WHERE session_id=?`)
        .run(refundStatus, safeText(refund.id,255), refundStatus, now, sessionId);
      dbPrepare(`INSERT INTO refund_requests (session_id, order_ref, customer_email, status, requested, updated)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET status=excluded.status, updated=excluded.updated`)
        .run(sessionId, order.order_ref, order.customer_email, refundStatus, now, now);
      return res.json({ok:true,status:refundStatus,order_ref:order.order_ref,automatic:true});
    } catch (err) {
      console.error('Automatic refund failed:', err.message);
      return res.status(502).json({error:'Stripe could not complete the refund. The order has not been changed.'});
    }
  }

  dbPrepare(`INSERT INTO refund_requests (session_id, order_ref, customer_email, status, requested, updated)
    VALUES (?, ?, ?, 'requested', ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET status='requested', updated=excluded.updated`).run(sessionId, order.order_ref, order.customer_email, now, now);
  dbPrepare(`UPDATE orders SET refund_status='requested', updated=? WHERE session_id=?`).run(now, sessionId);
  return res.json({ok:true,status:'requested',order_ref:order.order_ref,automatic:false});
});

app.post('/api/admin/orders/:sessionId/fulfillment', (req, res) => {
  const sessionId = safeText(req.params.sessionId,255);
  const status = safeText(req.body?.status,32);
  if (!['not_shipped','shipped','cancelled'].includes(status)) return res.status(400).json({error:'Invalid fulfillment status.'});
  const now = Math.floor(Date.now()/1000);
  const result = dbPrepare('UPDATE orders SET fulfillment_status=?, updated=? WHERE session_id=?').run(status,now,sessionId);
  if (!result.changes) return res.status(404).json({error:'Order not found.'});
  return res.json({ok:true,status});
});

app.post('/api/admin/orders/:sessionId/approve-refund', async (req, res) => {
  if (!stripe) return res.status(503).json({error:'Stripe is not configured on the server.'});
  const sessionId = safeText(req.params.sessionId,255);
  const order = dbPrepare('SELECT * FROM orders WHERE session_id=?').get(sessionId);
  if (!order) return res.status(404).json({error:'Order not found.'});
  if (order.refund_status === 'refunded') return res.json({ok:true,status:'refunded',already_refunded:true});
  const request = dbPrepare('SELECT * FROM refund_requests WHERE session_id=?').get(sessionId);
  if (!request || request.status !== 'requested') return res.status(409).json({error:'There is no pending refund request for this order.'});
  try {
    let paymentIntentId = safeText(order.payment_intent_id,255);
    if (!paymentIntentId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      paymentIntentId = safeText(typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || '',255);
    }
    if (!paymentIntentId) return res.status(409).json({error:'Payment intent is unavailable for this order.'});
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      metadata: {averon_order_ref: order.order_ref, reason: 'admin_approved_customer_request'}
    }, {idempotencyKey: `averon-refund-${sessionId}`});
    const now = Math.floor(Date.now()/1000);
    const refundStatus = refund.status === 'succeeded' ? 'refunded' : 'refund_pending';
    dbPrepare('UPDATE orders SET payment_intent_id=?, refund_status=?, stripe_refund_id=?, updated=? WHERE session_id=?')
      .run(paymentIntentId,refundStatus,safeText(refund.id,255),now,sessionId);
    dbPrepare('UPDATE refund_requests SET status=?, updated=? WHERE session_id=?').run(refundStatus,now,sessionId);
    return res.json({ok:true,status:refundStatus});
  } catch (err) {
    console.error('Admin refund failed:', err.message);
    return res.status(502).json({error:'Stripe could not complete the refund.'});
  }
});

// Local-only helper to register AVERON's public CJ ORDER webhook.
// This route is intentionally restricted to localhost because it changes CJ account settings.
// Example:
//   /api/admin/cj/webhook/setup?callback=https://example.trycloudflare.com/webhook/cj
app.get('/api/admin/cj/webhook/setup', async (req, res) => {
  if (!isLocalRequest(req)) return res.status(403).json({error:'CJ webhook setup is available only on localhost in this build.'});
  if (!cjApiKey) return res.status(503).json({error:'CJ_API_KEY is missing from .env.'});

  const callback = safeText(req.query.callback || '', 500).trim();
  let callbackUrl;
  try {
    callbackUrl = new URL(callback);
  } catch {
    return res.status(400).json({error:'A valid public HTTPS callback URL is required.'});
  }
  if (callbackUrl.protocol !== 'https:' || ['localhost','127.0.0.1','::1'].includes(callbackUrl.hostname)) {
    return res.status(400).json({error:'CJ requires a public HTTPS callback URL; localhost is not supported.'});
  }
  if (callbackUrl.pathname !== '/webhook/cj') {
    return res.status(400).json({error:'For this AVERON build the callback path must be /webhook/cj.'});
  }

  try {
    // CJ requires product, stock, order and logistics objects in this request.
    // We enable only ORDER notifications for now; the other topics are cancelled.
    const cb = callbackUrl.toString();
    // CJ requires one reachable HTTPS callback URL even for topics being CANCELled.
    // Only ORDER is enabled; the other required topics are explicitly cancelled.
    const body = {
      product: {type:'CANCEL', callbackUrls:[cb]},
      stock: {type:'CANCEL', callbackUrls:[cb]},
      order: {type:'ENABLE', callbackUrls:[cb]},
      logistics: {type:'CANCEL', callbackUrls:[cb]}
    };
    const payload = await cjRequest('/webhook/set', {method:'POST', body:JSON.stringify(body)});
    return res.json({
      ok:true,
      message:'CJ ORDER webhook registered successfully.',
      callback: callbackUrl.toString(),
      topics:{order:'ENABLE',product:'CANCEL',stock:'CANCEL',logistics:'CANCEL'},
      cj:{code:payload?.code ?? null,result:payload?.result ?? null,message:payload?.message ?? null,success:payload?.success ?? null,request_id:payload?.requestId ?? null}
    });
  } catch (err) {
    console.error('CJ webhook setup failed:', err.message, err.cjCode || '');
    return res.status(502).json({
      ok:false,
      error:'AVERON could not register the CJ webhook.',
      detail:safeText(err.message,240),
      code:err.cjCode ?? null
    });
  }
});

// Local-only CJ connectivity test. It authenticates and reads account settings,
// but does NOT create, pay, fulfil or modify any CJ order.
app.get('/api/admin/cj/test', async (req, res) => {
  if (!isLocalRequest(req)) return res.status(403).json({error:'CJ test is available only on localhost in this build.'});
  if (!cjApiKey) return res.status(503).json({error:'CJ_API_KEY is missing from .env.'});
  try {
    const token = await getCjAccessToken();
    const settings = await cjRequest('/setting/get', {method:'GET'});
    return res.json({
      ok: true,
      message: 'AVERON connected to CJ successfully.',
      cj: {
        open_id: settings?.data?.openId ?? token?.openId ?? null,
        account_name: safeText(settings?.data?.openName || '', 120),
        sandbox: Boolean(settings?.data?.isSandbox),
        access_token_expires_at: safeText(token?.accessTokenExpiryDate || '', 80),
        refresh_token_expires_at: safeText(token?.refreshTokenExpiryDate || '', 80)
      }
    });
  } catch (err) {
    console.error('CJ connectivity test failed:', err.message, err.cjCode || '');
    return res.status(502).json({
      ok: false,
      error: 'AVERON could not authenticate with CJ.',
      detail: safeText(err.message, 240),
      code: err.cjCode ?? null
    });
  }
});


// Local-only CJ product search test. Reads products only; it never creates or modifies orders.
app.get('/api/admin/cj/products', async (req, res) => {
  if (!isLocalRequest(req)) return res.status(403).json({error:'CJ product search is available only on localhost in this build.'});
  if (!cjApiKey) return res.status(503).json({error:'CJ_API_KEY is missing from .env.'});

  const keyword = safeText(req.query.keyword || 'shirt', 120).trim() || 'shirt';
  const page = Math.min(Math.max(Number.parseInt(req.query.page, 10) || 1, 1), 1000);
  const size = Math.min(Math.max(Number.parseInt(req.query.size, 10) || 20, 1), 100);

  try {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
      keyWord: keyword
    });
    const payload = await cjRequest(`/product/listV2?${params.toString()}`, {method:'GET'});

    // CJ Product List V2 returns data.content as an array of result groups.
    // Each group contains its own productList array, so flatten all groups.
    const data = payload?.data || {};
    const content = Array.isArray(data?.content) ? data.content : [];
    const productList = content.flatMap((group) =>
      Array.isArray(group?.productList) ? group.productList : []
    );

    const products = productList.map((product) => ({
      id: safeText(product?.id || product?.pid || '', 220),
      name: safeText(product?.nameEn || product?.en || product?.productNameEn || '', 300),
      sku: safeText(product?.sku || product?.spu || '', 220),
      spu: safeText(product?.spu || product?.sku || '', 220),
      country_code: safeText(product?.countryCode || '', 20),
      disabled: Boolean(product?.disabled),
      image: safeText(product?.bigImage || product?.image || product?.productImage || product?.productImageSet?.[0] || '', 1000),
      sell_price: product?.sellPrice ?? product?.price ?? product?.productPrice ?? null
    }));

    return res.json({
      ok: true,
      message: 'AVERON fetched CJ products successfully.',
      keyword,
      page,
      size,
      count: products.length,
      total_records: Number(data?.totalRecords ?? 0),
      total_pages: Number(data?.totalPages ?? 0),
      products
    });
  } catch (err) {
    console.error('CJ product search failed:', err.message, err.cjCode || '');
    return res.status(502).json({
      ok: false,
      error: 'AVERON could not fetch CJ products.',
      detail: safeText(err.message, 240),
      code: err.cjCode ?? null
    });
  }
});


// Local-only CJ product detail + variants test. Read-only: no orders or payments are created.
app.get('/api/admin/cj/product', async (req, res) => {
  if (!isLocalRequest(req)) return res.status(403).json({error:'CJ product details are available only on localhost in this build.'});
  if (!cjApiKey) return res.status(503).json({error:'CJ_API_KEY is missing from .env.'});
  const pid = safeText(req.query.pid || '', 220).trim();
  if (!pid) return res.status(400).json({error:'Missing CJ product id (pid).'});

  try {
    const encodedPid = encodeURIComponent(pid);
    const [productPayload, variantsPayload] = await Promise.all([
      cjRequest(`/product/query?pid=${encodedPid}`, {method:'GET'}),
      cjRequest(`/product/variant/query?pid=${encodedPid}`, {method:'GET'})
    ]);
    const product = productPayload?.data || null;
    const rawVariants = variantsPayload?.data;
    const variants = Array.isArray(rawVariants)
      ? rawVariants
      : Array.isArray(rawVariants?.content)
        ? rawVariants.content
        : Array.isArray(rawVariants?.list)
          ? rawVariants.list
          : rawVariants ? [rawVariants] : [];

    return res.json({
      ok: true,
      message: 'AVERON fetched CJ product details and variants successfully.',
      pid,
      product,
      variant_count: variants.length,
      variants
    });
  } catch (err) {
    console.error('CJ product detail failed:', err.message, err.cjCode || '');
    return res.status(502).json({
      ok: false,
      error: 'AVERON could not fetch CJ product details.',
      detail: safeText(err.message, 240),
      code: err.cjCode ?? null
    });
  }
});


// Local-only CJ sandbox order creator. Safety invariant: isSandbox is hard-coded to 1
// on the server and cannot be overridden by browser input.
app.post('/api/admin/cj/sandbox-order', async (req, res) => {
  if (!isLocalRequest(req)) return res.status(403).json({error:'CJ sandbox orders are available only on localhost in this build.'});
  if (!cjApiKey) return res.status(503).json({error:'CJ_API_KEY is missing from .env.'});

  const vid = safeText(req.body?.vid || '', 80).trim();
  const sku = safeText(req.body?.sku || '', 80).trim();
  const quantity = Math.max(1, Math.min(10, Number.parseInt(req.body?.quantity, 10) || 1));
  const logisticName = safeText(req.body?.logisticName || 'CJPacket Ordinary', 50).trim();
  if (!vid && !sku) return res.status(400).json({error:'A CJ VID or SKU is required.'});
  if (!logisticName) return res.status(400).json({error:'A logistics name is required by CJ.'});

  const orderNumber = `AVERON-SBX-${Date.now()}`;
  const body = {
    orderNumber,
    shippingZip: 'SW1A 1AA',
    shippingCountryCode: 'GB',
    shippingCountry: 'United Kingdom',
    shippingProvince: 'England',
    shippingCity: 'London',
    shippingCustomerName: 'AVERON Sandbox Test',
    shippingAddress: '1 Sandbox Test Street',
    shippingPhone: '07000000000',
    email: 'sandbox@example.com',
    remark: 'AVERON API sandbox integration test - no real fulfilment',
    logisticName,
    fromCountryCode: 'CN',
    platform: 'Api',
    shopLogisticsType: 2,
    orderFlow: 1,
    isSandbox: 1,
    products: [{
      ...(vid ? {vid} : {}),
      ...(sku ? {sku} : {}),
      quantity,
      storeLineItemId: `AVERON-SBX-LINE-${Date.now()}`
    }]
  };

  try {
    const payload = await cjRequest('/shopping/order/createOrderV3', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const data = payload?.data || {};
    return res.json({
      ok: true,
      sandbox: true,
      message: 'CJ sandbox order created. No real charge, logistics or fulfilment is generated.',
      order_number: data.orderNumber || orderNumber,
      order_id: data.orderId || null,
      shipment_order_id: data.shipmentOrderId || null,
      order_status: data.orderStatus || null,
      order_amount: data.orderAmount ?? null,
      postage_amount: data.postageAmount ?? null,
      product_amount: data.productAmount ?? null,
      logistics_missing: data.logisticsMiss ?? null,
      intercept_reasons: Array.isArray(data.interceptOrderReasons) ? data.interceptOrderReasons : [],
      request_id: payload?.requestId || null,
      cj: data
    });
  } catch (err) {
    console.error('CJ sandbox order failed:', err.message, err.cjCode || '');
    return res.status(502).json({
      ok: false,
      sandbox: true,
      error: 'CJ did not create the sandbox order.',
      detail: safeText(err.message, 240),
      code: err.cjCode ?? null,
      hint: 'If CJ reports an invalid logistics method, enter a valid CJ logistics name for this product/destination and try again.'
    });
  }
});


// Local-only CJ sandbox order confirmation. CJ orders are created in CREATED status
// and must be confirmed before the sandbox payment simulator can move UNPAID -> PAID.
app.post('/api/admin/cj/sandbox/confirm-order', async (req, res) => {
  if (!isLocalRequest(req)) return res.status(403).json({error:'CJ sandbox controls are available only on localhost in this build.'});
  const orderId = safeText(req.body?.orderId, 120);
  if (!orderId) return res.status(400).json({error:'CJ sandbox orderId is required.'});
  try {
    const payload = await cjRequest('/shopping/order/confirmOrder', {
      method:'PATCH',
      body:JSON.stringify({orderId})
    });
    return res.json({ok:true,sandbox:true,message:'CJ sandbox order confirmed. It should now be UNPAID and ready for simulated payment.',order_id:orderId,request_id:payload?.requestId||null,cj:payload});
  } catch (err) {
    console.error('CJ sandbox confirm order failed:', err.message, err.cjCode || '');
    return res.status(502).json({ok:false,sandbox:true,error:'CJ could not confirm this sandbox order.',detail:safeText(err.message,240),code:err.cjCode??null});
  }
});

// Local-only CJ sandbox lifecycle controls. These routes accept only a CJ sandbox
// order id returned by the sandbox create-order route. They cannot create a real payment.
app.post('/api/admin/cj/sandbox/simulate-pay', async (req, res) => {
  if (!isLocalRequest(req)) return res.status(403).json({error:'CJ sandbox controls are available only on localhost in this build.'});
  if (!cjApiKey) return res.status(503).json({error:'CJ_API_KEY is missing from .env.'});
  const orderId = safeText(req.body?.orderId || '', 200).trim();
  if (!orderId) return res.status(400).json({error:'CJ sandbox orderId is required.'});
  try {
    const payload = await cjRequest('/shopping/sandbox/simulatePay', {
      method:'POST', body: JSON.stringify({orderId})
    });
    return res.json({ok:true,sandbox:true,message:'CJ sandbox payment simulated. No real balance was charged.',order_id:orderId,request_id:payload?.requestId||null,cj:payload});
  } catch (err) {
    console.error('CJ sandbox simulate pay failed:', err.message, err.cjCode || '');
    return res.status(502).json({ok:false,sandbox:true,error:'CJ could not simulate payment for this sandbox order.',detail:safeText(err.message,240),code:err.cjCode??null});
  }
});

app.post('/api/admin/cj/sandbox/update-status', async (req, res) => {
  if (!isLocalRequest(req)) return res.status(403).json({error:'CJ sandbox controls are available only on localhost in this build.'});
  if (!cjApiKey) return res.status(503).json({error:'CJ_API_KEY is missing from .env.'});
  const orderId = safeText(req.body?.orderId || '', 200).trim();
  const targetStatus = Number.parseInt(req.body?.targetStatus,10);
  if (!orderId) return res.status(400).json({error:'CJ sandbox orderId is required.'});
  if (![400,500,600,700].includes(targetStatus)) return res.status(400).json({error:'Sandbox targetStatus must be 400, 500, 600 or 700.'});
  try {
    const payload = await cjRequest('/shopping/sandbox/updateStatus', {method:'POST',body:JSON.stringify({orderId,targetStatus})});
    return res.json({ok:true,sandbox:true,message:`CJ sandbox status advanced to ${targetStatus}. No real fulfilment was triggered.`,order_id:orderId,target_status:targetStatus,request_id:payload?.requestId||null,cj:payload});
  } catch (err) {
    console.error('CJ sandbox update status failed:', err.message, err.cjCode || '');
    return res.status(502).json({ok:false,sandbox:true,error:'CJ could not update this sandbox order status.',detail:safeText(err.message,240),code:err.cjCode??null});
  }
});

app.post('/api/admin/cj/sandbox/update-track', async (req, res) => {
  if (!isLocalRequest(req)) return res.status(403).json({error:'CJ sandbox controls are available only on localhost in this build.'});
  if (!cjApiKey) return res.status(503).json({error:'CJ_API_KEY is missing from .env.'});
  const orderId = safeText(req.body?.orderId || '', 200).trim();
  const trackNumber = safeText(req.body?.trackNumber || '', 64).trim();
  if (!orderId || !trackNumber) return res.status(400).json({error:'CJ sandbox orderId and trackNumber are required.'});
  try {
    const payload = await cjRequest('/shopping/sandbox/updateTrackNumber', {method:'POST',body:JSON.stringify({orderId,trackNumber})});
    return res.json({ok:true,sandbox:true,message:'CJ sandbox tracking number updated. No real label or shipment was generated.',order_id:orderId,track_number:trackNumber,request_id:payload?.requestId||null,cj:payload});
  } catch (err) {
    console.error('CJ sandbox update track failed:', err.message, err.cjCode || '');
    return res.status(502).json({ok:false,sandbox:true,error:'CJ could not update the sandbox tracking number.',detail:safeText(err.message,240),code:err.cjCode??null});
  }
});



app.post('/api/admin/orders/:sessionId/cj-live-retry', async (req, res) => {
  const sessionId = safeText(req.params.sessionId,255);
  if (!String(sessionId).startsWith('cs_live_')) return res.status(400).json({error:'A Stripe live Checkout Session is required.'});
  if (!cjLiveAutomation) return res.status(409).json({error:'CJ_LIVE_AUTOMATION is disabled.'});
  const order = dbPrepare('SELECT session_id,cj_order_id FROM orders WHERE session_id=?').get(sessionId);
  if (!order) return res.status(404).json({error:'Order not found.'});
  if (order.cj_order_id) return res.status(409).json({error:'This order is already linked to a CJ order and will not be recreated.'});
  await syncStripeLiveOrderToCj(sessionId);
  const updated = rowToOrder(dbPrepare('SELECT * FROM orders WHERE session_id=?').get(sessionId));
  return res.json({ok:Boolean(updated?.cj_order_id),order:updated});
});

app.post('/api/admin/orders/:sessionId/cj-sandbox-retry', async (req, res) => {
  if (!isLocalRequest(req)) return res.status(403).json({error:'CJ sandbox retry is available only on localhost in this build.'});
  const sessionId = safeText(req.params.sessionId,255);
  const order = dbPrepare('SELECT session_id FROM orders WHERE session_id=?').get(sessionId);
  if (!order) return res.status(404).json({error:'Order not found.'});
  await syncStripeTestOrderToCjSandbox(sessionId);
  const updated = rowToOrder(dbPrepare('SELECT * FROM orders WHERE session_id=?').get(sessionId));
  return res.json({ok:updated?.cj_status==='paid_300',order:updated});
});

app.get('/api/admin/orders', (req, res) => {
  const rows = listOrdersStmt.all(100).map(rowToOrder);
  res.setHeader('Cache-Control','no-store');
  return res.json({orders: rows});
});

app.get(['/admin','/admin/','/admin.html'],requireAdminPage,(req,res)=>res.sendFile(path.join(__dirname,'admin.html')));
app.get('/admin-login.html',(req,res)=>{res.setHeader('Cache-Control','no-store');if(!adminConfigured()){clearAdminCookie(res);return res.sendFile(path.join(__dirname,'admin-login.html'));}if(getAdminSession(req))return res.redirect('/admin.html');return res.sendFile(path.join(__dirname,'admin-login.html'))});
app.use(express.static(path.join(__dirname), {
  etag: true,
  maxAge: '1h',
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (/\.(?:png|jpe?g|webp|svg|woff2?)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    else res.setHeader('Cache-Control', 'no-cache');
  }
}));


app.use(observability.errorMiddleware);


// Pre-warm CJ authentication/openId so the first signed CJ webhook can be verified quickly.
if (cjApiKey) {
  setImmediate(() => getCjWebhookOpenId().catch(err => console.warn('CJ webhook verifier prewarm failed:', err.message)));
}

app.listen(port, () => {
  console.log(`AVERON running at http://localhost:${port}`);
  console.log(`AVERON order database: ${dbPath}`);
  if (!stripe) console.warn('STRIPE_SECRET_KEY is missing. Checkout API is disabled.');
  if (!cjApiKey) console.warn('CJ_API_KEY is missing. CJ integration test is disabled.');
  if (!adminConfigured()) console.warn('AVERON admin login is NOT configured. Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH before publishing.');
});
