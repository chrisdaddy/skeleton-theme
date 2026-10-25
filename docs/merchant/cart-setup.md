# Setting up the cart

The cart drawer and cart page share one set of options: **Theme settings → Cart**. The theme shows what Shopify will charge. It never invents a discount. So every reward, gift and in-cart deal needs a matching discount in **Shopify admin → Discounts**.

## Cart type

- **Drawer** (the default) opens over the page when a shopper adds to cart or taps the cart icon.
- **Page** sends shoppers to the cart page instead.
- Shoppers without JavaScript always get the cart page.

## Rewards bar

You can set up to three rewards. Each has a label, a threshold and an optional gift product.

The bar measures the cart's merchandise value after line discounts. Gifts and shipping protection don't count.

| Reward | Create this discount |
|---|---|
| Free shipping at $50 | Free shipping, minimum purchase amount $50 |
| A free gift at $130 | Buy X Get Y: minimum purchase amount $130, customer gets the gift product at 100% off, limit 1 per order |

- **Unlocking:** a gift line is added automatically when the reward unlocks, and removed when the cart drops below the threshold.
- **Declining:** a shopper can remove a gift. It isn't added again in that visit, and a button offers it back.
- **No JavaScript:** the cart page shows the same button.
- **Other currencies:** add one line per currency under *Thresholds in other currencies*, for example `EUR: 45, 120, 180`. For a currency without a line, the bar is hidden. It never shows a converted guess.

## Bundle tier gifts

A bundle tier can include a gift (the product's `blueprint.tiers` metafield, *Gift variant*).

- **How it's added:** the gift goes in as its own line, linked to the bundle. Removing the bundle removes the gift.
- **Discount to create:** a Buy X Get Y discount that makes the gift free with that bundle variant.
- **One gift per bundle.** In Shopify, a product can qualify for only one Buy X Get Y discount. When a bundle's tier gift and a spend reward gift (for example "free shaker over $130") would both come from the same bundle, only one is free; the other is charged at its price, and the cart shows that price. Avoid offering both on the same bundle, or test the combination with a real cart before you go live.

## Shipping protection

1. Create a product, for example "Shipping protection" at $2.95.
2. Turn off *This is a physical product* and hide it from search engines.
3. Pick it in *Protection product*.

*Add it to carts by default* is **off** by default, and we recommend leaving it off. Pre-checked protection is the subject of a 2026 class action alleging hidden fees.

If you turn it on:
- it's added once per cart;
- it's always visible with its price;
- it's never re-added after a shopper removes it.

## "Goes well with"

- **Which product:** one product, from the first cart item's `blueprint.upsell` metafield, otherwise the first product in the fallback collection that isn't already in the cart.
- **Deal label:** to show an in-cart deal such as "$18 in cart", fill the upsell product's `blueprint.cart_deal_label`, turn on *Show the in-cart deal label*, and create the matching automatic discount.
- **If the discount is missing:** once the theme sees the deal didn't apply, it hides the label for the rest of the visit.

## Express checkout buttons

*Show express checkout buttons* adds Shop Pay, Apple Pay and others to the cart. They load extra scripts, so they're off by default.

Discount codes are entered at checkout. The cart has no code field.
