---
name: add-benefits-row
title: Add a benefits row to the product page
description: Add or fill the benefits block on the product template.
arguments:
  - name: product
    description: Product handle (for its benefit metafields)
    required: false
---
Add a benefits row to the product page.

1. `read_template` `templates/product.json` from the draft and find the `main` section and its blocks.
2. If the product has `blueprint.benefits` (`read_metafields` for {{product}}), the `product-benefits` block shows them automatically: just add the block after the price.
3. Otherwise, ask the merchant for 2–4 benefits (icon, short title) and set them on the block.
4. Work in a draft: use an existing Blueprint AI draft from `list_themes`, or `create_draft`. Every change is planned first: show the merchant the diff, and apply it (same tool, with the `change_token`) only after they agree. Use `apply_template_change` for the whole file (adding a block also means adding it to `block_order`).

Keep each benefit under six words. Never invent prices, savings, stock, viewer or sales counts, reviews, ratings or results. Prices come from the products (`read_products`).
