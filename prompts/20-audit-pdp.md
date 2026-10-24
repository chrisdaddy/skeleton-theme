---
name: audit-pdp-against-buy-box-rules
title: Audit the PDP against the buy-box rules
description: Check the product page against Blueprint's conversion and honesty rules.
arguments:
  - name: product
    description: Product handle
    required: true
---
Audit the product page for **{{product}}** against these buy-box rules:

1. A single-unit price is shown with the tiers, never one price alone.
2. Each tier shows quantity, per-month (multi-month), total, per-serving, struck compare-at and saving.
3. The preselected tier is the "Most popular" one.
4. The subscribe row states the real saving and the real cancel terms.
5. The selected tier is unmistakable.
6. Gift tiers show the gift and its real value.
7. The saving is never the biggest text.
8. Trust items sit under the button.
9. No fake urgency, stock, viewer or sales counts.
10. Reviews and ratings come from a review app.

Use `read_template` `templates/product.json` (live), `read_metafields` and `read_products`. For each rule: pass, fail or n/a, with the evidence. Then list fixes in priority order. Offer to make the template fixes in a draft (only those; prices and metaobjects are changed by the merchant).
