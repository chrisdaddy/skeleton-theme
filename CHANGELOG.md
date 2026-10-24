# Changelog

All notable changes to Blueprint are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

**1.x is additive only.** Updates never remove or rename settings, sections or blocks, never lower block limits, and never tighten ranges. Any change to stored JSON ships a migration that the updater applies for you.

## [1.0.0] - Unreleased

### Added
- **Presets:**
  - Clinical, Editorial and Bold, in light and dark, with contrast-safe derived colours (text at least 4.5:1, borders at least 3:1).
  - Quick style settings for accent, background, headings and corners.
- **Product page:**
  - Buy box built from 36 theme blocks: offer tiers (pack, size and mix modes), subscribe and save, variant pickers, gifts, trust tiles, sticky add to cart and more.
  - Prices, per-unit figures and savings always come from variants and selling plans, with savings rounded down.
- **Cart:**
  - Drawer and cart page with rewards progress, tier and reward gifts, shipping protection and an upsell.
  - Works without JavaScript.
- **Sections:** 42 merchant-addable sections, among them hero, clinical results, ingredients, us vs. them, reviews, FAQ, guarantee, before/after, quiz, bundle builder and countdown (fixed end time by default).
- **Pre-landers:**
  - Advertorial, listicle and comparison templates on a landing layout with its own header and footer.
  - Disclosure on by default; `noindex, follow` by default with a per-page override.
  - The offer section and a sticky call to action.
  - Deep links that preselect the tier and plan, and carry UTM and click IDs forward.
- **Collection page:** filter pills, a filter form, sorting and active-filter chips. Works without JavaScript.
- **Listing templates** for each preset, built from the reference demo stores.
- **AI kit** (`@blueprint/mcp`): edits draft copies of the theme from Claude and other MCP clients, with 22 prompts.
- **Updater** (`blueprint update`): installs a new version as an unpublished theme and carries over your settings, templates and translations.
