const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const admin = fs.readFileSync('admin.js','utf8');
const server = fs.readFileSync('server.js','utf8');

test('mini banner save uses a dedicated server merge endpoint', () => {
  assert.match(admin, /fetch\('\/api\/admin\/site-content\/mini'/);
  assert.match(server, /app\.put\('\/api\/admin\/site-content\/mini'/);
  assert.match(server, /const current=readSiteContent\(\)\|\|snapshot/);
});

test('mini banner image limit matches client image safety limit', () => {
  assert.match(server, /if\(v\.length>4_500_000\)return '';/);
});

test('Shop the Edit product selection syncs across desktop and mobile', () => {
  assert.match(admin, /persistMiniServer\(currentMiniDevice,currentMini,savedEntry,supportsProducts\)/);
  assert.match(server, /syncProducts===true/);
  assert.match(server, /linkedProducts:\[\.\.\.\(entry\.linkedProducts\|\|\[\]\)\]/);
});
