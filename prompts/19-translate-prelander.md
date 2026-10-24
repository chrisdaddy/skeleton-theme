---
name: translate-prelander
title: Translate a pre-lander
description: Translate a pre-lander template's copy into another language.
arguments:
  - name: template
    description: Template file, e.g. templates/page.advertorial.json
    required: true
  - name: language
    description: Target language
    required: true
---
Translate **{{template}}** into {{language}}.

1. `read_template` the file from the draft (or live).
2. Translate visible text settings only (headings, text, labels, quotes). Keep IDs, handles, URLs, product references, numbers and `[count]` and `[percent]` tokens unchanged.
3. Review quotes: keep the original and add the translation after it in brackets, marked as a translation. Never put translated words in a customer's mouth as their own.
4. Work in a draft: use an existing Blueprint AI draft from `list_themes`, or `create_draft`. Every change is planned first: show the merchant the diff, and apply it (same tool, with the `change_token`) only after they agree. Save it as a separate template (e.g. `-{{language}}` suffix) with `apply_template_change`. Shopify Translate & Adapt can then handle the storefront locale.
