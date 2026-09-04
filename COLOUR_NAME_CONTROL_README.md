# Storefront colour names

The Admin now keeps two colour names:

- **CJ colour**: detected from the CJ variant label and kept unchanged for matching/fulfillment.
- **AVERON storefront name**: editable marketing name shown to customers on the product page.

Example: CJ `Blue` can be displayed as `Midnight Navy` while variants such as `Blue-M` continue to map correctly to CJ. The colour picker controls the swatch separately.

## Persistence fix

`displayName` is now preserved by both the browser-side product sanitizer and the server catalogue sanitizer, so custom storefront colour names remain after Save Product and reload.
