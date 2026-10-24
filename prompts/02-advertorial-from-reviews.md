---
name: advertorial-from-reviews
title: Advertorial from reviews
description: Write a first-person-story advertorial pre-lander grounded in real reviews.
arguments:
  - name: product
    description: Product handle
    required: true
  - name: persona
    description: Who the story is about
    required: false
  - name: suffix
    description: Template name suffix
    required: false
---
Write an advertorial pre-lander for **{{product}}** (story: {{persona}}).

1. `read_metafields` for the product's benefits, ingredients, studies and guarantee; `read_reviews` with `min_rating: 4`.
2. Find the story the reviews tell most often (the problem before, the moment it changed, what's different now). Write 4–6 short paragraphs in plain language. It's an ad: write it as a story the reviews support, not as a fake testimonial. No medical or income claims the product data doesn't support.
3. Pull quote: one sentence copied **word for word** from a review.
4. The eyebrow names the category and says "Sponsored" or "Advertisement". The page's disclosure stays on.
5. Work in a draft: use an existing Blueprint AI draft from `list_themes`, or `create_draft`. Every change is planned first: show the merchant the diff, and apply it (same tool, with the `change_token`) only after they agree.
6. `draft_advertorial_from_reviews` with template suffix "{{suffix}}".

Never invent prices, savings, stock, viewer or sales counts, reviews, ratings or results. Prices come from the products (`read_products`).
