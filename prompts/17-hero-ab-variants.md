---
name: hero-ab-variants
title: Hero A/B variants
description: Draft alternative hero headlines and set one up in a draft.
arguments:
  - name: goal
    description: What the hero should get across
    required: false
---
Draft three alternative home-page heroes. What the hero should get across: {{goal}}.

1. `read_template` `templates/index.json` (live) to see the current hero.
2. Write three variants (eyebrow, heading under 8 words, one-sentence subheading, button label), each with a different angle: outcome, proof, or identity.
3. Ask the merchant which to try. Work in a draft: use an existing Blueprint AI draft from `list_themes`, or `create_draft`. Every change is planned first: show the merchant the diff, and apply it (same tool, with the `change_token`) only after they agree.
4. Put the chosen one in the draft with `update_block_settings` on the hero section, and share the preview link. They can run the test with their A/B app by comparing the draft and the live theme.

Never invent prices, savings, stock, viewer or sales counts, reviews, ratings or results. Prices come from the products (`read_products`). Proof claims need a source in the product data.
