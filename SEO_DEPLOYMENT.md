# AVERON — SEO & Google launch checklist

This build is prepared for SEO, but production-domain tasks cannot be completed before a real domain is known.

## Before indexing
1. Replace `{{BASE_URL}}` in `sitemap.xml.template` with the final HTTPS origin, save the result as `sitemap.xml`, and add `Sitemap: https://YOUR-DOMAIN/sitemap.xml` to `robots.txt`.
2. After the final domain is known, replace JavaScript-generated canonical URLs with static absolute canonical tags if your deployment pipeline supports it.
3. Connect Google Search Console, verify the domain, submit the sitemap and inspect representative URLs.
4. Run PageSpeed Insights/Lighthouse on the deployed HTTPS site. Field Core Web Vitals cannot be measured accurately from local HTML alone.
5. Replace placeholder campaign frames with optimized AVIF/WebP/JPEG product images. Keep meaningful alt text, fixed width/height or aspect ratio, and avoid oversized files.
6. Keep checkout and admin pages `noindex`. Do not block checkout in robots.txt if you rely on the meta noindex directive.
7. When the catalogue becomes backend-driven, generate one crawlable canonical URL per real product server-side and render its title, description, Product/Offer JSON-LD and breadcrumb data in the initial HTML.
8. Do not publish fabricated reviews or ratings. Add review structured data only after real, visible customer review data exists.

## Included in this build
- Unique crawlable category pages
- Semantic headings and breadcrumbs
- Dynamic canonical/Open Graph/Twitter metadata
- Organization, WebSite, CollectionPage, Product/Offer and Breadcrumb JSON-LD
- `index,follow` on public content; `noindex` on checkout/admin
- Mobile-first touch targets and skip links
- Better image loading hints and intrinsic dimensions
- Font preconnect + `display=swap`
- Sitemap template and robots guidance
