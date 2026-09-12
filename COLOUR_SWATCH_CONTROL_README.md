# AVERON storefront colour swatch control

The Content Studio now includes **Storefront colour swatches** in the Supplier connection area.

- Colours are detected automatically from CJ variant labels.
- Each detected colour gets its own colour picker and editable hex value.
- The selected colour changes only the visual circle shown on the product page.
- CJ PID, VID, SKU and fulfilment mappings are untouched.
- Multi-colour products receive one picker per detected CJ colour.
- If no CJ variants are loaded, the manual product Colour field is used as a fallback.

Values are persisted in `supplier.colourSwatches` and sanitised in both browser and server code.
