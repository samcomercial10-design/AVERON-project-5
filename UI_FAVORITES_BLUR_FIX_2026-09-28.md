# AVERON — Favorites + focus layer fix

- Product detail wishlist button now re-syncs after the asynchronous product renderer replaces its static product ID.
- A product favorited in New In / collection pages is therefore shown as favorited immediately on product.html.
- Removing/adding it on the PDP continues to use the same `averon_wishlist` localStorage state and header count.
- Utility/cart overlay now applies a subtle 3.5px backdrop blur with the existing navy dim layer and a soft transition.
- Mobile blur is reduced to 2.5px for performance.
- Root storefront files and `/public` copies were both updated.
