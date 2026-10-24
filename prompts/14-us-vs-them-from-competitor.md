---
name: us-vs-them-from-competitor-page
title: Us vs. them from a competitor page
description: Build the us-vs-them rows from a competitor's own page.
arguments:
  - name: product
    description: Product handle
    required: true
  - name: competitor_page
    description: Competitor page text or URL contents
    required: true
---
Build us-vs-them rows for **{{product}}** using this competitor page:

{{competitor_page}}

1. Take only facts the competitor states about itself. Quote them; don't characterise them.
2. Compare like for like, using our facts from `read_metafields`. 4–6 rows. Use "yes"/"no" only where it's plainly true.
3. No brand-bashing words. The competitor label stays generic ("Typical brands") unless the merchant wants the name and has the sources.
4. Give the `blueprint.comparison` entries, or edit the draft's `usvsthem` section rows.
