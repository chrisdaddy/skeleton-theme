---
name: mothers-day-advertorial
title: Mother's Day advertorial
description: A seasonal gifting advertorial with a fixed end date, from real reviews.
arguments:
  - name: product
    description: Product handle
    required: true
  - name: end_date
    description: When the offer or gifting window ends (YYYY-MM-DD)
    required: true
---
Create a Mother's Day gifting advertorial for **{{product}}**.

1. `read_reviews` and look for reviews that mention gifts, mothers or family. Quote one word for word as the pull quote; if none fit, use the strongest review that does.
2. Write the story as a gift guide: who it's for, why it's a good gift, what arrives in the box (from the product data), and the delivery cut-off before {{end_date}}.
3. Urgency must be real: mention {{end_date}} only as a fixed date. Don't add countdowns that reset, and don't say "only a few left".
4. Work in a draft: use an existing Blueprint AI draft from `list_themes`, or `create_draft`. Every change is planned first: show the merchant the diff, and apply it (same tool, with the `change_token`) only after they agree.
5. `draft_advertorial_from_reviews` with template suffix "mothers-day".

Never invent prices, savings, stock, viewer or sales counts, reviews, ratings or results. Prices come from the products (`read_products`).
