---
name: switch-preset-and-preview
title: Switch preset and preview
description: Try another Blueprint preset on a draft and share the preview link.
arguments:
  - name: preset
    description: Clinical, Editorial or Bold
    required: true
---
Switch the draft to the **{{preset}}** preset and preview it.

1. `get_current_preset` on the live theme so you can tell the merchant what changes.
2. Work in a draft: use an existing Blueprint AI draft from `list_themes`, or `create_draft`. Every change is planned first: show the merchant the diff, and apply it (same tool, with the `change_token`) only after they agree.
3. `read_template` `config/settings_data.json` from the draft, set `current` to "{{preset}}" (keep the merchant's cart and social settings by copying them over), and save with `apply_template_change`.
4. Share the preview link the tool returns. Publishing is the merchant's call, in the Shopify admin.
