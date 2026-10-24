# Product page

The product page's buy box is made of blocks you can reorder, hide or remove in the theme editor (**Product page → Product information**). The same blocks build the buy box in the **Featured product** section and in pre-landers' **Offer** section. [Sections](sections.md#product-page-blocks) lists them all.

## Bundle tiers ("Bundle & save")

Tiers come from one of two places:

1. **Product options (simplest):** an option named **Pack** (or the name you set in the product's `blueprint.pack_option` metafield) whose values are the tiers ("1 pouch", "2 pouches", "3 pouches"). Each variant's price is the tier price.
2. **Tier metaobjects (more control):** the product's **Offer tiers** metafield (`blueprint.tiers`) lists tier entries. Each entry has:
   - **Label** and **sublabel** ("2 pouches", "60 servings · free shipping").
   - **Pack option value:** the Pack value it selects. It works with any flavour or size.
   - **Fixed variant:** for a tier that is a different product, such as a discovery set or routine set.
   - **Badge** ("Most popular", "Best value") and **Preselected**.
   - **Gift variant** and **gift value label** ("$18 value"). The gift needs a Buy X Get Y discount; see [Cart](cart-setup.md#bundle-tier-gifts).
   - **Subscription plan hint:** part of the plan name to prefer, e.g. "3 months" for a 3-pack.
   - **Mix quantity** and **discount label**, for "pick any 3" packs backed by a quantity discount.

Every figure comes from the variant prices and the subscription plans:
- tier price, per-month and per-serving figures;
- the struck-through price;
- the saving percentage, which is always rounded down.

Set **Servings per unit** and **Days per unit** on the product for the per-serving and per-month lines.

Choose what savings are measured against in **Theme settings → Buy box**:
- the variant's **compare-at price**, or
- the **single-unit price** times the quantity.

Only use a compare-at price you have actually charged.

## Subscribe & save

- **Where the plans come from:** the toggle reads your product's selling plans, which are created by a subscription app such as Shopify Subscriptions.
- **What it shows:**
  - the real saving from the plan;
  - the plan's cancellation wording, or the block's default;
  - a frequency picker when there is more than one plan.
- **App widget:** if your subscription app has its own buy-box widget (an app block), use that *or* Blueprint's **Purchase options** block, not both. Hide or remove the other.

## Trust and proof blocks

- **Trust tiles**, **guarantee row** and **payment icons** show what you set.
- **Stock indicator:** appears only when Shopify tracks inventory and stock is at or below your threshold.
- **Viewer count:** appears only when an integration writes `blueprint.live_viewers`; nothing is ever simulated.
- **Sold today:** needs a Shopify Flow that writes `blueprint.sold_today` and its date. The line hides when the data is missing or more than a day old.

## Links that preselect a tier and plan

A product URL can open on a tier and plan, for ads and pre-landers:

```
/products/verde-daily?variant=<variant id>&selling_plan=<plan id>&tier=2&plan=sub
```

You rarely type these by hand: pre-lander buttons build them for you from the product, tier and plan you choose.

## Without JavaScript

The buy box is a real form. With JavaScript off, shoppers can still choose a tier and plan and add to cart.
