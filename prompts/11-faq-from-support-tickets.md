---
name: faq-from-support-tickets
title: FAQ from support tickets
description: Turn real support questions into the product FAQ.
arguments:
  - name: product
    description: Product handle
    required: true
  - name: tickets
    description: Pasted tickets or a summary of common questions
    required: true
---
Write the FAQ for **{{product}}** from these support questions:

{{tickets}}

1. Group the questions; keep the 5–8 most frequent. Phrase each as the customer would ask it.
2. Answer from the product data (`read_metafields`) and store policies only; if the answer isn't known, ask the merchant instead of guessing.
3. Put them on the page: in the draft, add or edit the `faq` section's question blocks in `templates/product.json` (`update_block_settings` per block, or `apply_template_change` for new blocks), or give the merchant the entries for `blueprint.faqs` if the product uses metafields.
4. Work in a draft: use an existing Blueprint AI draft from `list_themes`, or `create_draft`. Every change is planned first: show the merchant the diff, and apply it (same tool, with the `change_token`) only after they agree.
