# AVERON refinement pass

This package is the consolidated working project after the cleanup pass.

## Cleaned
- Removed `node_modules/` from the distributable. Run `npm install` after extracting.
- Checkpointed SQLite and removed transient `averon-orders.db-wal` / `averon-orders.db-shm` files from the package.
- Expanded `.gitignore` so secrets, runtime database files, logs and dependencies are not committed accidentally.
- Hardened static-file exposure: backend source, observability code, password-hash utility, tests, scripts, package metadata, server catalogue, CJ sandbox mapping, environment files and database artifacts return 404 through the web server.
- `cj-products.html` remains available for local CJ sandbox work but returns 404 when `NODE_ENV=production`.

## Intentionally kept
- `averon-orders.db`: contains the current local order state. It is runtime data and is ignored by Git.
- CJ sandbox/testing code: still needed while the CJ lifecycle integration is being validated.
- Security/auth/observability layers: all are active and are not cosmetic-only code.
- Existing design/CSS and the approved Shipped UI were left unchanged.

## Known architecture item before production
The Content Studio catalogue still uses browser storage while checkout pricing is validated from `products.server.json`. A future production pass should move catalogue/banner management to a server-side database/API so Admin, storefront and checkout use one source of truth.

## Verify after extracting
1. Copy your real `.env` into the project (never publish it).
2. Run `npm install`.
3. Run `npm test`.
4. Run `npm start`.
5. Check `/healthz`, Admin login, storefront, checkout test flow and CJ sandbox flow before production deployment.
