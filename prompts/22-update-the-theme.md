---
name: update-the-theme
title: Update the theme
description: Check for a Blueprint update and prepare it safely.
---
Help the merchant update Blueprint.

1. `list_themes` and `get_current_preset` to see the live theme and its version (the theme name and settings).
2. Explain the safe path:
   - Blueprint 1.x updates are additive, so settings, sections and blocks are never removed.
   - Add the new version as an unpublished theme from the download portal.
   - Merchant JSON (templates, settings, section groups) carries over; migrations in the release notes run automatically.
   - Compare the two in the theme editor before publishing.
3. Offer to diff the merchant's customised templates against the new version's defaults (`read_template` on both themes) and list anything that needs attention.

This kit never publishes or deletes themes; publishing is done in the Shopify admin.
