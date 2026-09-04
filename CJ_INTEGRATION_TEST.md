# AVERON — CJ API connectivity test

This build adds a **local-only, read-only connectivity test** for the CJ Dropshipping API.
It does not create an order, simulate payment, change fulfilment, or spend CJ balance.

## 1. Keep the real key only in `.env`

```env
CJ_API_KEY=your_real_cj_api_key
```

Never put the real key in HTML/JavaScript sent to the browser, and never commit `.env`.

## 2. Start AVERON

```cmd
npm install
npm start
```

## 3. Run the test from the same PC

Open this address in the browser:

```text
http://localhost:4242/api/admin/cj/test
```

A successful response contains `ok: true` and `AVERON connected to CJ successfully.`
The endpoint deliberately does **not** return the CJ access token or API key.

## What the server does

1. Reads `CJ_API_KEY` from `.env`.
2. Calls CJ `POST /authentication/getAccessToken`.
3. Keeps the returned token only in server memory.
4. Calls CJ `GET /setting/get` to prove an authenticated API request works.
5. Returns only non-secret connection information to the local browser.

This is intentionally only the first connectivity test. Sandbox order creation should be implemented separately after product/variant mapping is defined.

## CJ webhook signature verification

Set `CJ_OPEN_ID` in `.env` to the `openId` returned by CJ's Get Access Token API. AVERON verifies the exact raw webhook body using HMAC-SHA256, Base64-encodes the digest, and compares it in constant time with CJ's `sign` header.

If `CJ_OPEN_ID` is not set, AVERON can fall back to the `openId` returned by CJ authentication/settings. Setting it explicitly is recommended because webhook verification then does not depend on a live CJ API call. Never expose `CJ_OPEN_ID` in HTML or browser JavaScript.
