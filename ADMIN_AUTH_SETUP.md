# AVERON Content Studio authentication

1. In the project folder run:

`npm run admin:hash -- "YOUR-LONG-UNIQUE-PASSWORD"`

2. Copy the resulting `scrypt$...` value into `.env` together with your email:

```env
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD_HASH=scrypt$...
ADMIN_SESSION_HOURS=12
```

For production HTTPS hosting use:

```env
NODE_ENV=production
ADMIN_SECURE_COOKIE=true
SITE_URL=https://your-domain.com
```

3. Restart `npm start`, then open `/admin` or `/admin.html`. Unauthenticated visitors are redirected to the sign-in page.

The server uses an HttpOnly, SameSite=Strict session cookie, stores only a SHA-256 hash of the random session token, and temporarily blocks an IP after 5 failed login attempts.

IMPORTANT: authentication is now server-side, but the current product/banner editor still stores catalogue/content changes in browser localStorage. Before production, migrate those edits to a server-side database so changes are global for all visitors. Orders are already server-side.
