'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const port = 46000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'averon-regression-'));
const dbPath = path.join(tmp, 'test.db');

function adminHash(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

let child;

async function waitForHealth(timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/healthz`);
      if (res.status === 200 || res.status === 503) return res;
    } catch (err) { lastErr = err; }
    await new Promise(r => setTimeout(r, 150));
  }
  throw lastErr || new Error('Server did not start in time.');
}

test.before(async () => {
  child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      AVERON_DB_PATH: dbPath,
      ADMIN_EMAIL: 'admin@example.test',
      ADMIN_PASSWORD_HASH: adminHash('RegressionTest!123'),
      ADMIN_SECURE_COOKIE: 'false',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      CJ_API_KEY: 'test-cj-api-key',
      CJ_OPEN_ID: 'averon-test-open-id'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitForHealth();
});

test.after(() => {
  if (child && !child.killed) child.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('health check returns structured service status and request ID', async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('x-request-id') || '', /^[0-9a-f-]{36}$/i);
  const body = await res.json();
  assert.equal(body.service, 'averon');
  assert.equal(body.checks.database.status, 'ok');
});

test('caller request ID is propagated when valid', async () => {
  const id = 'regression-request-1234';
  const res = await fetch(`${base}/healthz`, { headers: { 'x-request-id': id } });
  assert.equal(res.headers.get('x-request-id'), id);
});

test('admin APIs are protected without a session', async () => {
  const res = await fetch(`${base}/api/admin/orders`);
  assert.equal(res.status, 401);
});

test('sensitive backend files are not exposed by static hosting', async () => {
  for (const target of ['/.env', '/server.js', '/averon-orders.db']) {
    const res = await fetch(`${base}${target}`);
    assert.equal(res.status, 404, target);
  }
});

test('invalid admin login does not authenticate', async () => {
  const res = await fetch(`${base}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.test', password: 'wrong-password' })
  });
  assert.equal(res.status, 401);
});


test('public order status endpoint validates session IDs without exposing order data', async () => {
  const invalid = await fetch(`${base}/api/order-status?session_id=not-a-stripe-session`);
  assert.equal(invalid.status, 400);

  const missing = await fetch(`${base}/api/order-status?session_id=cs_test_1234567890abcdef`);
  assert.equal(missing.status, 404);
  const body = await missing.json();
  assert.equal(body.error, 'Order not found.');
});


test('customer auth reports unconfigured safely without exposing secrets', async () => {
  const res = await fetch(`${base}/api/auth/session`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.configured, false);
  assert.equal(body.authenticated, false);
  assert.equal('access_token' in body, false);
});

test('account orders require an authenticated customer', async () => {
  const res = await fetch(`${base}/api/account/orders`);
  assert.equal(res.status, 401);
});


test('CJ webhook rejects an invalid signature and accepts a correctly signed raw body', async () => {
  const payload = JSON.stringify({
    messageId: 'regression-cj-1',
    type: 'PRODUCT',
    messageType: 'UPDATE',
    params: { id: 'ignored-test-topic' }
  });

  const invalid = await fetch(`${base}/webhook/cj`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', sign: 'definitely-not-valid' },
    body: payload
  });
  assert.equal(invalid.status, 401);

  const sign = crypto.createHmac('sha256', Buffer.from('averon-test-open-id', 'utf8'))
    .update(Buffer.from(payload, 'utf8'))
    .digest('base64');
  const valid = await fetch(`${base}/webhook/cj`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', sign },
    body: payload
  });
  assert.equal(valid.status, 200);
  const body = await valid.json();
  assert.equal(body.result, true);
});


test('Stripe checkout is limited to the supported European market', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'server.js'), 'utf8');
  const expected = ['GB','DE','FR','NL','BE','CH','AT','SE','DK','NO','FI','IE','IT','ES','PT','LU','PL','CZ'];
  for (const code of expected) assert.match(source, new RegExp(`\\b${code}\\b`));
  assert.match(source, /allowed_countries:\s*allowedShippingCountries/);
  assert.doesNotMatch(source, /allowed_countries:\s*\['GB'\]/);
});

test('checkout requires a signed-in Supabase customer before Stripe session creation', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'server.js'), 'utf8');
  const route = source.slice(source.indexOf("app.post('/api/create-checkout-session'"), source.indexOf("app.get('/api/order-status'"));
  assert.match(route, /const authUser = await getCustomerAuth\(req,res\)/);
  assert.match(route, /if \(!authUser\) return res\.status\(401\)/);
  assert.match(route, /code:'AUTH_REQUIRED'/);
});

test('customer account UI includes Google sign-in and authenticated checkout guard', () => {
  const utility = fs.readFileSync(path.resolve(__dirname, '..', 'utilities.js'), 'utf8');
  const callback = fs.readFileSync(path.resolve(__dirname, '..', 'auth-callback.js'), 'utf8');
  const server = fs.readFileSync(path.resolve(__dirname, '..', 'server.js'), 'utf8');
  assert.match(utility, /Continue with Google/);
  assert.match(utility, /a\[href="checkout\.html"\]/);
  assert.match(server, /app\.get\('\/api\/auth\/google'/);
  assert.match(server, /app\.post\('\/api\/auth\/oauth\/session'/);
  assert.match(callback, /\/api\/auth\/oauth\/session/);
});
