---
name: subscription-explainer-copy
title: Subscription explainer copy
description: Copy for the subscription explainer that matches the real selling plans.
arguments:
  - name: product
    description: Product handle
    required: true
---
Write the subscription explainer for **{{product}}**.

1. `read_products` and `read_metafields` for the product and its plans. The saving is the selling plan's own: keep the `[percent]` token in the heading so the theme fills it in.
2. Three tiles: how it works, what you can change (skip, pause, swap, cancel, as the subscription app allows), and when you're charged.
3. Plain words; no "cancel anytime" unless the subscription app really allows it.
4. Work in a draft: use an existing Blueprint AI draft from `list_themes`, or `create_draft`. Every change is planned first: show the merchant the diff, and apply it (same tool, with the `change_token`) only after they agree. Edit the draft's `subscription` section with `update_block_settings`.
