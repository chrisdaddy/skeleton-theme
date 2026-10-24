---
name: listicle-from-reviews
title: Listicle from top reviews
description: Build a listicle pre-lander for a product from its best real reviews.
arguments:
  - name: product
    description: Product handle
    required: true
  - name: angle
    description: The angle or audience, e.g. "busy parents"
    required: false
  - name: suffix
    description: Template name suffix, e.g. spring
    required: false
---
Build a listicle pre-lander for **{{product}}** as a new page template. Angle or audience: {{angle}}.

1. `read_metafields` and `read_products` (query `handle:{{product}}`) for what the product is, its tiers and prices.
2. `read_reviews` for {{product}} with `min_rating: 4`. Pick 5–7 reasons people buy it, each backed by a review.
3. Write each item: a short title (a reason, not a slogan), two or three sentences, and a quote copied **word for word** from one review. Keep the reviewer's words; trim only at sentence boundaries.
4. Headline: start with `[count]` (e.g. "[count] reasons…") so the number always matches the items.
5. Work in a draft: use an existing Blueprint AI draft from `list_themes`, or `create_draft`. Every change is planned first: show the merchant the diff, and apply it (same tool, with the `change_token`) only after they agree.
6. `draft_listicle_from_reviews` with template suffix "{{suffix}}". If a quote is rejected, pick a different review rather than rewording it.

Never invent prices, savings, stock, viewer or sales counts, reviews, ratings or results. Prices come from the products (`read_products`). Claims must be ones the brand can back (label, study, guarantee in the product data).
