# AVERON — Google sign-in with Supabase

The storefront now includes **Continue with Google** inside the AVERON account drawer. Email/password login continues to work normally.

## Supabase setup required

1. Open **Supabase → Authentication → Sign In / Providers → Google**.
2. Enable Google and add the Google OAuth Client ID and Client Secret created in Google Cloud.
3. In Google Cloud, use the callback URL shown by Supabase for the Google provider (normally your Supabase `/auth/v1/callback` URL).
4. In **Supabase → Authentication → URL Configuration → Redirect URLs**, allow the AVERON origins used for login, for example:
   - `http://localhost:4242/**` for local testing (or your actual local port)
   - `https://YOUR-RENDER-SERVICE.onrender.com/**` for staging
   - `https://YOUR-PRODUCTION-DOMAIN/**` before launch

The AVERON server starts the OAuth flow at `/api/auth/google`. After Google/Supabase returns the session, `auth-callback.html` transfers the valid Supabase session to secure HttpOnly cookies and sends the customer back to the requested page.

## Purchase requirement

Checkout now requires an authenticated AVERON customer. The storefront intercepts checkout links and opens the account drawer for signed-out visitors. The server also rejects checkout-session creation with HTTP 401 when no valid Supabase user is present, so the rule cannot be bypassed only by skipping the frontend.
