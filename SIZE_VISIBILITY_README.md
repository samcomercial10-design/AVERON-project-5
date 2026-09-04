# AVERON storefront size visibility

The Admin product editor now includes a checkbox beside each AVERON variant mapping row.

- Checked: the size is shown on the product page and can be fulfilled through its mapped CJ variant.
- Unchecked: the CJ variant remains visible in Admin for reference, but the size is hidden from customers and excluded from the server fulfillment map.
- Existing mappings default to checked so previous products remain compatible.

The CJ label parser also recognises sizes such as 2XL, 3XL, 4XL, 5XL and 6XL. This prevents labels such as `Blue-5XL` from being mistaken for separate colours.
