---
name: move-most-popular-badge
title: Move the "Most popular" badge
description: Move the Most popular badge and preselection to another tier.
arguments:
  - name: product
    description: Product handle
    required: true
  - name: tier
    description: Tier label to badge, e.g. "3 pouches"
    required: true
---
Move the "Most popular" badge on **{{product}}** to **{{tier}}**.

1. `read_metafields` for the product's `blueprint.tiers`.
2. Tiers are metaobjects (Content → Metaobjects → Blueprint: offer tier). Tell the merchant exactly which entries to edit: clear the badge and preselected flag on the current one, then set badge "Most popular" and preselected on {{tier}}.
3. Only call a tier "Most popular" if it really sells the most. Ask the merchant to confirm from their sales report.

This kit doesn't edit metaobject entries; it gives the exact steps.
