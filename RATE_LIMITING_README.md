# AVERON — Rate limiting and login protection

## What was added to this static build

`auth-guard.js` provides **client-side submission throttling** for any future form marked with `data-auth-form`.

Default UI policy:
- 5 attempts
- within a 15-minute window
- then a 15-minute browser-side lock

This is only a **defence-in-depth / UX layer**. It is intentionally not described as real security because JavaScript and localStorage can be modified or bypassed by the person making the request.

## Real production requirement

When AVERON gets a real customer login, rate limiting must be enforced by the backend or identity provider. The server should never rely on values from the browser.

Recommended production controls:

1. Rate-limit login attempts per **account identifier + IP/network signal**.
2. Use progressive delay/backoff rather than a permanent account lockout.
3. Return generic login errors so the endpoint does not reveal whether an email exists.
4. Store passwords only through a proven authentication provider or strong password hashing (never plaintext).
5. Add MFA/passkeys for administrators and optionally customers.
6. Use HTTPS only, Secure/HttpOnly/SameSite session cookies, CSRF protection, and session rotation after login.
7. Log suspicious authentication events without logging passwords or secrets.
8. Consider bot protection / CAPTCHA only after suspicious thresholds, not on every normal login.

## Example future HTML hook

```html
<form data-auth-form method="post" action="/api/login">
  <input type="email" name="email" autocomplete="username" required>
  <input type="password" name="password" autocomplete="current-password" required>
  <p data-auth-status aria-live="polite"></p>
  <button type="submit" data-auth-submit>Sign in</button>
</form>
```

The server endpoint `/api/login` must enforce the real limit. The browser helper only slows repeated submissions in that browser.

## Important distinction

Rate limiting helps reduce **credential stuffing and brute-force password guessing**. It does **not** by itself prevent password theft. Password theft is addressed with secure authentication design, HTTPS, XSS prevention, safe session handling, phishing resistance, MFA/passkeys, and keeping secrets out of frontend code.
