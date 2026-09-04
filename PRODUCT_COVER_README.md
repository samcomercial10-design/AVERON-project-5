# Product cover image

The Admin product editor now stores `coverImage` separately from the three product gallery images.

- `coverImage`: used on storefront product cards/listings only.
- `images[0..2]`: used on the product detail page gallery only.
- If no cover is uploaded, storefront cards fall back to the first gallery image for backward compatibility.

This keeps catalogue artwork independent from the PDP gallery.
