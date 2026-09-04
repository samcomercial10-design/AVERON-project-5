# AVERON — Production readiness notes

This build keeps the approved desktop/mobile visual design intact while reducing avoidable client-side work and preparing the static assets for efficient hosting.

## Already optimised in this build
- Static site footprint remains very small (HTML/CSS/JS and brand assets only).
- Off-screen desktop sections use `content-visibility` to reduce initial rendering work without changing layout.
- Reduced-motion users receive a lightweight animation mode.
- Static brand images include decoding/loading hints and explicit dimensions where useful.
- Product and Content Studio image uploads are resized/compressed before local storage.
- The `_headers` file contains short cache rules for CSS/JS, longer caching for assets, and no-cache for HTML on hosts that support this format.
- Mini banners and hero/editorial banners use a single content source for desktop and mobile, avoiding duplicate page assets.

## Hosting recommendations
Use HTTPS and enable Brotli or Gzip at the host/CDN. Most modern hosts (Cloudflare Pages, Netlify, Vercel, nginx/CDN providers) do this automatically. Do not disable compression.

For production imagery, prefer WebP or AVIF. Hero images should normally be roughly 1600–2200 px wide; mini banners generally do not need to exceed 1200–1600 px on their longest edge. Avoid uploading full-resolution Photoshop exports directly to production storage.

## Important architecture note
The current Content Studio is intentionally local-only. Its images/content are stored in the browser's localStorage, which does **not** consume your web server's RAM or disk. When a real backend is introduced, store media in object storage/CDN (for example an S3-compatible bucket) and keep only URLs/metadata in the database. This prevents application-server memory from being used as image storage.

## Before launch
1. Connect the Content Studio to a server-side authenticated admin/backend.
2. Store customer/product/order data in a real database.
3. Put uploaded media behind object storage + CDN.
4. Use a PCI-compliant payment provider rather than collecting card data directly.
5. Test the deployed URL with PageSpeed Insights/Core Web Vitals and tune real production images based on those results.
