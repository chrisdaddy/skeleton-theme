---
name: ingredients-table-from-label
title: Ingredients table from a label
description: Turn a supplement-facts label into the ingredients table.
arguments:
  - name: product
    description: Product handle
    required: true
  - name: label
    description: The label text or a photo transcription
    required: true
---
Build the ingredients table for **{{product}}** from this label:

{{label}}

1. Transcribe each line exactly: name, dose and unit. Don't round or convert units.
2. Add a short "why" only where the brand has a source; otherwise leave it blank.
3. Output the rows for `blueprint.ingredients` (name, dose, why) and say where to enter them (Content → Metaobjects → Blueprint: ingredient), or add `row` blocks to the draft's `ingredients` section.
4. Flag any line you couldn't read instead of guessing.
