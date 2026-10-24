---
name: comparison-vs-competitor
title: Comparison page vs a competitor
description: A fair comparison-table pre-lander against a named competitor.
arguments:
  - name: product
    description: Product handle
    required: true
  - name: competitor
    description: Competitor name
    required: true
  - name: sources
    description: Where the competitor facts come from (URLs, label photos)
    required: true
---
Build a comparison page: **{{product}}** vs **{{competitor}}**.

1. `read_metafields` for our facts (ingredients, doses, certifications, guarantee) and `read_products` for prices.
2. Use only competitor facts from: {{sources}}. If a fact isn't in the sources, leave it out. No disparaging language; compare like for like (per serving, per month).
3. 5–8 rows; mark "yes"/"no" only where it's clearly true, otherwise short text.
4. Work in a draft: use an existing Blueprint AI draft from `list_themes`, or `create_draft`. Every change is planned first: show the merchant the diff, and apply it (same tool, with the `change_token`) only after they agree.
5. `read_template` `templates/page.comparison.json` from the draft, adapt it (comparison-table rows, heading), and save it as a new file with `apply_template_change` (e.g. `templates/page.comparison-{{competitor}}.json`, lowercase, hyphens).

Never invent prices, savings, stock, viewer or sales counts, reviews, ratings or results. Prices come from the products (`read_products`). List the sources in your reply so the merchant can keep them on file.
