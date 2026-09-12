# AVERON — Orders Validation Build

This build adds the next validation layer to the existing Stripe Checkout flow.

## What changed

- Successful Stripe Checkout sessions are persisted in `averon-orders.db` using Node's built-in SQLite support.
- The webhook remains the authoritative server-to-server payment signal.
- Order writes are idempotent: the same Stripe Checkout Session updates the same database record instead of creating duplicates.
- The Content Studio now includes an **Orders** tab on localhost.
- The Orders tab displays order reference, payment status, date, customer email/name, items and total.
- Card numbers, CVCs and full payment credentials are never stored by AVERON.
- The public site cannot download the database file.
- `/api/admin/orders` is localhost-only in this validation build. Do not expose it publicly as an admin solution.

## Test flow

1. Keep your existing `.env` with `STRIPE_SECRET_KEY=sk_test_...` and `STRIPE_WEBHOOK_SECRET=whsec_...`.
2. Run `npm install` after extracting a new version of the project.
3. Run `npm start`.
4. In another terminal run `stripe listen --forward-to localhost:4242/webhook`.
5. Complete a Stripe test purchase, or use `stripe trigger checkout.session.completed`.
6. Open `http://localhost:4242/admin.html` and select **Orders**.
7. Paid sessions should appear after the webhook is received.

## Important production note

SQLite is appropriate for local validation and a small single-server deployment. Before a real multi-instance production launch, migrate order storage to a managed database such as PostgreSQL and replace the localhost-only Content Studio with real server-side authentication.

The Content Studio product catalogue still uses browser localStorage while the checkout server validates prices from `products.server.json`. The next catalogue milestone is to move products into the same backend/database so Admin, storefront and Stripe share one source of truth.
