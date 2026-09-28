# CJ Sandbox controls in AVERON Admin (Render)

Implemented for test orders only.

## Admin > Orders
For a Stripe TEST order linked to CJ Sandbox:
- `paid_300` shows **Simulate Processing**.
- `processing_400` shows **Simulate Dispatched**.
- `shipped_500` shows the generated TEST tracking number.

## Safety
The server rejects the operation unless all of these are true:
- the administrator is authenticated;
- the Stripe session starts with `cs_test_`;
- the database marks the order as `cj_sandbox = 1`;
- the order already has a CJ order ID.

Live orders cannot use this route.

## Dispatched simulation
The server advances CJ Sandbox to status 500, assigns an `AVERON-TEST-...` tracking number, and updates the local AVERON order to `shipped_500` / `shipped` so My Orders can reflect the result immediately.

The existing CJ webhook remains active and can continue synchronizing later CJ updates.
