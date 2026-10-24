# Blueprint Theme Agent Guide

Blueprint is a premium Online Store 2.0 Shopify theme for DTC physical-product brands. It is sold direct, and is built so that a Theme Store listing stays possible later.

This file holds the conventions that aren't obvious from a single file. The plan of record is `docs/PLAN.md`. The research behind it is `docs/RESEARCH.md`. The brief is `docs/brief/`.

## Non-negotiables

- **Original code only.** Never copy code from Dawn, Horizon, Skeleton or any other Shopify theme.
  - Their licenses only allow derived themes to be distributed through the Theme Store (Horizon allows no distribution at all).
  - The Theme Store also rejects themes derived from Dawn or Horizon.
  - You may read those themes to learn platform behaviour. Write every line yourself.
- **Online Store 2.0.**
  - Every template is JSON, except `templates/gift_card.liquid`.
  - Header and footer live in section groups. Pre-landers use `layout/landing.liquid` with their own groups.
  - Every merchant-addable section has `presets`.
  - Do not use `enabled_on` or `disabled_on` on section groups.
- **Blocks:**
  - Buy-box parts are theme blocks in `blocks/`, reused by `main-product`, `featured-product` and `offer`.
  - Repeating content items (FAQ questions, study stats, ingredient rows) are section-local blocks.
  - Every product surface accepts `@app`.
- **No Liquid-embedded assets.** Do not use `{% stylesheet %}`, `{% javascript %}` or inline `<style>` in sections. CSS and JS live in `assets/`, which is flat with no subfolders.
  - Load component CSS with `stylesheet_tag` in the section or block that needs it.
  - The one exception is inline token CSS from `snippets/tokens.liquid`.
- **No build step.**
  - Ship readable ES modules and CSS. Shopify minifies them.
  - No jQuery, no frameworks. Use web components.
- **Translated UI only.**
  - Storefront strings use `{{ 'key' | t }}` from `locales/en.default.json`.
  - Schema labels use `t:` keys from `locales/en.default.schema.json`.
  - Defaults come from the reference copy in `data/demo-content.json`.
- **Storefront URLs come from `routes.*`.** Never hardcode `/cart`, `/search` or `/collections`. In JS, use `window.Shopify.routes.root`.
- **Money comes only from variants and selling-plan allocations.**
  - Never store prices in settings or metafields.
  - Per-unit and savings math works in cents.
  - Savings percentages round down.
  - Totals print Shopify's own cart fields.
- **Honest data.**
  - Never fabricate urgency, stock, viewer counts, sales counts, reviews or comments in code or defaults.
  - A block without real data renders nothing.
  - Countdown timers default to a fixed end time.
- **Progressive enhancement.**
  - Add to cart works with JS disabled: a real `<form>` posting `id`, `quantity` and `selling_plan`.
  - Cart links are real links.
  - Drawers and modals use `<dialog>`.
- **Accessibility.**
  - Text contrast at least 4.5:1, and 3:1 for UI boundaries, in every preset and both modes. `tools/contrast-check.mjs` enforces this in CI.
  - Visible focus on every interactive element.
  - Touch targets at least 24×24 px.
  - Respect `prefers-reduced-motion` for marquees, counters, sliders and reveals.
- **Performance budget** (PDP, mobile, compressed; `docs/PLAN.md` §11):
  - Initial theme JS ≤ 20 KB.
  - CSS ≤ 30 KB.
  - At most 3 render-blocking requests.
  - The LCP image uses `fetchpriority="high"` with `preload: true` and correct `sizes`.
  - Below-the-fold and interactive features load their JS on visibility or interaction.
- **Whitespace.** Put whitespace between an HTML tag name and a following Liquid delimiter: `<li {% … %}`, not `<li{% … %}`.
- **Theme Check.**
  - `.theme-check.yml` stays `extends: theme-check:recommended` with **zero overrides**.
  - Fix offenses in the Liquid.

## Update safety (1.x is additive only)

- **Never rename or remove** a setting, section or block ID, or change a setting's type, once it has been released. Deprecate instead: keep it and hide it with `visible_if`.
- **Never lower** `max_blocks` or a section `limit`, and never tighten a range.
- **Migrations:** any change to merchant JSON ships a declarative migration in `migrations/`.

## Repository map

```
layout/ config/ sections/ blocks/ snippets/ templates/ locales/ assets/   theme (repo root)
listings/<preset>/templates/   per-preset template content (Clinical, Editorial, Bold)
data/demo-content.json         demo stores, presets and copy extracted from the reference
reference/                     the reference demo (visual and behavioural target)
tools/                         node scripts: checks, demo seeding, release, updater (tools/update/)
tests/                         node:test unit tests (offline) and Playwright suites (dev store)
docs/                          plan, research, brief, merchant docs
mcp/ prompts/                  AI kit (Phase 7)
migrations/                    declarative migrations of merchant JSON (migrations/README.md)
portal/                        Blueprint Portal: licence keys and downloads (Cloudflare Worker)
release/<version>/             committed release manifests (update-safety baseline)
```

Non-theme folders are listed in `.shopifyignore`.

## Checks to run before every commit

```sh
npm test                 # unit tests + contrast check (offline)
shopify theme check      # must report no offenses
```
