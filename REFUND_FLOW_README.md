# AVERON refund flow — validation build

This build adds Stripe-backed refund logic to the existing order database.

## Customer flow

- The customer selects **Request refund** from their saved order.
- The browser asks for confirmation before sending anything.
- If the order is marked **Not shipped**, the backend sends a full refund request to Stripe immediately.
- When Stripe reports the refund as succeeded, the order is marked **Refunded** and its fulfilment state becomes **Cancelled**.
- If the order is already marked **Shipped**, no automatic refund is sent. The order becomes **Refund requested** and waits for review in Content Studio → Orders.

## Admin flow

Content Studio → Orders now shows fulfilment and refund state for every order.

- **Mark Shipped / Mark Not Shipped** changes the local fulfilment state.
- **Approve Refund** appears only when a shipped order has a pending refund request.
- Approving sends the refund to Stripe through the server. The Stripe secret key never goes to the browser.

## Important before production

The fulfilment state is manual in this validation build. Do **not** enable automatic refunds in production until `fulfillment_status` is synchronised with the real fulfilment/shipping provider. Otherwise an order that has physically shipped but was not marked as shipped in AVERON could still be automatically refunded.

Admin refund actions remain localhost-only in this build. Add real server-side admin authentication before publishing the Content Studio.
