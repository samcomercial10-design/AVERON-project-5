# AVERON — Stripe TEST → CJ SANDBOX bridge

This validation build automatically links a **Stripe test payment** to a **CJ sandbox order**.

## Safety gates
- CJ order creation is hard-coded with `isSandbox: 1`.
- Only Stripe Checkout Session IDs beginning with `cs_test_` are eligible. `cs_live_` is blocked.
- The bridge creates, confirms and **simulates payment** of the CJ sandbox order. It does not create real CJ fulfilment or deduct real CJ balance.
- Only mapped AVERON items can be sent. Unmapped items set the CJ state to `error` instead of creating a partial supplier order.

## Current test mapping
For this proof-of-concept, AVERON product `p3` (Cotton Oxford Shirt) is intentionally mapped to the CJ sandbox product previously tested: Men's Heavy Corduroy Shirt Long Sleeve Shirt, Black. Sizes S through XXXL use the VIDs verified during the CJ API test. **This is a test mapping, not a production catalogue mapping.**

Use only `p3` during the first Stripe→CJ test.

## Local webhook requirement
Stripe cannot call `localhost` directly. For local validation keep a Stripe CLI listener running:

```
stripe listen --forward-to localhost:4242/webhook
```

For local CLI forwarding, `STRIPE_WEBHOOK_SECRET` in `.env` must be the `whsec_...` printed by that `stripe listen` process. A Dashboard webhook endpoint has a different signing secret.

## Test flow
1. Start AVERON with `npm start`.
2. Start Stripe CLI forwarding in a second CMD.
3. Add only Cotton Oxford Shirt (`p3`), preferably size M, to the AVERON bag.
4. Checkout with Stripe in test mode and use Stripe test payment details.
5. After Stripe confirms payment, the webhook persists the AVERON order and queues the CJ sandbox bridge.
6. The bridge creates a CJ sandbox order, confirms it, and calls sandbox `simulatePay`.
7. Open Content Studio → Orders and refresh. The order should show `CJ Sandbox: paid`.

If CJ returns an error, the AVERON order remains recorded and the error is shown in Orders. `Retry CJ Sandbox` is available locally.

## Before production
Do not switch `isSandbox` off in this build. Production fulfilment needs a real product/variant mapping, durable job queue, authentication, inventory checks, shipping-method selection, idempotent reconciliation, cancellation handling, and a deliberate supplier-payment policy.


## Temporary p2 sandbox mapping
For the current integration test, AVERON product `p2` (Tailored Wool Trouser) is mapped to the already-validated CJ sandbox test shirt. This mapping exists only to prove the Stripe Test -> AVERON -> CJ Sandbox automation and must be replaced with the real CJ trouser product/VIDs before production. Waist sizes are temporarily mapped as 28→S, 30→M, 32→L, 34→XL, 36→XXL, 38→XXXL.
