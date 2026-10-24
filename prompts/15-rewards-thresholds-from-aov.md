---
name: rewards-thresholds-from-aov
title: Rewards thresholds from AOV
description: Set the cart rewards thresholds from the store's average order value.
arguments:
  - name: aov
    description: Average order value
    required: true
  - name: margin
    description: Gross margin
    required: false
---
Set the cart rewards thresholds from an average order value of {{aov}}.

1. `read_settings` for the current `cart_reward_*` settings.
2. Propose 3 thresholds: free shipping just above the AOV (about +15–25%), then two gift tiers. Price each gift at cost against the margin ({{margin}}).
3. Every reward needs a real automatic discount in Shopify (free shipping, or a buy-X-get-Y gift) with the same threshold. List the discounts to create in Discounts.
4. Work in a draft: use an existing Blueprint AI draft from `list_themes`, or `create_draft`. Every change is planned first: show the merchant the diff, and apply it (same tool, with the `change_token`) only after they agree. Update the `cart_reward_*` settings in `config/settings_data.json` with `apply_template_change`.
