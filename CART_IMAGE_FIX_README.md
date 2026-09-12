AVERON cart image fix

- Cart items now store and render a product image.
- Preferred source: product cover image; fallback: first gallery image.
- Existing cart entries without an image are hydrated from the current catalogue at render time.
- New items persist the image in averon_cart.
