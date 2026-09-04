# AVERON + Stripe Checkout — test setup

This build adds a server-side Stripe Checkout integration while keeping Stripe secret keys out of the HTML/JS frontend.

## 1. Install Node.js and dependencies

From this project folder:

```bash
npm install
```

## 2. Create your local environment file

Copy `.env.example` to `.env` and use **test-mode** Stripe secrets first:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SITE_URL=http://localhost:4242
PORT=4242
```

Never put `sk_test_...`, `sk_live_...` or `whsec_...` in HTML, frontend JavaScript, Git, screenshots, or messages.

## 3. Start AVERON through the Node server

```bash
npm start
```

Open:

`http://localhost:4242`

Do not open `index.html` via `file://` when testing Stripe. The `/api/...` endpoints require the Node server.

## 4. Test the webhook locally

Install the Stripe CLI, sign in, then run:

```bash
stripe listen --forward-to localhost:4242/webhook
```

The CLI prints a temporary `whsec_...` webhook secret. Put that value in your local `.env`, then restart `npm start`.

## 5. Test checkout

Add a product to the AVERON bag, open `checkout.html`, and click **Proceed to secure payment**.

Stripe test card:

- Card: `4242 4242 4242 4242`
- Expiry: any future date
- CVC: any 3 digits
- Postcode: any valid test postcode

## Security design

- Browser sends only product id, quantity, size and colour.
- The browser does **not** decide the price sent to Stripe.
- `server.js` validates product ids against `products.server.json` and calculates GBP prices server-side.
- Stripe Checkout collects payment and shipping information.
- `/webhook` verifies Stripe signatures before treating events as authentic.
- The success page verifies the Checkout Session server-side before clearing the local cart.

## Important limitation of the current Content Studio

The Admin/Content Studio still stores catalogue edits in browser `localStorage`. Stripe pricing is intentionally based on the server-side `products.server.json`, because trusting browser-edited prices would be insecure.

Until the Content Studio gets a real backend/database, keep `products.server.json` synchronized with any real product name/price changes before accepting payments. A production CMS/backend should become the single source of truth for both the storefront and Stripe.

## Production checklist

Before going live:

1. Deploy this project to a host that runs Node.js and supports environment variables.
2. Set `SITE_URL` to the final HTTPS domain.
3. Set `STRIPE_SECRET_KEY` to the live secret only in the host's secret/environment settings.
4. In Stripe Dashboard, register `https://YOURDOMAIN/webhook` as a webhook/event destination.
5. Subscribe at minimum to `checkout.session.completed`, and handle delayed-payment events if you enable delayed methods.
6. Put the endpoint's live `whsec_...` in the host environment.
7. Add a database/order table and make fulfilment idempotent before automating supplier fulfilment.
8. Test the complete live-mode flow with a controlled real transaction only after test mode is fully verified.
