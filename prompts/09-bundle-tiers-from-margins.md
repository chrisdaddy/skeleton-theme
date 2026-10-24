---
name: bundle-tiers-from-margins
title: Bundle tiers from margins
description: Recommend bundle tiers and prices from unit costs and target margins.
arguments:
  - name: product
    description: Product handle
    required: true
  - name: unit_cost
    description: Landed cost per unit
    required: true
  - name: target_margin
    description: Target gross margin, e.g. 70%
    required: true
---
Recommend bundle tiers for **{{product}}** (unit cost {{unit_cost}}, target margin {{target_margin}}).

1. `read_products` for the current variant prices and `read_metafields` for the current tiers.
2. Propose 3 tiers (e.g. 1, 2 and 3 units). For each: the price, the margin, the saving against buying singles (rounded down to a whole percent), and the per-month or per-serving figure.
3. Keep the "Most popular" tier the one with the best balance of saving and margin; explain why.
4. Prices live on the variants. Tell the merchant which variants to create or reprice in the Shopify admin (Products), and which tier metaobjects to update. This kit doesn't change prices.

Show all maths in cents and round savings down.
