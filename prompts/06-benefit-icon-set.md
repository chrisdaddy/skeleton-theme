---
name: benefit-icon-set
title: Benefit icon set brief
description: A brief for a custom benefit icon set that matches the preset.
arguments:
  - name: benefits
    description: The benefits to illustrate
    required: false
---
Write a design brief for a custom set of benefit icons.

1. `get_current_preset` and `read_settings` for the preset, accent colour, corners and heading style.
2. List the benefits ({{benefits}}, or the product's `blueprint.benefits` from `read_metafields`).
3. For each icon: the concept, what to draw and what to avoid. Plus the shared rules: a 24 × 24 grid, the stroke weight matching the preset (Clinical 1.5 px rounded, Editorial 1 px, Bold 2 px), a single colour (the theme colours it), and an SVG with `currentColor`.
4. Deliverable: one SVG per icon, named like the benefit, ready to upload in Content → Files.

This prompt only writes a brief; it changes nothing in the store.
