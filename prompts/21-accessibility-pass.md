---
name: accessibility-pass-on-custom-copy
title: Accessibility pass on custom copy
description: Check custom copy and settings for accessibility problems.
arguments:
  - name: template
    description: Template file to check
    required: false
---
Run an accessibility pass on {{template}} (default: the home and product templates).

1. `read_template` the file(s), and `read_settings` for colours.
2. Check:
   - one h1 per page, and heading levels that don't skip (`heading_tag` settings);
   - link and button text that makes sense on its own ("Shop the serum", not "Click here");
   - alt text for images that carry meaning;
   - no text baked into images;
   - colour contrast of any custom colours (4.5:1 for text, 3:1 for borders);
   - motion: marquee, autoplay and counters should respect reduced motion (the theme does this; flag only custom HTML).
3. List the problems with fixes. Work in a draft: use an existing Blueprint AI draft from `list_themes`, or `create_draft`. Every change is planned first: show the merchant the diff, and apply it (same tool, with the `change_token`) only after they agree.
