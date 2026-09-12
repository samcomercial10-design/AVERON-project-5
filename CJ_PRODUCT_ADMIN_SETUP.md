# AVERON ↔ CJ product mapping

1. Open Admin → Products.
2. Paste the CJ Product ID (PID) and click **Fetch from CJ**.
3. Under **AVERON variant mapping**, confirm the customer-facing option (for example `S`, `M`, `L`, `XL`) and choose the exact CJ variant for each option.
4. Click **Save Product**.

Saving now persists the supplier mapping both in the browser catalogue and in the server-side `products.server.json` / `cj-sandbox-map.json` files used by Stripe → CJ sandbox fulfilment.

The storefront product page automatically replaces its default size buttons with the mapped AVERON options. CJ VID/SKU values remain private and are never shown to customers.

This build keeps the existing safety gate: Stripe → CJ automation uses CJ Sandbox only for `cs_test_...` Stripe sessions.
