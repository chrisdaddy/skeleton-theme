---
name: make-editorial-warmer
title: Make Editorial warmer
description: Warm up the Editorial preset's colours while keeping contrast.
---
Make the Editorial look warmer.

1. `read_settings` from the draft (or the live theme to start).
2. Propose new values for `light_bg`, `light_surface`, `light_ink`, `light_line` and `accent_color`: warmer creams and browns, no pure greys. Show before and after.
3. Text needs 4.5:1 contrast on the background and surface, and borders 3:1. Check the ratios and say what they are. The theme derives button and muted text itself; leave those settings blank.
4. Work in a draft: use an existing Blueprint AI draft from `list_themes`, or `create_draft`. Every change is planned first: show the merchant the diff, and apply it (same tool, with the `change_token`) only after they agree. Change `config/settings_data.json` with `apply_template_change` (edit `current` only).
