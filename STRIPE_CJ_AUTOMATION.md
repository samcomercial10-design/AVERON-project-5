# AVERON — Stripe → CJ automatic supplier fulfilment

The backend now supports two separate flows:

1. **Stripe TEST → CJ SANDBOX**
   - Existing validation flow.
   - Creates a CJ sandbox order and simulates payment.
   - Never deducts real CJ balance.

2. **Stripe LIVE → CJ LIVE**
   - Opt-in production flow.
   - Triggered only after Stripe reports a paid Checkout Session through the verified Stripe webhook.
   - Maps each AVERON product/size to the CJ variant configured in Content Studio.
   - Creates the CJ order with the real Stripe delivery address.
   - Can optionally request payment using the **CJ account balance**.

## Important financial behavior

This integration does **not** transfer the customer's Stripe funds to CJ.

CJ's current OpenAPI supports `createOrderV2` with:

- `payType=3`: create order only, no supplier payment.
- `payType=2`: balance-payment flow; CJ attempts to deduct the supplier cost from your CJ account balance.

Therefore, automatic supplier payment still requires sufficient CJ balance.

## Production environment flags

Keep these OFF until you have verified every real product mapping:

```env
CJ_LIVE_AUTOMATION=false
CJ_AUTO_PAY_BALANCE=false
CJ_LIVE_LOGISTICS_DEFAULT=CJPacket Ordinary
CJ_FROM_COUNTRY_CODE=CN
```

Recommended activation order:

### Stage 1 — create real CJ orders but do not pay automatically

```env
CJ_LIVE_AUTOMATION=true
CJ_AUTO_PAY_BALANCE=false
```

Make one controlled Stripe live purchase. Confirm:
- the correct CJ product and VID;
- size / colour mapping;
- customer address;
- logistics;
- CJ price and shipping cost;
- no duplicate supplier order.

### Stage 2 — enable CJ balance auto-payment

Only after Stage 1 is correct:

```env
CJ_LIVE_AUTOMATION=true
CJ_AUTO_PAY_BALANCE=true
```

A paid Stripe live webhook will then call CJ `createOrderV2` with `payType=2`.

## Required product mapping

Each sellable AVERON product must have its real CJ supplier mapping saved in Content Studio. The backend refuses automatic fulfilment if the CJ PID/variant mapping is missing.

## Duplicate-order protection

The server stores the returned CJ order ID. Once an AVERON order has a CJ order ID, automatic retries do not create another supplier order.

For ambiguous CJ network failures where the request may have reached CJ but no response was received, check the CJ Orders dashboard before retrying.

## Admin retry

A protected endpoint is available for a failed Stripe-live order that does not yet have a CJ order ID:

`POST /api/admin/orders/:sessionId/cj-live-retry`

It refuses to recreate an order that is already linked to CJ.

## Stripe webhook

The existing verified `/webhook` endpoint remains the trigger. Test Checkout Sessions continue to the CJ sandbox flow; live Checkout Sessions use the new live flow only when `CJ_LIVE_AUTOMATION=true`.
