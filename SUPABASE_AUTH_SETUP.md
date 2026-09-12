# AVERON — Supabase customer authentication

This build replaces the old session-only profile preview with real Supabase Auth while keeping the AVERON account drawer UI.

## What is already wired

- Email/password sign-up and sign-in through AVERON's own UI.
- HttpOnly AVERON session cookies; Supabase tokens are not stored in localStorage.
- Email-confirmation-safe sign-up flow.
- Profile metadata: first name, last name and preferred size.
- Stripe Checkout receives the signed-in Supabase user ID in Checkout Session metadata.
- Paid orders persist that user ID in the local SQLite `orders` table.
- `/api/account/orders` returns only the signed-in customer's linked orders.
- `orders.html` uses account orders when signed in, with the existing browser history as the guest fallback.

## Activate it

1. Create a Supabase project.
2. In Supabase Authentication, keep Email provider enabled. Decide whether email confirmation is required.
3. Set the project's Site URL to your real AVERON HTTPS origin before production. Add localhost as a development redirect URL if needed.
4. Copy the Project URL and publishable/anon key into `.env` as `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Never put the service-role/secret key in browser code.
5. Restart `node server.js`. Open the account drawer and create a test account.
6. Confirm the email if your Supabase project requires confirmation, then sign in.
7. Place a Stripe TEST order while signed in. After the Stripe webhook persists it, open Orders and verify it appears from `/api/account/orders`.

## Important production notes

- Use HTTPS. `CUSTOMER_SECURE_COOKIE` becomes secure automatically when `NODE_ENV=production` or `SITE_URL` starts with `https://`.
- The current AVERON order database remains SQLite. Supabase is handling customer identity, not replacing the order database in this build.
- Existing orders created before this integration have no Supabase user ID and cannot be automatically assigned to an account.
- The anon/publishable key is designed for public client use, but this build keeps it server-side anyway. Never use a Supabase service-role/secret key here unless a future server-only feature genuinely requires it.
- Configure Supabase email templates and sender branding before launch.
