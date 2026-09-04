# AVERON security deployment notes

This package is a hardened **static preview**, not a production commerce backend.

Implemented in this build:
- DOM/XSS hardening and strict catalogue sanitisation.
- No card number, expiry or CVC collection in static HTML.
- Personal profile data is session-only (not persistent localStorage).
- Product Studio is disabled on public hostnames; it works only on `file://`, `localhost`, or loopback.
- Content Security Policy and privacy-oriented browser restrictions.
- `_headers` template for hosts that support Netlify/Cloudflare-style static headers.
- Import validation, image type/size checks, catalogue limits and safe image sources.

Required before real customers/orders:
1. Serve the entire site only over HTTPS and enable HSTS at the hosting/CDN layer.
2. Replace the local Product Studio with server-side authentication (MFA recommended) and role-based access.
3. Store products/orders/customers in a server-side database. Never trust product prices sent by the browser; re-price every order server-side.
4. Use a PCI-compliant payment gateway (hosted checkout or provider Elements/Fields). Never let AVERON servers or localStorage store CVC/card numbers unless you intentionally take on PCI obligations.
5. Protect state-changing endpoints with authenticated sessions, Secure/HttpOnly/SameSite cookies, CSRF defences where applicable, rate limiting and server-side schema validation.
6. Keep AutoDS/API secrets only in server-side environment variables or a secrets manager. Never place secrets in HTML/JS.
7. Add logging/alerting, backups, dependency updates and a privacy/retention policy before launch.

The `_headers` file is only applied by compatible hosts. On other hosting providers, configure equivalent HTTP response headers in the server/CDN control panel.

## Authentication rate limiting

The static build includes `auth-guard.js` only as browser-side defence-in-depth. It is bypassable and MUST NOT be considered production rate limiting. A real login endpoint must enforce rate limits server-side or through the authentication provider. See `RATE_LIMITING_README.md`.
