# RESEARCH: Blueprint Theme

Step 0 research for the Blueprint Theme brief (`docs/brief/START_HERE.md`, `docs/brief/SPEC.md`), done on 2026-10-23.

Parts 1–5 below cite their sources inline. "(unverified)" marks claims that could not be checked against a primary source.

## How this was researched

- **Shopify docs.** shopify.dev was read through Shopify's docs search tool, because direct page fetches were blocked by this environment's proxy. Some third-party sites (vendor help centers, Trustpilot, MCP and OpenAI docs) were also unreachable. Claims from those sites rest on search-result extracts and are marked "(unverified)" or "(vendor)".
- **Source code, read locally:**
  - Dawn 16.0.0 at commit `0522253` (2026-10-22)
  - Horizon 4.3.0 at commit `dfad90d` (2026-10-13)
  - This repo, Skeleton rc-v2, at commit `a7a655e`
- **Reference demo.** The demo's data and logic were extracted into `data/demo-content.json`.
- **Re-checked by hand.** Three load-bearing facts were checked directly before being relied on:
  1. The `LICENSE.md` files of Dawn, Horizon and Skeleton.
  2. The Theme Store requirement that new themes must not be built on Dawn or Horizon.
  3. The `seo.hidden` metafield and the JSON template `layout` attribute.

## Executive summary: what changes the brief

### 1. The brief says build on Dawn; that is not viable

- **Dawn's license** (`LICENSE.md`, read locally) grants modify and sell rights only "to develop themes that integrate or interoperate with Shopify software or services, and, if applicable, to distribute, offer for sale or otherwise make available any such themes **via the Shopify Theme Store**. All other uses of the Software are strictly prohibited." Selling a Dawn-derived theme for $149 on Lemon Squeezy, Gumroad or Payhip falls outside that grant.
- **Skeleton's license** is the same.
- **Horizon's license** forbids distributing derived themes on any channel.
- **Theme Store §2** ([requirements](https://shopify.dev/docs/storefronts/themes/store/requirements)), verified verbatim: *"Shopify's Skeleton Theme is the only approved codebase for Theme Store development. Otherwise, themes must be built with fully original code. New theme submissions built on or derived from Dawn or Horizon are not eligible."*
- **So a Dawn fork can't legally be sold off the Theme Store, and can't be listed on it either.** The only base that keeps both channels open is **fully original code**. Dawn and Horizon can be read for patterns, but must not be copied. See Part 1 §4 and Part 5 §0. Legal review is still recommended before launch.

### 2. This repo's current architecture can't deliver the brief either

- **What this repo is.** It is Skeleton rc-v2, built on the "Liquid July '26" **developer preview** tags `{% block %}` and `{% partial %}`.
- **Developer preview limits:**
  - It runs only on preview dev stores.
  - Shopify says the tags "can change before general availability".
  - Shopify's own guidance puts merchant-arranged layouts in JSON templates with `content_for`, not `{% block %}`.
- **Gaps against the brief.** rc-v2 has none of the following, all of which the brief depends on and the Theme Store requires (§5):
  - JSON templates
  - sections, section groups, and `@app` blocks
  - merchant add and reorder
  - updates that preserve `settings_data.json` and JSON templates
- **The recommended architecture** is standard Online Store 2.0: JSON templates, sections, header and footer groups, and theme blocks. This repo's `AGENTS.md` forbids that, so the rules must change (Part 1 §3).

### 3. Prices must live in variants, not settings

- **Each tier is a real variant** (a "Pack" option) with its own price and compare-at price.
- **Subscriptions** come from one native percentage selling plan attached to all pack variants.
- **The no-JS form** posts `id` + `selling_plan`.
- **Deep links** `?variant=&selling_plan=` preselect the tier and plan server-side.
- **Result:** buy box, cart and checkout all print Shopify's own numbers, so the "math must reconcile" rule is satisfied by construction (Part 2).

### 4. Several "no app needed" promises have a native dependency

- **Selling plans exist only through a subscription app.** Shopify Subscriptions is free and first-party.
- **Gifts and in-cart deal prices** need automatic discounts that the merchant configures in admin.
- **Shopify Bundles and Cart Transform bundles** can't be bought with a selling plan.
- **Functions ship only in apps**, and a custom app with Functions needs Plus.

The theme is native-first, but the copy must say "works with the free Shopify Subscriptions app", not "no app" (Part 2).

### 5. The cart drawer must speak Shopify's 2026 standard events and actions

- **Standard Actions and Events** launched 2026-06-17:
  - Apps and on-page AI agents call `Shopify.actions.updateCart` and `openCart`.
  - On a theme the platform doesn't recognise, the default `updateCart` **reloads the page**.
  - The drawer therefore registers its own handlers above `content_for_header`.
- **Request and dialog limits:**
  - At most 5 sections per Section Rendering API request.
  - Use a native `<dialog>` with `showModal()`.
  - A single mutation queue avoids race conditions (Part 3).

### 6. Performance: "better than Dawn" is real but modest; "94" is conditional

- **Dawn 16's PDP, measured from source:** ~38 KB of gzipped JS in ~21 files and ~44 KB of CSS in ~27 files.
- **Proposed budget:** ≤ 20 KB of initial theme JS.
- **Lead over Dawn:** Shopify's platform scripts are identical for both themes, so expect roughly +2 to +6 points (estimate).
- **"94 mobile Lighthouse"** holds only on an app-free demo store, as a median of several runs. Real paid-social stores score 40–55 whatever the theme (Part 4).

### 7. AI kit and updater

- **MCP server:** a local stdio server (npm and a Claude Desktop `.mcpb`).
- **Auth:** the merchant's own Dev Dashboard app. Merchants can no longer create custom apps in admin as of 2026-01-01.
- **Writes:** only to a duplicated theme (`themeDuplicate`, API 2025-10+). The server enforces the theme's role, an operation allowlist, `diff_draft` change tokens, and a file allowlist.
- **Must verify on a real paid store:** whether `write_themes` needs an exemption for a merchant-owned app.
- **ChatGPT** needs a remote HTTPS server and plan-gated write mode, so it is out of v1.
- **Updater:** a hosted multi-store "updater app" is public distribution, which means App Store review. v1 should be a local `blueprint update` CLI, and the sales copy should say "updater tool" (Part 5).

### 8. Theme Store (if pursued)

- **Distribution:** exclusive to the Theme Store; price $100–$500.
- **Presets:** at most 5, each with its own demo store. Demo stores may run no apps except free reviews or translation apps, which affects the subscription demo.
- **Banned:** fake timers, stock counts and viewer counts.
- **Quality floor:** Lighthouse averages of 60 for performance and 90 for accessibility.
- **Updates:** at least 4 weeks apart.
- **Fonts:** only from the Shopify font library. DM Sans and Instrument Serif are both in it. Instrument Serif has regular and italic only, so there is no real bold heading.

## Where the research parts disagreed, and how the plan resolves it

| Topic | Disagreement | Resolution in PLAN.md |
|---|---|---|
| Fonts | Part 4 says self-host subset woff2. Part 1 says the Theme Store allows only `font_picker` fonts. | Use the Shopify font library (`font_picker` with `font_display: swap` and one preload). This keeps Theme Store eligibility. Self-hosting is a possible later optimisation for a direct-only build. |
| Base / channel | Part 4 says sell direct. Part 1 says build from Skeleton for the Theme Store. | Write **fully original code**, which is legal for either channel. The channel is an open question for the owner (PLAN §0). |
| `seo.hidden` for noindex | Part 3 proposes it as primary. | It adds `noindex` **and** `nofollow`, which is verified. The plan keeps it, and adds a theme-controlled `noindex, follow` option so CTA links aren't nofollowed. |
| Cart bundle discount line | SPEC §6 orders the cart as subtotal, bundle discount, total. | In variant mode there is no Shopify discount to subtract, so a subtraction row would not add up. The plan uses a "You save $X" note in variant mode and a real discount row in discount mode (PLAN §7). |

## Facts measured locally (not from the web)

| | Dawn 16.0.0 | Horizon 4.3.0 | Skeleton rc-v2 (this repo) |
|---|---|---|---|
| Sections / theme blocks / snippets | 48 / 0 / 39 | 42 / 95 / 144 | 0 / 5 / 3 |
| `assets/*.js` raw / gzip | 224 KB / 47 KB | 767 KB / 180 KB | — |
| Templates | JSON (except gift card) | JSON (except gift card) | Liquid only |
| Theme Check | 0 errors, 11 warnings | not run | 0 offenses |
| License allows off-store sale of derivatives | No | No (no sale on any channel) | No |

The brief's own preset colors also fail its contrast rule. This was computed from `data/demo-content.json`; the PLAN §3 table has the fixes.
- **Editorial:** accent text 4.40:1.
- **GOODBOY:** white-on-orange button 3.27:1.
- **DREAMR:** violet text 3.42:1.
- **Muted text:** the demo's opacity-faded secondary text fails in 9 of 13 presets.

---

## Part 1: Dawn, Horizon, Skeleton, Theme Store rules and theme editor UX

Researched 2026-10-23. Sources:
- shopify.dev pages, read through the Shopify docs search tool. Direct fetches of shopify.dev were blocked by this session's proxy.
- Shallow clones of `Shopify/dawn`, `Shopify/horizon` and `Shopify/skeleton-theme`, read at the commits named below.
- A small number of web search results.

"(unverified)" marks a claim I could not confirm from a primary source.

---

### 1. Dawn internals (current version 16.0.0)

#### Version and changelog

Facts from [Shopify/dawn](https://github.com/Shopify/dawn):
- **Current version:** `theme_version` is `16.0.0` ([settings_schema.json](https://github.com/Shopify/dawn/blob/main/config/settings_schema.json)).
- **Latest commit:** `0522253`, dated 2026-10-22: "Fix cart icon and drawer refresh after Standard Actions updates (#4004)". It touches only `cart.js` and `standard-actions-override.js`.
- **Release notes:** `release-notes.md` holds only the latest version. I rebuilt the history below from the per-release commits.

| Version | Commit / date | Headline changes |
|---|---|---|
| 15.1.0 | `177a0cc`, 2024-09-12 | Release (portable wallet CSS, svg-wrapper follow-ups) |
| 15.2.0 | `a55d1f7`, 2024-10-04 | Release |
| 15.3.0 | `54102dd`, 2025-03-07 | Quick order list paginates variants; settings labels reworded; `variants_count` replaces `product.variants.size` |
| 15.4.0 | `5cd1a85`, 2025-07-21 | Nested cart lines (add-ons); ARIA label on quantity; above-the-fold images in Featured collection no longer lazy-loaded |
| 15.4.1 | `7482e90`/`9ccdacf`, 2025-12-04 | Bug fixes; cart performance measurement |
| **15.5.0** | `83d5e6b`, 2026-06-19 | **Standard storefront events & actions.** `theme.liquid` imports `cdn.shopify.com/storefront/standard-events.js` as a module, defines `collection-component`/`product-component` view-event elements, dispatches `PageViewEvent`, and loads the new `standard-actions-override.js`. Also adds a **product disclosures** section and block (`sections/disclosures.liquid`, `snippets/product-disclosures.liquid`, `snippets/cart-disclosure-indicator.liquid`, `cart-disclosure-modal.js`, `cart-disclosure-tooltip.js`). Changes `body` from grid to flex to reduce CLS. Large refactors of `main-product.liquid` and `card-product.liquid`. |
| **16.0.0** | `258f00f`, 2026-08-10 | **Breaking change:** removes the legacy customer account templates and sections (`templates/customers/*.json` and the `main-login`, `main-account` and `main-order` sections). Stores must be on new customer accounts first. The header account icon now opens Shopify's customer-account popover. Adds a "Customer accounts" theme setting. 75 files, about −3,300 lines. |

Notes on the 15 → 16 changes:
- **Standard events and actions** launched on [2026-06-17](https://shopify.dev/changelog/posts/standard-storefront-events-and-actions).
  - Themes dispatch `shopify:*` DOM events.
  - Apps and agents call `Shopify.actions.updateCart`, `getCart` and `openCart`.
  - By default these actions "hit the Storefront API and reload the page". Themes override them so the UI updates without a reload.
- Dawn's override (`standard-actions-override.js`) does the following:
  - It walks `cart-drawer`, `cart-items`, `cart-drawer-items` and `cart-notification` and calls each element's `getSectionsToRender()`.
  - It re-renders the affected sections and publishes Dawn's `cart-update` pubsub event.
  - It skips the sections Dawn's own subscribers already refresh.
  - See [Standard events and actions](https://shopify.dev/docs/storefronts/themes/best-practices/standard-events-and-actions).

#### File structure (16.0.0)

- **Sections and snippets:** 48 sections and 39 snippets.
- **No `blocks/` folder.** Dawn has zero theme blocks, and every block is section-local.
- **JSON templates:** every template is JSON (`404`, `article`, `blog`, `cart`, `collection`, `index`, `list-collections`, `page`, `page.contact`, `password`, `product`, `search`) except `gift_card.liquid`.
- **Section groups:** `header-group.json` and `footer-group.json`.
- **Product page blocks:** `main-product.liquid` declares these section-local block types: `@app`, `text`, `title`, `price`, `sku`, `inventory`, `quantity_selector`, `variant_picker`, `buy_buttons`, `description`, `share`, `custom_liquid`, `disclosures`, `collapsible_tab`, `popup`, `rating`, `complementary` and `icon-with-text`. These are flat, cannot nest and cannot be reused in other sections.
- **Theme styles:** `settings_data.json` has `"current": "Dawn"` and a single preset, `"Dawn"`, so it ships one theme style.
- **Color schemes:**
  - `settings_schema.json` declares a `color_scheme_group` called `color_schemes`.
  - Each scheme has `background`, `background_gradient`, `text`, `button`, `button_label`, `secondary_button_label` and `shadow`, plus a `role` map.
  - Dawn ships 5 schemes.
  - The pattern is documented under [color_scheme_group](https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings).

#### How the JavaScript is wired (classic Section Rendering API)

- **Product form** (`product-form.js`): POSTs `FormData` to `routes.cart_add_url`. It appends `sections` (taken from the cart drawer or notification `getSectionsToRender()`) and `sections_url`. This is "bundled section rendering": the add-to-cart response already contains re-rendered cart HTML. It then `publish(PUB_SUB_EVENTS.cartUpdate)`.
- **Cart drawer and cart notification** (`cart-drawer.js`, `cart-notification.js`): `renderContents(parsedState)` loops over `getSectionsToRender()` and swaps each section's HTML from the response.
- **Cart page** (`cart.js`, `CartItems`): subscribes to `cart-update` and re-fetches its own sections.
- **Variant picker** (`product-info.js`):
  - On `optionValueSelectionChange`, it builds `?section_id=<id>&option_values=…` (or fetches the full page when the product changes, as with combined listings).
  - It uses an `AbortController` and swaps media, price, buy buttons and so on from the response.
- **Predictive search:** fetches `routes.predictive_search_url?q=…&section_id=predictive-search`.
- **Quick add** (`quick-add.js`): fetches the product URL and extracts the product info into a modal. `quick-add-bulk.js` and `quick-order-list.js` cover B2B and bulk ordering.
- **Shared code:** `pubsub.js` and `constants.js` provide the event bus. Patterns are documented in [Use the Section Rendering API](https://shopify.dev/docs/storefronts/themes/best-practices/performance/use-section-rendering-api).

#### Weight and slow spots

- **Total JavaScript:** `assets/*.js` is about 224 KB raw / 47 KB gzip.
- **Largest files:** `global.js` 47.5 KB raw (about 11 KB gzip), `quick-order-list.js` 18 KB, `product-info.js` 17 KB, `facets.js` 17 KB, `cart.js` 17 KB. `base.css` is 81 KB raw / 13.5 KB gzip.
- **Scripts on every page:** `theme.liquid` always loads 9 deferred scripts: constants, pubsub, global, both cart-disclosure files, details-disclosure, details-modal, search-form and standard-actions-override. On top of that it loads the standard-events module and, depending on settings, animations, localization, predictive-search and cart-drawer.
- **Community advice:** the usual Dawn tuning targets are third-party app scripts, oversized LCP images and reveal-on-scroll animations, more than Dawn's own JS. That is community advice, not Shopify data (unverified): [community checklist](https://community.shopify.com/t/dawn-theme-page-speed-optimization-checklist/156193), [LCP thread](https://community.shopify.com/t/reducing-lcp-on-mobile-dawn-theme/332780/1).
- **Shopify's guidance:** lazy-build hidden DOM such as drawers ([lazy DOM rendering](https://shopify.dev/docs/storefronts/themes/best-practices/performance/lazy-dom-rendering)) and use Section Rendering instead of client-side templates.

---

### 2. Horizon-era changes (theme blocks)

- **Launch:** Horizon launched in the Summer '25 Edition as Shopify's first theme fully built on theme blocks, with about 10 presets sharing one codebase ([Codrops](https://tympanus.net/codrops/2025/05/21/shopify-summer-25-edition-introduces-horizon-a-new-standard-for-creative-control/), [Shopifreaks](https://www.shopifreaks.com/shopify-releases-summer-25-edition-horizon/)).
- **Theme blocks are generally available.** The "Flex sections" preview closed on 2025-07-14, when "theme blocks are now available to all theme developers". Style settings were dropped ([changelog](https://shopify.dev/changelog/posts/sunsetting-flex-sections-developer-preview)).

#### Horizon today

Facts from [Shopify/horizon](https://github.com/Shopify/horizon), commit `dfad90d`, 2026-10-13:
- **Version:** `theme_version` `4.3.0`.
- **Files:** 42 sections and **95 theme blocks**. Underscore-prefixed files such as `_product-card.liquid` are private blocks.
- **Templates:** JSON everywhere except `gift_card.liquid`.
- **Block targeting:** 29 `@theme` and 31 `@app` targets across sections and blocks.
- **Generic sections:** a generic `section.liquid` that accepts `@theme` and `@app`, and a `_blocks.liquid` wrapper.
- **JavaScript:** about 767 KB raw / 181 KB gzip across 81 files, loaded as ES modules through an import map and `modulepreload` (`snippets/scripts.liquid`). Per-page payload not measured (unverified).
- **No color schemes:** Horizon 4.3.0 has **no `color_scheme_group`**. It uses the new single [`color_palette`](https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings) setting: 2–20 named colors, referenced as `{{ settings.colors.key }}` defaults.

#### Theme blocks vs Dawn's section blocks

From [Blocks](https://shopify.dev/docs/storefronts/themes/architecture/blocks), [Block schema](https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks/schema) and [Static blocks](https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks/static-blocks):
- **Where they live:** theme blocks are files in `blocks/`, reusable across sections, and can nest **up to 8 levels deep** (excluding the section).
- **Section blocks:** these are "only in the section they're defined within", single-level, and "can not currently be used in the same section as Theme blocks".
- **Dynamic rendering:** `{% content_for 'blocks' %}` renders blocks merchants can add, remove and reorder. Only blocks with `presets` appear in the picker.
- **Static rendering:** `{% content_for "block", type: "…", id: "…" %}` renders static blocks.
  - Merchants can hide and edit them, but cannot reorder or delete them.
  - They can be rendered conditionally or in loops, and they don't count toward `max_blocks`.
  - They are persisted with `"static": true`, outside `block_order`.
- **Targeting:** `"blocks": [{"type":"@theme"},{"type":"@app"}]` targets all theme blocks and app blocks. Naming specific types restricts the list.
- **File limit:** a theme can hold **at most 300 theme block files**.
- **Sidekick-generated blocks:** these land in a `_blocks.liquid` wrapper section ([AI generated theme blocks](https://shopify.dev/docs/storefronts/themes/architecture/blocks/ai-generated-theme-blocks)).

#### Is Dawn superseded?

- **Still maintained:** Dawn 16.0.0 shipped in August 2026, with a fix in October 2026. Shopify docs still cite Dawn as the example of product-page blocks ([requirements §5](https://shopify.dev/docs/storefronts/themes/store/requirements)).
- **No longer the starting point Shopify points to:**
  - `shopify theme init` now clones **Skeleton** by default ([theme init](https://shopify.dev/docs/api/shopify-cli/theme/theme-init)).
  - The "Create a theme" tutorial calls Skeleton "the Skeleton reference theme" ([Create a theme](https://shopify.dev/docs/storefronts/themes/getting-started/create)).
  - The Theme Store bans new Dawn- or Horizon-derived submissions (section 4).
- **Horizon** is Shopify's flagship theme-blocks theme, but it is **not** licensed as a base for resale (section 4).

---

### 3. Skeleton theme, `{% block %}` and `{% partial %}`

#### What the repo is

- **Same as upstream:** this repo matches upstream `Shopify/skeleton-theme` `main` at `a7a655e` (2026-10-01): "Port rc-v2.0.0 with updated block composition syntax".
- **Branches and tags:** upstream also has an `rc-v2.0.0` branch and a `v1.0.0` tag.
- **v1.0.0 was a conventional OS 2.0 theme.** It had `sections/` (including `header-group.json` and `footer-group.json`) and **JSON templates**.
- **rc-v2 removes both** and states as "non-negotiables": no `sections/`, no JSON templates, no schema `presets` ([README](https://github.com/Shopify/skeleton-theme/blob/main/README.md)).
- **Partial runtime is provisional:** `assets/liquid-tips.js` says "Temporary import path until SFR ships the partial runtime". The theme has no import map, so the `@shopify/partial-rendering` bare import relies on platform injection (inferred, unverified).

#### What Shopify documents publicly

- **Changelog** ([2026-07-21](https://shopify.dev/changelog/posts/developer-preview-liquid-block-and-partial-tags)): "The Liquid July '26 **developer preview**" adds `{% block %}` and `{% partial %}`. To try it, "create a development store with the Liquid July '26 developer preview. Start with the skeleton theme **release candidate**". New Theme Check rules arrive in 3.28.0.
- **Feature preview:** handle `liquid_july_26_changes`. It is enabled when a **dev store** is created, and "only one feature preview may be enabled on a dev store… subject to change" ([Feature previews](https://shopify.dev/docs/apps/build/stores/feature-previews)).
- **Overview** ([Developer preview](https://shopify.dev/docs/storefronts/themes/getting-started/developer-preview)): "Tag behavior and JavaScript helpers can change before general availability." Also: "Your existing themes keep working. Sections, theme settings, and JSON templates are all still supported… alongside what you already use."
- **Block tag pages** ([dev-preview Block tag](https://shopify.dev/docs/storefronts/themes/getting-started/developer-preview/block); [Liquid reference: block](https://shopify.dev/docs/api/liquid/tags/block)):
  - Same theme blocks, placed by the template.
  - Named params become variables. They also set `block.settings.<id>` when the name matches a schema setting.
  - `{% doc %}` is documentation only.
  - The two pages **disagree on syntax**: the preview page prints `{{ block.content }}`, the reference prints `{{ content }}`. That signals ongoing churn.
- **Who controls layout** (most important for the brief): "`{% block %}`: Use when **the template controls the page**… `{% content_for %}`: Use when **a merchant controls the page by adding and arranging blocks in the theme editor, which Shopify stores in a JSON template**."
- **Partial tag** ([Partial tag](https://shopify.dev/docs/storefronts/themes/getting-started/developer-preview/partial)):
  - Named, server-rendered regions.
  - JS uses `partials.fetch()`, `apply()`, `refresh()`, `get()` and `getAll()`, built on the "Declarative Partial Updates" web proposal.
  - `apply()` preserves focus, selection, form values and scroll. Stale-request handling, `aria-busy` and live-region announcements are the theme's job.
  - Positioned as the successor to pairing the Section Rendering API with client-side stitching.

#### What is **not** documented (as of today)

- **Persistence:** where merchant edits to `{% block %}` settings are stored when there is no JSON template, and whether they survive theme updates. I found no doc (unverified).
- **Editor layout control:** I found no doc saying merchants can **add, remove or reorder** blocks on a Liquid template. The `content_for` vs `block` guidance implies they cannot.
- **App blocks:** whether app blocks (`@app`) can be placed on Liquid templates. Shopify's app docs still say app blocks require "JSON templates" ([App block support](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration); [Verify support](https://shopify.dev/docs/apps/build/online-store/verify-support)).
- **Live storefronts:** whether `{% partial %}` and `{% block %}` work on a normal (non-preview) storefront. The repo README says `{% partial %}` raises `Unknown tag 'partial'` unless `shop.features.agentic_editor_enabled?` is on. **Treat it as not production-ready.**
- **GA date:** none published (unverified).

#### Theme Store eligibility of a rc-v2 Skeleton theme

**Not eligible as-is:**
- The [requirements §5](https://shopify.dev/docs/storefronts/themes/store/requirements) mandate JSON templates (`index.json`, `product.json`, …), "All templates must support sections (JSON templates)", a Custom Liquid section, header and footer **in section groups**, and `@app` blocks in the main and featured product sections.
- Stage 1 of review is "Theme features and **Online Store 2.0** compatibility" ([Submit theme](https://shopify.dev/docs/storefronts/themes/store/review-process/submit-theme)).
- Separately, "Shopify's **Skeleton Theme is the only approved codebase** for Theme Store development". That refers to Skeleton as a codebase. Nothing says rc-v2's Liquid-template architecture is exempt from §5.

---

### 4. Theme Store requirements and quality bar

All from [Theme Store requirements](https://shopify.dev/docs/storefronts/themes/store/requirements) unless noted.

#### Exclusivity and base code

- **Exclusive distribution:** themes may only be distributed through the Theme Store, not on other marketplaces, with no designer credits or affiliate links.
- **Uniqueness:** the theme must be "fundamentally different" from other Theme Store themes. Cosmetic changes don't count.
- **Base code:** "**Skeleton Theme is the only approved codebase… Otherwise, themes must be built with fully original code. New theme submissions built on or derived from Dawn or Horizon are not eligible.**"

#### Licenses (local `LICENSE.md` files)

- **Dawn and Skeleton:** permission only "to develop themes that integrate or interoperate with Shopify… and, if applicable, to distribute… via the Shopify Theme Store." Whether that permits off-store resale of a Dawn derivative is unclear (unverified, needs legal review).
- **Horizon:** "you may not submit, list, market, sell, distribute… any theme that is based on, derived from, or incorporates any portion" via the Theme Store, other Shopify channels, **or any off-platform channel**. The one exception is direct delivery to merchants under a services engagement, "solely for those merchants' own use".

#### Templates and OS 2.0

- **Required template files:** `theme.liquid`, `404.json`, `article.json`, `blog.json`, `cart.json`, `collection.json`, `index.json`, `list-collections.json`, `page.json`, `page.contact.json`, `password.json`, `product.json`, `search.json`, `gift_card.liquid`, `settings_data.json` and `settings_schema.json`.
- **Sections everywhere:** every template must use JSON templates with sections, except customer account pages, the gift card page and checkout.
- **Required features:** a Custom Liquid section (setting type `liquid`) and header/footer in section groups.
- **Product page blocks:** blocks for "all or most" main product elements, and `@app` in the main and featured product sections.

#### Performance and accessibility

- **Lighthouse performance:** average ≥ **60**.
- **Lighthouse accessibility:** average ≥ **90**.
- **How it's measured:** both scores are averaged across the **home, product and collection** pages, on **both desktop and mobile**, using Shopify's benchmark dataset. Sections must contain real content.
- **Self-testing:** the [testing guide](https://shopify.dev/docs/storefronts/themes/best-practices/performance/testing-for-performance) explains how to reproduce the run:
  - Import the benchmark CSV into a dev store.
  - Append `pb=0` to the preview URLs.
  - Use the median of at least 3 runs.
  - The bar is a **plain average**. Shopify's 17/40/43 weighting is informational only.
- **Accessibility checklist (§12):**
  - Full keyboard access with a visible focus state.
  - Alt text on all images.
  - Labelled form inputs with unique IDs.
  - Valid HTML.
  - Contrast 4.5:1 for body text and 3:1 for large text and UI.
  - DOM-order focus.
  - Touch targets ≥ 24×24 px.
  - Distinct h1–h6.
  - Shopify doesn't name a WCAG level here. These items track WCAG 2.2 AA (my inference).

#### Functional and ethics rules (directly relevant to DTC CRO features)

- No functionality that depends on an app.
- No "app-like functionalities that require API access", for example "cart-level discount codes".
- **No fake urgency or scarcity** ("fictitious countdown timers, stock levels, or viewer activity counts").
- Accelerated checkout on product and cart pages, discounts shown in cart, faceted filtering, pickup availability, product recommendations (related and complementary), multi-level menus, language and country selectors, newsletter, and so on (§4).
- The [App Store best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices) note the Theme Store requires the selling-plan name to be shown in cart.

#### Settings, color and fonts

- **Settings:** clear names, "avoid unnecessarily deep nesting of blocks", no Lorem Ipsum defaults, a favicon setting, and a `theme_info` section.
- **Color (§16):** "A minimum of 4 colors", every background color needs a matching foreground, and colors use type `color`. **Color schemes are not mandated** in the requirement text retrieved.
- **Fonts:** `font_picker` only, with bold, italic and bold-italic variants loaded through `font_modify`. No custom fonts.

#### Assets

- No Sass.
- No minified first-party CSS or JS, except ES6 code and third-party libraries.
- Scripts must be hosted on Shopify, except approved libraries.

#### Theme Check and translations

- **Theme Check:** the requirements text I retrieved has no explicit "zero Theme Check errors" clause (unverified). Theme Check is the documented first-line tool ([Theme Check](https://shopify.dev/docs/storefronts/themes/best-practices/performance/theme-check-tool)).
- **Translations:** I found no explicit "no hard-coded strings" requirement either (unverified). Locale rules are documented in [Locales](https://shopify.dev/docs/storefronts/themes/architecture/locales): one `*.default.json` file, at most 3,400 keys per file, values ≤ 1,000 characters.

#### Presets and demo stores

- **Up to five presets** per theme ([Updating your theme](https://shopify.dev/docs/storefronts/themes/store/success/updates)).
- Each preset gets its own listing page tagged with ≤ 2 industries and 1 catalog size. Industries include Beauty, Clothing, Food and drink, Pets and Wellness ([Listing page](https://shopify.dev/docs/storefronts/themes/store/review-process/listings)).
- With more than one preset, each preset's templates go in `listings/<preset>/templates/*.json`.
- Each preset's install state must mirror its demo store.
- **Demo stores:**
  - At least one per preset.
  - Must match the preset's industry and catalog size.
  - Test payments only.
  - Authentic copy.
  - **No apps** (limited exceptions for free review and translation apps).
  - Must showcase only functionality built into the theme.

#### Pricing

**$100–$500 USD in $10 steps.** Merchants must be offered contact-form support and documentation ([Listing page](https://shopify.dev/docs/storefronts/themes/store/review-process/listings)).

#### Updates and versioning

From [Updating your theme](https://shopify.dev/docs/storefronts/themes/store/success/updates):
- Every update needs a version number and release notes.
- Leave at least **4 weeks between updates**. New themes may update every 2 weeks for their first 2 months.
- **Automatic updates** happen only if every file except `settings_data.json` and `templates/*.json` is unmodified.
- **Manual updates** are triggered by removing or renaming a setting ID or type, tightening a range min or max, or removing a section or block.
- **Rejected outright:**
  - Lowering section `limit` or `max_blocks`.
  - Adding `enabled_on`/`disabled_on` restrictions to section groups.
  - Restricting sections from templates.

---

### 5. Theme editor UX mechanics and limits

#### Limits

- **Templates and groups:** JSON templates hold up to **25 sections**, each with up to **50 blocks** ([JSON templates](https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates)). Section groups have the same limits ([Section groups](https://shopify.dev/docs/storefronts/themes/architecture/section-groups)).
- **`max_blocks`:** caps a section at fewer than 50. Static blocks don't count toward it ([Section schema](https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema)).
- **Theme blocks:** nesting ≤ **8 levels**; at most **300** block files per theme.
- **File sizes** ([Theme limits](https://shopify.dev/docs/storefronts/themes/architecture/limits)):
  - JSON template and section group: 512 KB each.
  - `settings_schema.json`: 512 KB. `settings_data.json`: 1.5 MB. Locale files: 1.5 MB each.
  - Other Liquid files: 256 KB each.
  - A `liquid` setting: 50 KB.
  - Schema `name`: ≤ 25 characters.

#### Presets in two senses

1. **Section and block presets.** These are the entries in the "Add section" and "Add block" pickers, with optional `category`, default `settings` and nested `blocks`. A section without presets can only be added in code and cannot be removed in the editor ([Section schema](https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema); [Sections](https://shopify.dev/docs/storefronts/themes/architecture/sections)).
2. **Theme presets (theme styles).** These live under `presets` in `settings_data.json`.
   - Choosing a style overwrites only **presentational** settings: checkbox, color, color_background, color_palette, color_scheme, color_scheme_group, font_picker, number, radio, range and select ([settings_data.json](https://shopify.dev/docs/storefronts/themes/architecture/config/settings-data-json)).
   - Template content is not overwritten.
   - So Clinical, Editorial and Bold can differ in color, type and layout toggles. Their different home-page content has to come from `listings/<preset>/templates`.

#### Other mechanics

- **`visible_if`:**
  - GA since [2025-05-21](https://shopify.dev/changelog/posts/conditional-settings-in-the-theme-editor).
  - Example: `"visible_if": "{{ block.settings.layout_style == 'flex' }}"`.
  - Works on basic and sidebar settings and most specialized ones.
  - Cannot evaluate resolved dynamic-source values ([Settings](https://shopify.dev/docs/storefronts/themes/architecture/settings)).
- **Color systems:**
  - `color_scheme_group` (Dawn) defines grouped schemes with a role map. Sections and blocks pick one with a `color_scheme` setting.
  - `color_palette` (Horizon 4.x) is one global set of 2–20 named colors. Merchant edits survive theme updates, and new palette keys appear automatically.
  - Color scheme settings aren't supported in app blocks.
- **Defaults:** `default` on a setting seeds new instances, and presets seed sections and blocks. Changing a default doesn't rewrite existing merchant data. If an update invalidates a stored value, it resets to the new default.
- **Live preview:** text settings preview live only if the setting is the only child of its element, with no filters except `escape` ([Theme editor](https://shopify.dev/docs/storefronts/tools/online-editor)). Worth designing for, because instant feedback makes editing feel smooth.

---

### Implications for Blueprint

#### Base choice: none of the three as literally described. Build an original OS 2.0 theme-blocks codebase starting from Skeleton.

| | Dawn 16 | Horizon 4.3 | Skeleton rc-v2 (this repo) |
|---|---|---|---|
| Theme Store eligible | **No**: derived-from-Dawn is barred | **No**: barred, and the license forbids any resale | Codebase approved, but **architecture fails §5** (no JSON templates, sections, section groups or `@app`) |
| Sell outside the Theme Store | License ambiguous (unverified) | **Forbidden** except per-merchant services | MIT-style with Shopify-use restriction |
| Merchant add/reorder in editor | Yes (sections + section blocks) | Yes (sections + nested theme blocks) | **No** per docs: template controls layout |
| Updates preserve merchant work | Yes (JSON templates + `settings_data`) | Yes | Unclear for Liquid-template block settings (unverified) |
| Production-ready | Yes | Yes | **No**: developer preview on dev stores; syntax still changing |

#### Recommendation

- **Do not build on Dawn.** That is the brief's stated base, and it closes the Theme Store door (requirements §2).
- **Do not fork Horizon.** It closes the Theme Store door, and its license also bars selling the theme anywhere as a product.
- **Do not ship on Skeleton rc-v2's Liquid-template model either.**
  - It cannot meet the brief's core needs: "merchants edit everything", "updates preserve `settings_data.json` and JSON templates", and app blocks.
  - It is a developer preview that only runs on preview dev stores.
- **Use Skeleton as the approved starting codebase and add the OS 2.0 + theme-blocks architecture as original code.** That means:
  - `templates/*.json` for every required template plus `page.advertorial`, `page.listicle`, `page.comparison` and `page.about`.
  - `sections/` with `header-group.json` and `footer-group.json`, a Custom Liquid section, and generic `@theme`/`@app` sections.
  - `blocks/` holding the 30+ product blocks as reusable theme blocks.
  - `{% content_for 'blocks' %}` and static `content_for "block"` for locked parts.

  Skeleton v1.0.0 is the closest precedent. Use Dawn and Horizon only as *reading references* for patterns: bundled section rendering, the `product-info` variant fetch, the standard-actions override. Do not copy their code.
- **Resolve the conflict with this repo's `AGENTS.md`/README rules before writing code.** They forbid `sections/`, JSON templates and schema `presets`, which is exactly what the brief and the Theme Store need. Someone has to decide: change the repo rules, or drop Theme Store and merchant-editable layout.

#### Architecture guidance

- **Fewer sections, more blocks.** Prefer about 25–35 flexible sections plus 60–90 theme blocks over 70+ bespoke sections. This is Horizon's ratio (42/95). It stays under the 300-file block limit and the "avoid deep nesting" settings rule.
- **Long pages.** Advertorial and listicle pre-landers can hit the **25-section cap**. Design them as a few sections containing many blocks (50 per section, 8 levels of nesting).
- **Three presets.** Clinical, Editorial and Bold can each be a theme style in `settings_data.presets` (limit 5).
  - Each needs its own demo store, industry tag (Wellness/Beauty, Food and drink, Clothing, Pets), and `listings/<preset>/templates`.
  - Choose `color_palette` (Horizon-style, simpler, survives updates) or `color_scheme_group` (Dawn-style, per-section schemes). The requirements only demand ≥ 4 colors with foreground/background pairs.
- **CRO features vs Theme Store ethics rules.**
  - Bundles and quantity breaks must run on native discounts or bundles data (unverified which native APIs fit). They must not rely on cart-level discount-code UI or need an app.
  - The subscription toggle must use native `selling_plan_groups` and show the plan name in cart.
  - Countdown timers, low-stock counters and "X people viewing" are allowed **only if backed by real data**. Fake versions cause rejection.
  - Keep pre-lander claims truthful.
- **JavaScript.**
  - Cart drawer and variant updates: implement the Section Rendering API (bundled `sections` on `/cart/add`) now.
  - Implement **standard storefront events and a `Shopify.actions` override** from day one, as Dawn 15.5 did.
  - Keep `{% partial %}` behind a flag or on a branch until it reaches GA.
- **Performance budget.** Target well above the floor: Lighthouse perf ≥ 60 (aim for 80+) and a11y ≥ 90 on home, product and collection, mobile and desktop, measured on the benchmark catalog.
  - Lazy-build drawers and modals.
  - Avoid a monolithic `global.js`.
  - Load per-feature ES modules.
- **Update safety.**
  - Freeze setting IDs early.
  - Never lower `max_blocks` or `limit`.
  - Batch breaking changes, since they force manual updates.
  - Ship release notes with every version.
- **Pricing and distribution.** List at $100–$500. A Theme Store listing means exclusive distribution there, with no license keys or outside sales.

---

## Part 2: Subscriptions, bundles/quantity breaks, discount display, metafields

Researched 2026-10-23. Sources: shopify.dev (via the Shopify docs search index; direct page fetches were blocked in this environment, so quotes come from indexed chunks of the linked pages), Dawn `main` @ `0522253` (v16.0.0, 2026-10-22), `Shopify/subscriptions-reference-app` theme extension, and vendor docs or community threads where noted. Anything I could not confirm against a primary source is marked **(unverified)**.

---

### 1. Selling plans and subscriptions

**Liquid surface**
- [`selling_plan_allocation`](https://shopify.dev/docs/api/liquid/objects/selling_plan_allocation) has these fields. `price` is the plan price. `compare_at_price` is *the line price without the selling plan applied*, so it is the variant's `price`, not the variant's `compare_at_price`. `per_delivery_price` equals `price` divided by the number of deliveries, so it only differs for prepaid plans. `unit_price` is nil when the variant has no unit price. `checkout_charge_amount` and `remaining_balance_charge_amount` cover deferred or partial charges. `price_adjustments` holds at most 2 entries; the second applies after `order_count` orders. `selling_plan_group_id` is also on the object. The allocation is returned by `variant.selling_plan_allocations`, `variant.selected_selling_plan_allocation`, `product.selected_selling_plan_allocation`, `product.selected_or_first_available_selling_plan_allocation` and `line_item.selling_plan_allocation`.
- [`selling_plan`](https://shopify.dev/docs/api/liquid/objects/selling_plan) has `id`, `name`, `description`, `options`, `recurring_deliveries`, `price_adjustments` and `selected`. `price_adjustments` holds the *intent* (percentage, fixed amount or price), and the allocation holds the resulting money. `selected` is driven by the **`selling_plan` URL parameter**.
- [`product.selected_or_first_available_selling_plan_allocation`](https://shopify.dev/docs/api/liquid/objects/product) resolves in this order: (a) the allocation for the variant in the `variant` param plus the plan in the `selling_plan` param; (b) the first allocation on the first available variant; (c) the first allocation on the first variant. It is nil when the product has no plans. `product.requires_selling_plan` and `variant.requires_selling_plan` mean one-time purchase must be hidden ([Add subscriptions to your theme](https://shopify.dev/docs/storefronts/themes/pricing-payments/subscriptions/add-subscriptions-to-your-theme)).
- **Allocations are per variant.** Selling plans belong to groups attached to the product, but each variant carries its own allocations. If a plan isn't associated with a variant, that variant has no allocation for it. Plans created by the same app with the same group name and options are merged into one `selling_plan_group` in Liquid ([Build a selling plan](https://shopify.dev/docs/apps/build/purchase-options/subscriptions/selling-plans/build-a-selling-plan)).
- **Uninstall risk:** selling plan groups, plans and their associations are **deleted 48 hours after the subscription app is uninstalled** (same page). The theme must render cleanly when `product.selling_plan_groups.size == 0`.

**Submitting**
- HTML form: add an input with `name="selling_plan"` *inside* the product form. Its value is the plan ID, or empty for one-time purchase ([Add subscriptions to your theme](https://shopify.dev/docs/storefronts/themes/pricing-payments/subscriptions/add-subscriptions-to-your-theme)). This works without JavaScript.
- AJAX: `POST /{locale}/cart/add.js` with `items: [{ id, quantity, selling_plan }]`. Lines that differ in price, properties or selling plan are split into separate cart lines. Use `/cart/change.js` with `{ line, quantity, selling_plan }` to switch or remove a plan in the cart (`null` removes it). See [Cart API reference](https://shopify.dev/docs/api/ajax/reference/cart). `/products/{handle}.js` exposes `selling_plan_groups` and per-variant `selling_plan_allocations` in presentment currency ([Product API](https://shopify.dev/docs/api/ajax/reference/product)).

**Price display** ([Subscription UX guidelines](https://shopify.dev/docs/storefronts/themes/pricing-payments/subscriptions/subscription-ux-guidelines))
- Show `allocation.price` and `allocation.compare_at_price`.
- Show `per_delivery_price` only when it differs from `price`.
- Show `allocation.unit_price` (the unit measurement lives on the variant).
- Show a subscription badge when `recurring_deliveries` is true. Omit it when the product is subscription-only.
- Express savings as "Save X%" or "Save $X" taken from `price_adjustments`, and show the largest saving when the policy changes over time.
- Because `allocation.compare_at_price` is the variant price, a "was $198" anchor on a pack has to come from `variant.compare_at_price`. The theme must label which reference it uses.

**Dawn (v16.0.0)**
- No native PDP purchase-option selector. A `grep` of `selling_plan` in Dawn only finds cart and notification displays (`item.selling_plan_allocation.selling_plan.name` in `snippets/cart-drawer.liquid`, `sections/main-cart-items.liquid` and `sections/cart-notification-product.liquid`).
- `main-product` accepts `"@app"` blocks, which is where subscription apps insert their widgets.
- `assets/product-form.js` posts `new FormData(this.form)` to `routes.cart_add_url`, so any `selling_plan` input inside the form is sent. Community reports of the plan being "ignored" trace back to the input sitting outside the form ([thread](https://community.shopify.com/t/dawn-is-not-compatible-with-selling-plans/59550)).
- On a failed add, Dawn's quick-add shows "Sold out" even when the real error is "variant requires a selling plan" ([thread](https://community.shopify.com/t/sold-out-message-on-add-to-cart-dawn-theme/404060)).

**Subscription-app compatibility**

| App | Native selling plans? | Storefront UI | DOM / events it hooks | Conflict with a theme-native toggle |
|---|---|---|---|---|
| Shopify Subscriptions | Yes | App block (`shopify_subscriptions_app_block`) | From [`app-block.js`](https://github.com/Shopify/subscriptions-reference-app/blob/main/extensions/theme-extension/assets/app-block.js): finds `#shopify-section-{section.id}`; takes every `[action*="/cart/add"]` form there whose `product-id` matches; **appends a clone of a hidden `input.selected-selling-plan-id[name=selling_plan]`**; watches variant changes by listening to form `change`, by MutationObserver on `input[name=id]`, and by a PerformanceObserver on fetches whose URL contains `variant` or `option_values`; rewrites Dawn price DOM (`.price`, `.price__sale`, `.price__regular`, `.price-item--sale`, `.badge.price__badge-sale`); hides itself in `.quick-add-modal__content-info` | Two `selling_plan` inputs end up in one form. Which value wins is server-dependent **(unverified)**. Its price rewriting targets Dawn class names. |
| Recharge (Shopify Checkout Integration) | Yes. "Product Subscription Plans" create Shopify selling plan groups ([Recharge](https://support.getrecharge.com/hc/en-us/articles/13618258115223)) | OS 2.0 app block. A legacy JS widget injects wherever it finds `data-productid` ([JS widget](https://docs.getrecharge.com/docs/js-widget)) | Custom widgets must read **all** selling plan groups and variant-level plans ([custom widget guide](https://docs.getrecharge.com/docs/build-a-custom-widget-compatible-with-product-subscription-plans)) | Duplicate UI if both are enabled |
| Skio | Yes **(unverified; implied by their migration checks for "other apps' selling plans")** | "Plan Picker" app block placed after the variant picker ([Skio](https://help.skio.com/docs/self-serve-install-setup)) | Not documented publicly | Duplicate widgets are reported ([Tapcart](https://help.tapcart.com/en/articles/13877671-skio-tapcart)) |
| Loop | Yes. Plans must exist and be mapped to products ([Loop](https://help.loopwork.co/en/articles/12729262-loop-widget-set-up)) | App block, or a "custom widget" on higher plans | CSS-level customization | Duplicate UI |
| Appstle | Yes. Display uses `selling_plan_groups` from product JSON ([FAQ](https://developers.appstle.com/subscription/faq)) | Auto-injected `appstle-subscription.js` widget | Fires `AppstleSubscription:SubscriptionWidget:SellingPlanSelected`, `…widgetInitialised`, `…SellingPlanRemoved` and others on `document` and `window`; uses `appstle_` CSS classes ([hooks](https://developers.appstle.com/subscription/javascript-hooks)) | Auto-injection can double up with a theme toggle **(unverified how to disable it per theme)** |

Takeaway: all five write and read native selling plans. A theme toggle that submits `selling_plan` therefore works with every one of them. The theme needs a single "purchase options source" switch (Theme | App block). When an app block or widget is detected, the theme should `disabled` its own input and leave pricing to the app.

---

### 2. Bundles and quantity breaks without an app

**(a) Tiers as variants** (a "Pack" option: 1 / 2 / 3, each priced, with compare-at)
- Fully native. The price and compare-at come from the variant. `selling_plan` works per variant, so subscribing to a 2-pack is just variant + plan.
- There is no discount object. `cart.total_discount` and `line_level_discount_allocations` are empty, and the "bundle saving" is implicit in the variant price. The cart and checkout show the pack price, which reconciles exactly.
- Checkout shows no "bundle discount" row. Whether checkout shows the compare-at strikethrough is **(unverified)**.
- Trade-offs:
  - Inventory is not shared across packs unless the merchant disables tracking on pack variants or manages stock manually.
  - The fulfillment team or 3PL sees "Verde – 3 pouches" as one SKU.
  - Native unit pricing can carry per-serving or per-pouch values (`ITEM` is a valid measured unit; see [UnitPriceMeasurementMeasuredUnit](https://shopify.dev/docs/api/storefront/2026-10/enums/UnitPriceMeasurementMeasuredUnit)).
- Subscription renewals keep the pack price with any subscription app, because no discount needs to be carried onto the contract.

**(b) Multi-line or quantity add plus a separate automatic discount**
- The tier adds `quantity: N` of the single variant (or several `items[]`). The merchant configures an automatic "Amount off products" discount per tier with a minimum quantity.
- Native admin discounts give a single threshold per discount, not a ladder. Tiers need one discount each, and they must not combine on the same line. Third-party guides confirm there is no native multi-tier ladder ([Barn2](https://barn2.com/blog/shopify-tiered-pricing/)). Behaviour when several automatic discounts qualify for the same line is **(unverified: expected best-for-customer)**.
- Combination rules live on `combinesWith` (product, order and shipping classes, plus tag-based mutual matching), and BXGY stacks only on the "gets" side ([DiscountCombinesWith](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/DiscountCombinesWith)).
- Pro: real discount allocations show in the cart drawer as `line_level_discount_allocations` with `discount_application.title`, and the same title appears in checkout.
- Con: the PDP must *predict* the discount from configuration that the theme cannot read, which is a drift risk.
- Fixed-price tiers rarely map to clean percentages. $142 from 2 × $79 is 10.13% off. $199 from 3 × $79 needs $12.67 off each, and 3 × $66.33 = $198.99. Use a fixed amount applied once per order ($16, $38) to land on exact totals.
- Automatic discounts can apply to subscriptions, with a purchase-type choice and a recurring-cycle limit ([Subscription contracts](https://shopify.dev/docs/apps/build/purchase-options/subscriptions/contracts)). Whether the discount persists on renewals depends on that limit and on the subscription app.

**(c) Shopify Functions**
- [Cart Transform](https://shopify.dev/docs/api/functions/2026-10/cart-transform) can merge lines into a bundle, expand a bundle into components, and `lineUpdate` the price, title or image. `lineUpdate` is **Plus or dev stores only**. Each app can install one cart transform per store; if several apps install one, all run.
- The [Discount Function API](https://shopify.dev/docs/api/functions/2026-10/discount) is now unified: one function can return product, order and shipping discount classes. A store can have at most 25 active, and they run concurrently. The older product, order and shipping discount APIs are deprecated ([About discounts](https://shopify.dev/docs/apps/build/discounts)).
- **A theme cannot ship a Function.** Functions deploy only inside apps. Public App Store apps with Functions work on any plan; **custom apps containing Functions require Shopify Plus** ([About Shopify Functions](https://shopify.dev/docs/apps/build/functions)).
- Bundles created by Cart Transform **cannot be sold with selling plans** ([About product bundles](https://shopify.dev/docs/apps/build/product-merchandising/bundles)).

**(d) Shopify Bundles (free, first-party)**
- Supports fixed bundles and multipacks. A multipack is a fixed bundle of N units of one product, and "add quantity as an option" exposes pack sizes ([Shopify help](https://help.shopify.com/en/manual/products/bundles); [Appstle guide](https://appstle.com/blog/multipack-product-bundles-shopify/)).
- Each bundle is a parent product whose price is the parent variant price. Inventory is derived as the minimum across components, and orders, returns, taxes and reports run at component level. Discounts are calculated on the parent and allocated to components ([Start building bundles](https://shopify.dev/docs/apps/build/product-merchandising/bundles/start-building)).
- Fixed bundles "work on existing product pages, without theme changes". The cart shows the parent, and components are available via `item_components` ([About product bundles](https://shopify.dev/docs/apps/build/product-merchandising/bundles)).
- Hard limits:
  - **No selling plans.** Subscriptions, pre-orders and TBYB are excluded. A community report shows a 422 on add ([thread](https://community.shopify.com/t/using-shopify-bundles-products-with-subscriptions/242762)).
  - No nested bundles.
  - Nested add-on lines can't attach to bundle parents ([Nested cart lines](https://shopify.dev/docs/apps/build/product-merchandising/nested-cart-lines)).
- Shopify now documents editing *existing* subscription contracts to contain bundles ([Edit contracts with bundles](https://shopify.dev/docs/apps/build/purchase-options/subscriptions/contracts/edit-contracts-with-bundles)). The storefront still cannot buy a bundle with a plan.

**(e) Admin automatic discounts (Buy X Get Y, volume)**
- BXGY can make a gift 100% off, but it **does not add the gift to the cart**. The theme or customer must add it ([community, staff answers](https://community.shopify.com/t/why-isnt-my-buy-x-get-y-discount-working/169255/1)).

**Free gift with purchase**
- **Theme-native route:**
  1. Add the gift line as a **nested cart line** with `parent_id` (or `parent_line_key`) in the same `/cart/add.js` call. Nested lines sort after the parent and are **removed automatically when the parent is removed**. Dawn already renders them via `item.parent_relationship.parent`.
  2. Make it free with an automatic BXGY discount: "buy 1 × 3-pack variant → gift 100% off, 1 use per order".
  3. Without BXGY, a $0 gift variant works, but anyone can add it with a bare `/cart/add`.
- Strict enforcement (block gift-only carts, auto-remove the gift) needs a Function or app.

**Recommendation**
- **Native default: (a) tiers as variants, plus selling plans per variant, plus a BXGY gift on the top tier.** This is the only combination where per-unit price, savings, cart and checkout totals, and renewal price are all the same numbers with no app.
- **Optional "discount mode": (b)**, for merchants who insist on a visible "Bundle discount" row in checkout and accept that they must mirror tier discounts in admin.
- **Shopify Bundles: one-time kits only** (for example "Verde + shaker"), never subscription tiers.
- **Functions: only through an optional companion app**, never a hard dependency.

---

### 3. Discount display that reconciles

**Objects** ([Discounts tutorial](https://shopify.dev/docs/storefronts/themes/pricing-payments/discounts), [line_item](https://shopify.dev/docs/api/liquid/objects/line_item), [cart](https://shopify.dev/docs/api/liquid/objects/cart))
- `line_item.original_price` and `original_line_price` are before line discounts. `final_price` and `final_line_price` are after them.
- Each `line_level_discount_allocations[]` entry has `amount` and `discount_application.title`. `line_level_total_discount` is the line total.
- The subtotal is after line discounts. `cart.cart_level_discount_applications[]` (with `title` and `total_allocated_amount`) belong between subtotal and total. `cart.total_discount` and `cart.original_total_price` complete the picture.
- Manual codes are applied at checkout and do not appear in `cart.discount_applications`.
- Dawn's drawer already renders strikethrough original/final prices, per-line allocations and cart-level applications.
- Compare-at savings and selling-plan savings are *not* discounts, and none of these fields include them.

**"Bundle discount −$X" row in the drawer**
- Approach (b): sum `line_level_discount_allocations` whose `discount_application.title` matches the tier discount titles. Those are real numbers that checkout shows too.
- Approach (a): render an informational **"Bundle savings"** row computed from presentment prices on that line:
  - bundle savings = `base_unit_variant.price × pack_qty × qty − line.variant.price × qty`
  - subscription savings = `(allocation.compare_at_price − allocation.price) × qty`
- Never derive the subtotal or total yourself. Always print `cart.items_subtotal_price` and `cart.total_price`, and make the savings rows add up to them, using only integer-cent values from Liquid or `/cart.js`.
- Whether `line_item.original_price` already equals the plan price for subscription lines is **(unverified; read `selling_plan_allocation` explicitly)**.

**Rounding pitfalls**
- All money is integer subunits in **presentment currency**. Liquid `divided_by` with an integer divisor **floors**: 14200/60 → 236 ($2.36), but $2.3667 rounds to $2.37. Use `times: 1.0 | divided_by: n | round`, and mirror it exactly in JS (`Math.round`).
- Savings %: **floor**, so the claim is never overstated. (297−199)/297 = 32.99%, so say "Save 32%", not 33%. Compute it from the same numbers that are displayed.
- Selling-plan percentage on packs: 15% of $199 = $169.15. For zero-decimal currencies (JPY), the docs say values are output with two appended digits, so always format with `money` filters and pass `shop.money_format` to JS.
- **Markets:**
  - FX conversion plus rounding rules apply per variant. A 3-pack in EUR will not equal 3 × the 1-pack, so per-market savings differ slightly. That is fine only if everything is computed from presentment values.
  - Fixed price-list prices skip FX and rounding.
  - Selling plans of type `PERCENTAGE` or `FIXED_AMOUNT` apply *on top of* price-list prices. Type `PRICE` *overrides* them ([Catalogs for different markets](https://shopify.dev/docs/apps/build/markets/catalogs-different-markets)). Prefer PERCENTAGE plans.
  - Never store tier prices in `money` metafields: `metafield_tag` formats them in the store currency ([metafield_tag](https://shopify.dev/docs/api/liquid/filters/metafield_tag)), and whether they convert is **(unverified, assume no)**.
- Compare-at "was" prices may be regulated: EU Omnibus requires the prior 30-day low **(unverified/legal review)**. Make the reference label configurable ("vs. single pouch" or "vs. RRP").

---

### 4. Metafields and metaobjects for per-product content

**Types**
- Content lists → `list.metaobject_reference`.
- Single records → `metaobject_reference`.
- Upsell → `product_reference`, or the **standard** `shopify--discovery--product_recommendation.complementary_products` (`list.product_reference`).
- Reviews: **standard** `reviews.rating` (type `rating`, written by review apps) and `reviews.rating_count` (`number_integer`). Both are API-only and not editable in admin ([standard definitions](https://shopify.dev/docs/apps/build/metafields/list-of-standard-definitions); [review metaobject](https://shopify.dev/docs/apps/build/metaobjects/standard-review-metaobject)). The rating value is JSON (`value`, `scale_min`, `scale_max`).
- Subtitle → standard `descriptors.subtitle`.
- Use `json` only for config no merchant edits.

**Reading in Liquid**: `product.metafields.blueprint.ingredients.value` gives an array of metaobjects, and each field is read as `entry.name.value`.

**Dynamic sources** ([docs](https://shopify.dev/docs/storefronts/themes/architecture/settings/dynamic-sources))
- Section and block settings can be connected to compatible metafields. Theme-wide settings cannot.
- `text` and `richtext` accept text, number and `rating` types. `product` takes `product_reference`. `image_picker` takes `file_reference`.
- `metaobject` and `metaobject_list` settings take `metaobject_reference` and `list.metaobject_reference` of the same type ([input settings](https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings)).
- A `list.metaobject_reference` used as a dynamic source yields a list of *one field*, for example names only, not rows. Row-shaped UIs (ingredients tables, studies) therefore need either a `metaobject_list` setting or direct Liquid reads.

**Can a theme ship definitions? No.** The options are:
1. Setup docs or a checklist so merchants create definitions in admin.
2. Standard definitions, which need no setup: reviews, subtitle, complementary products.
3. A **companion app**.
   - Declarative TOML (`[product.metafields.app.x]`, `[metaobjects.app.x]`) creates *app-owned* `$app` definitions that deploy to every install ([metafield definitions](https://shopify.dev/docs/apps/build/metafields/definitions); [metaobject definitions](https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions)).
   - Limits: 128 definitions per owner type, 25 changes per deploy, and the definitions are read-only via API.
   - The `$app:` prefix resolves only inside **theme app extensions**, not themes ([TAE config](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration)). A theme would need the app's resolved namespace hard-coded.
   - So the companion app should instead call `metafieldDefinitionCreate` and `metaobjectDefinitionCreate` on install, creating **merchant-owned** definitions with fixed names (`blueprint.*`, `blueprint_*`). Those survive uninstall.

**Theme Store constraint**: themes listed on the Theme Store "must only use standard metaobject definitions" in `metaobject` settings ([changelog](https://shopify.dev/changelog/posts/metaobject-and-metaobject_list-theme-settings-now-available)). Defaults may rely only on standard definitions ([Partners blog](https://www.shopify.com/partners/blog/metafields)). Whether hard-coded `product.metafields.blueprint.*` reads pass review is **(unverified)**. If Blueprint is sold outside the Theme Store, this does not apply.

**Graceful fallbacks**
- Every block checks `!= blank` and falls back to manual block settings (repeatable static blocks).
- Hide the section when it has no data.
- Rating comes from `reviews.rating`; if that is absent, show nothing (never fake stars).
- Tiers fall back to the product's own variants and option names.
- Show the upsell only if the reference resolves to an available product.

---

### Implications for Blueprint

**Pricing source of truth.**
- Prices live **only** in variants (`price`, `compare_at_price`) and selling-plan allocations, all in presentment currency.
- Metafields hold labels, badges, gift references and serving counts. **Never money.**
- This removes the request's tier `price` and `compare-at` fields from the data model.

**Data model per tier (native "variant" mode, default)**
- Product option `Pack` = 1 / 2 / 3 → variants V1, V2 and V3, priced $79 / $142 / $199 with compare-at $99 / $198 / $297.
- Each variant sets `blueprint.pack_quantity`.
- The variant unit price is set as `ITEM` (servings) where the merchant wants native per-unit display.
- Per-serving = `price ÷ (servings_per_unit × pack_quantity)`, rounded as described in section 3. For example, $79/30 = $2.63.
- Savings % = `floor((compare_at − price) / compare_at)`.
- Subscription: one selling plan group (PERCENTAGE adjustment) associated with **all** pack variants. The theme shows "Subscribe" for a tier only if that variant has an allocation, and hides one-time when `requires_selling_plan`.
- "Cancel any time" comes from `selling_plan.description`, falling back to a translated theme string. It is shown only when the plan is recurring.

**Add-to-cart matrix** (tier t ∈ {1,2,3} × plan ∈ {one-time, sub})

| | No-JS (form POST to `routes.cart_add_url`) | JS (`/cart/add.js` + `sections`) |
|---|---|---|
| one-time | `id=Vt`, `quantity=1`, `selling_plan=""` | `items:[{id:Vt,quantity:1,properties:{_bp_tier:t}}]` |
| subscribe | `id=Vt`, `quantity=1`, `selling_plan=SPt` | `items:[{id:Vt,quantity:1,selling_plan:SPt,…}]` |
| + gift (tier 3) | Gift is not posted. The cart page renders a no-JS "Add your free gift" form when a qualifying line exists without its gift | Append `{id:G,quantity:1,parent_id:V3,properties:{_bp_gift:1}}`. BXGY automatic discount: buy V3 → G 100% off, 1 per order |

- Tier radios use `name="id"` (value is the variant ID) and plan radios use `name="selling_plan"`, so the form works without JS.
- Deep links:
  - Canonical, server-rendered: `?variant=V2&selling_plan=SP`. Liquid preselects both natively.
  - Custom `tier` and `plan` params are **JS-only**, because the Liquid [`request`](https://shopify.dev/docs/api/liquid/objects/request) object exposes no query string. JS maps `tier→Vt` and `plan=sub→`the first allocation of Vt, then calls `history.replaceState` to the canonical URL.
  - Precedence: `variant` > `tier`.

**Cart drawer**
- Per line, show the plan name and frequency, the strikethrough reference price, and the final price.
- Totals block:
  - "Bundle savings −$X" and "Subscribe & save −$Y": informational rows computed per section 3.
  - Real Shopify discounts from `line_level_discount_allocations` and `cart_level_discount_applications`.
  - Subtotal and total printed from `cart.items_subtotal_price` and `cart.total_price`.
- The gift is shown nested ("Free gift", $0.00 after BXGY).
- "Discount mode" (merchant setting) instead labels the real automatic-discount allocations "Bundle discount" by matching the `discount_application.title` configured in the tier metaobject.

**What needs an app**

| Need | Native? | Optional app |
|---|---|---|
| Tiers, per-serving, savings %, subscribe toggle UI | Yes | — |
| Selling plans themselves | **No:** any selling-plan app (Shopify Subscriptions is free) | Recharge, Skio, Loop, Appstle via their app blocks; the theme toggle disables itself when one is detected |
| Free gift pricing | Yes (BXGY automatic) | Gift-enforcement Function |
| Fixed kits across products, shared inventory | — | Shopify Bundles (one-time only) |
| True "Bundle discount" in checkout on subscriptions with tiered ladder logic | Partly (discount mode) | Discount Function in a public companion app (custom app needs Plus) |
| Metafield and metaobject definitions | Manual setup | "Blueprint Setup" companion app creating merchant-owned definitions |

**Proposed definitions** (owner: Product unless noted; all storefront `PUBLIC_READ`)

| namespace.key | type |
|---|---|
| `blueprint.tiers` | `list.metaobject_reference` → `blueprint_tier` |
| `blueprint.servings_per_unit` | `number_integer` |
| `blueprint.serving_label` | `single_line_text_field` |
| `blueprint.benefits` | `list.metaobject_reference` → `blueprint_benefit` |
| `blueprint.ingredients` | `list.metaobject_reference` → `blueprint_ingredient` |
| `blueprint.studies` | `list.metaobject_reference` → `blueprint_study` |
| `blueprint.comparison` | `list.metaobject_reference` → `blueprint_comparison_row` |
| `blueprint.comparison_competitor_label` | `single_line_text_field` |
| `blueprint.faqs` | `list.metaobject_reference` → `blueprint_faq` |
| `blueprint.guarantee` | `metaobject_reference` → `blueprint_guarantee` |
| `blueprint.upsell` | `product_reference` (fallback: standard `shopify--discovery--product_recommendation.complementary_products`) |
| `blueprint.pack_quantity` (Variant) | `number_integer` |
| `reviews.rating` / `reviews.rating_count` | standard `rating` / `number_integer` (read-only, app-written) |
| `descriptors.subtitle` | standard `single_line_text_field` |

**Metaobjects**
- `blueprint_tier`:
  - `label` (single_line_text_field)
  - `sublabel` (single_line_text_field)
  - `variant` (variant_reference, **required**, the price source)
  - `quantity` (number_integer, used only in discount mode)
  - `badge` (single_line_text_field: "Most popular" / "Best value")
  - `preselected` (boolean)
  - `gift_variant` (variant_reference)
  - `gift_label` (single_line_text_field)
  - `discount_title` (single_line_text_field, must equal the admin discount title in discount mode)
- `blueprint_benefit`: `icon` (file_reference), `title`, `text` (multi_line_text_field).
- `blueprint_ingredient`: `name`, `dose` (single_line_text_field), `why` (multi_line_text_field), `image` (file_reference), `source_url` (url).
- `blueprint_study`: `stat_value` (number_decimal), `stat_suffix`, `label`, `source`, `source_url` (url).
- `blueprint_comparison_row`: `feature`, `us`, `them` (single_line_text_field; "✓" or text).
- `blueprint_faq`: `question` (single_line_text_field), `answer` (rich_text_field).
- `blueprint_guarantee`: `title`, `days` (number_integer), `body` (rich_text_field), `icon` (file_reference).

Every metaobject definition gets `access.storefront = public_read` and `translatable = true`.

---

## Part 3: Cart drawer, pre-landers, reviews/UGC

Researched 2026-10-23. Sources are shopify.dev (via the Shopify docs MCP), Dawn `main` at commit `0522253` (2026-10-22, read locally), vendor help centers and community threads. Claims that only a blog, forum or vendor supports, or that I could not confirm in primary docs, are marked **(unverified)**.

### 1. Cart drawer best practice

#### Cart AJAX API and bundled section rendering
- **Endpoints.** The endpoints are `/{locale}/cart.js`, `/cart/add.js`, `/cart/change.js`, `/cart/update.js` and `/cart/clear.js` ([Cart API reference](https://shopify.dev/docs/api/ajax/reference/cart)). Always build the URL from `window.Shopify.routes.root` or the Liquid `routes.*` so locale and market stay intact.
  - `change.js` changes **one** line at a time (quantity, properties, `selling_plan`). Address the line by its `key`, not its variant ID. A key "changes as characteristics of the line item change", for example when a discount applies, so re-read keys after every response.
  - `update.js` sets quantities for several lines at once, using `updates` keyed by variant ID or line key. It also takes `note`, `attributes` and `discount`. It **adds** a line when the variant isn't already in the cart, and it **doesn't validate inventory** for lines already in the cart. Use it to add and remove several lines in one request (for example, swapping gifts).
  - Line item properties whose names start with `_` are "private": themes are expected to hide them, but they are still returned by Liquid and Ajax. Cart attributes whose names start with `__` are fully private: Liquid and Ajax don't return them, and they don't affect page caching. Don't use `__` attributes for state the theme needs to read back.
- **Bundled section rendering.** `add`, `change`, `update` and `clear` accept `sections` (up to **5**) and an optional `sections_url` that must start with `/`. The HTML comes back under `sections` in the same response ([Cart API reference](https://shopify.dev/docs/api/ajax/reference/cart)).
  - Sections render *after* the mutation, so a rendering failure returns `null` for that section, not an error status.
  - An invalid `sections` or `sections_url` value returns **400**, "but this doesn't mean that the rest of the request didn't succeed". The cart may already have changed, so re-fetch it instead of assuming nothing happened.
- **Section Rendering API (SRA).** `?sections=` takes up to **5** IDs. "Requesting more than five sections returns 400 Bad Request and renders nothing" ([SRA best practice](https://shopify.dev/docs/storefronts/themes/best-practices/performance/use-section-rendering-api); [SRA reference](https://shopify.dev/docs/api/ajax/section-rendering)).
  - `?section_id=` returns raw HTML, or 404 for an unknown ID. Section settings can't be passed in.
  - `<script>` tags in returned HTML **don't execute**. Behavior must live in custom elements (`connectedCallback`) or in delegated listeners.
  - Shopify recommends **optimistic rendering**: insert the line from PDP data first, then reconcile with the server HTML.
- **Accelerated checkout.** Use `{% if additional_checkout_buttons %}{{ content_for_additional_checkout_buttons }}{% endif %}` ([object reference](https://shopify.dev/docs/api/liquid/objects/content_for_additional_checkout_buttons)).
  - SRA "re-renders the accelerated checkout buttons if the section it appears in is requested (for example, in a cart drawer)". The first render is slow; later renders are faster once the web components register ([Accelerated checkout](https://shopify.dev/docs/storefronts/themes/pricing-payments/accelerated-checkout)).
  - Style the buttons with `--shopify-accelerated-checkout-button-*` custom properties, and add `.additional-checkout-buttons--vertical` to stack them.
  - The buttons render in a closed shadow DOM. Track clicks on `<shop-pay-wallet-button>`, `<shopify-apple-pay-button>` and the other wallet elements, not on inner markup.

#### How Dawn's drawer works (16.x, read locally)
- **Markup.** `snippets/cart-drawer.liquid` renders `<cart-drawer>` → `#CartDrawer` → `.drawer__inner` with `role="dialog" aria-modal="true" aria-label tabindex="-1"`.
  - Inside it: `<cart-drawer-items>` (a table of line items), a status live region `#CartDrawer-LiveRegionText` (`role="status"`), `#CartDrawer-CartErrors` (`role="alert"`), `<cart-note>`, and totals with `role="status"`.
- **Opening and closing.** `assets/cart-drawer.js` closes on Escape (`keyup`) and on an overlay click. It turns `#cart-icon-bubble` into `role=button aria-haspopup=dialog`, uses `trapFocus()` / `removeTrapFocus()` from `global.js` (not `inert` or `<dialog>`), and locks scroll with `body.overflow-hidden`. `renderContents()` swaps the sections `cart-drawer` and `cart-icon-bubble` after add-to-cart.
- **Updates.** `assets/cart.js` `CartItems.updateQuantity()` sends one `POST /cart/change.js` with `{line, quantity, sections, sections_url: location.pathname}`. It replaces each section's inner HTML, re-traps focus on the same control, and writes errors to the live regions.
  - It then calls `publish(PUB_SUB_EVENTS.cartUpdate, {source:'cart-items', cartData})`, from `pubsub.js` and `constants.js`. Subscribers ignore their own `source` to avoid loops.
  - Stepper changes are debounced with `ON_CHANGE_DEBOUNCE_TIMER = 300`, and notes are debounced the same way and sent through `update.js`.
- **New in 16.x.** Dawn now emits Shopify **Standard Events** (`CartLinesUpdateEvent` with a deferred promise, `CartErrorEvent`, `CartNoteUpdateEvent`, and a `cart:view` element using `view-event-trigger="manual"`). It also ships `assets/standard-actions-override.js` (see §1b).

#### Race conditions and debouncing
Dawn debounces but does not serialize requests. If two lines change within 300 ms, both POSTs race. Practical rules:
1. Quantities sent to `change.js` and `update.js` are **absolute**, so a retry is idempotent.
2. **Serialize mutations** through a single promise queue. Coalesce pending stepper clicks per line key, so the request carries the final value.
3. Tag each request with a sequence number and only apply sections from the **latest** response.
4. Use `AbortController` only for GETs, such as an SRA refresh. Aborting a POST doesn't roll back the server-side mutation.
5. After any 4xx, re-sync from `/cart.js` plus sections. A rejected change can still have applied, as with the 400 caveat above.

#### Accessible drawer pattern
Shopify's own drawer guide (written for Hydrogen, but the pattern is framework-neutral) uses a native **`<dialog>` opened with `showModal()`** ([Build a cart drawer](https://shopify.dev/docs/storefronts/hydrogen/cart/cart-drawer)). With `showModal()`:
- The dialog renders in the top layer and makes the rest of the page inert, so Tab stays inside without a JS trap.
- Escape closes it, and focus returns to the trigger.
- `aria-labelledby` gives it a name, and `closedby="any"` closes it on a backdrop click. For browsers that don't support `closedby`, check that both `pointerdown` and `click` landed on the dialog element itself.

Shopify's theme checklist also requires visible focus, DOM-order focus, and only `0` / `-1` tabindex values ([Accessibility best practices](https://shopify.dev/docs/storefronts/themes/best-practices/accessibility)). See also the [WAI-ARIA APG modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Announce results through one polite `role="status"` region that sits **outside** the swapped HTML, for example "Quantity updated, subtotal $54.00" or "Free shaker added". Errors go in `role="alert"`.

#### Rewards and free-shipping bar: don't lie
- **Currency.** Liquid `cart.total_price` and the line prices are in the **presentment** currency ([cart object](https://shopify.dev/docs/api/liquid/objects/cart)), but theme-setting thresholds are entered in shop currency.
- **Don't convert with the JS rate.** Multiplying by `Shopify.currency.rate` disagrees with checkout. Checkout converts back at the automatic rate even when a manual rate is set, and rounding at the edges flips the result ([community thread](https://community.shopify.com/t/free-shipping-threshold-in-converted-currency/87416), **(unverified)**).
- **Honest options, best first:**
  - (a) Store thresholds per currency in **one** source that checkout also uses. Shopify's own Discount Function example reads a shop metafield `shipping.free_shipping_thresholds` keyed by currency ([Discount Function API](https://shopify.dev/docs/api/functions/2026-07/discount)), and the theme can read the same metafield.
  - (b) Theme settings with per-currency overrides.
  - (c) Rate conversion with a safety margin and "estimated" wording.
- **What the bar measures.** Compute progress on the discounted merchandise total, *excluding* shipping protection and gift lines. When it's unclear whether checkout counts those lines, err on the side of under-promising.
- **Bar text.** If the shopper's market or shipping zone can't be known before checkout, write "Free standard shipping to [country] over X", not "You've unlocked free shipping".

#### Auto-added gifts
- **Native discounts don't add the item.** A native Buy X Get Y or 100%-off automatic discount makes the gift free but **doesn't add it to the cart**; the theme or an app must do that ([community](https://community.shopify.com/t/how-to-automatically-add-a-free-gift-to-cart-with-a-purchase-of-minimum-amount/412704), [iCart guide](https://icartupsell.com/blog/shopify-free-gift-with-purchase), **(unverified)** as current behavior).
- **Recommended pattern:**
  1. The merchant creates a dedicated gift variant and an **automatic discount** that makes it free above the same threshold. Checkout enforces eligibility, so a gift added through `/cart/add.js` without qualifying simply costs full price, and that is how the pattern resists abuse.
  2. The theme adds the gift with property `_bp_gift=<tier_id>` and removes it when the cart drops below the threshold.
  3. If the shopper deletes a gift, remember "declined" per cart token in `localStorage` and don't re-add it.
- **Pitfalls:**
  - Loops: the gift's undiscounted price can push the total over the next tier. Always compute progress excluding gift lines.
  - Multiple tabs.
  - Buy-it-now and accelerated checkout from the PDP skip the cart, so no gift is added there.
  - Gifts must not count toward item-count badges, upsell exclusions or the free-shipping maths.

#### Shipping protection
- **How the apps do it.** Leading apps add an **ordinary product line item**:
  - Route's line shows up in order line-item loops and has to be filtered out ([community](https://community.shopify.com/t/exclude-route-product-from-quantity-count/44040)).
  - Seel uses an SKU `SEEL-WFP` variant priced in tiers from $0.98 ([merchant product page](https://checkout.bluettipower.com/products/worry-free-purchase.oembed), **(unverified)**).
  - Several apps also add checkout-extension toggles ([community](https://community.shopify.com/t/what-app-did-this-store-use-to-put-the-package-protection-on-the-checkout-page/281135)).
  - Navidium runs a "self-insured" model in which the merchant keeps the fee ([App Store](https://apps.shopify.com/navidium-shipping-protection)).
- **Legal risk of pre-checked defaults.** A June 2026 class action (*Mertson v. Route App*) alleges that the pre-checked widget "sneaks" fees into carts ([complaint](https://www.classaction.org/media/mertson-et-al-v-route-app-inc-complaint.pdf); [summary](https://www.classaction.org/news/class-action-lawsuit-claims-route-app-enables-unlawful-junk-fees)). These are allegations, not findings. Corso's own guidance says the line must be "transparent and obvious" ([Corso](https://help.corso.com/how-to-avoid-dark-patterns)).
- **Theme-native equivalent:**
  - The merchant creates a "Shipping protection" product: no shipping required, inventory not tracked, published to Online Store (Ajax returns 404 for variants not available on that channel), and taxability decided by the merchant.
  - The theme toggles it with `add.js` and `change.js` quantity 0.
  - Hide it from search and the sitemap with `seo.hidden = 1`, which also removes it from storefront search ([Optimize storefront SEO](https://shopify.dev/docs/apps/build/marketing/optimize-storefront-seo)). Hide it from upsells and recommendations by ID in theme settings.
  - Exclude it from rewards maths and badge counts, and never let it be the only line in the cart: if the merchandise count reaches 0, remove it.

#### Upsell and in-cart deal price
- **Source.** Read a `product_reference` metafield on the first line's product. Shopify's standard `shopify--discovery--product_recommendation.complementary_products` is a `list.product_reference` ([standard definitions](https://shopify.dev/docs/apps/build/metafields/list-of-standard-definitions)). Fall back to a collection set in theme settings, and exclude products already in the cart, gifts and protection.
- **Deal price.** Liquid can't read automatic-discount configuration before a line exists, so a "deal price" needs a real automatic discount *and* a theme-setting price.
  - Show the deal price only while the setting is on.
  - After adding the item, verify `final_price` and `line_level_discount_allocations` ([Discounts](https://shopify.dev/docs/storefronts/themes/pricing-payments/discounts)). If they don't match, show the actual price.
- **Totals.** Show line-level discounts beside each line and cart-level discounts between subtotal and total, per Shopify's guidance. The "Bundle discount" line is the sum of the allocations, labelled with `discount_application.title`.

### 1b. Standard storefront events and actions (added at coordinator's request)

- **What they are.** Announced 2026-06-17 ([changelog](https://shopify.dev/changelog/posts/standard-storefront-events-and-actions); [overview](https://shopify.dev/docs/api/storefront-events-and-actions); [theme guide](https://shopify.dev/docs/storefronts/themes/best-practices/standard-events-and-actions)).
  - **Events** are DOM events with a `shopify:` prefix, such as `shopify:page:view`, `shopify:product:view`, `shopify:cart:view`, `shopify:cart:lines-update`, `note-update`, `attributes-update`, `discount-update`, `shopify:cart:error` and `shopify:search:update`. The theme dispatches them from the element where the interaction happened, using classes from `https://cdn.shopify.com/storefront/standard-events.js` ([Dispatch events](https://shopify.dev/docs/api/storefront-events-and-actions/events/dispatch)).
  - View events can be declared in Liquid with `createViewEventElement()` plus the `standard_event_data` filter. Triggers are `connect`, `intersect`, `dialog` or `manual`.
  - **Actions** are `window.Shopify.actions.getCart`, `openCart` and `updateCart` ([Actions](https://shopify.dev/docs/api/storefront-events-and-actions/actions)). `updateCart` writes through the **Storefront API**, accepts lines, note, discount codes, attributes and `sellingPlanId` (the attributes value *replaces* the existing set), and emits the cart events itself ([updateCart](https://shopify.dev/docs/api/storefront-events-and-actions/actions/update-cart)).
- **Who calls them.** "An app or an AI agent calls an action" ([overview](https://shopify.dev/docs/api/storefront-events-and-actions)), meaning third-party app scripts and on-page agents.
  - I found no source saying that Shop Pay or accelerated checkout call them **(unverified)**.
  - Server-side agent carts use Cart MCP/UCP ([Build a cart with Cart MCP](https://shopify.dev/docs/agents/get-started/build-a-cart)) and never touch the drawer. The drawer only sees those changes on its next render.
- **Must a custom drawer configure them?** Not for correctness. Every Liquid storefront gets default handlers.
  - However, the default `updateCart` "refreshes the cart in place on a theme it recognizes. If it recognizes none, then it falls back to a full page reload", and `openCart` falls back to `/cart` when it finds no drawer ([Configure actions](https://shopify.dev/docs/api/storefront-events-and-actions/actions/configure)).
  - A bespoke Blueprint drawer won't be recognized, so an app's upsell would reload the page. **In practice, configure both.**
  - **Only the first `configure()` call wins.** Shopify says to register inside a `DOMContentLoaded` listener placed **above `{{ content_for_header }}`**, so the theme registers before apps do. Dawn registers from a deferred asset instead.
  - The `eventTarget` option is required for `updateCart`.
  - Don't dispatch your own cart event after an `updateCart`, or listeners see the change twice. Do dispatch events for changes the theme makes through Ajax.
  - These events fire **regardless of consent**. Use web pixels for analytics ([Listen for events](https://shopify.dev/docs/api/storefront-events-and-actions/events/listen)).
- **Performance.**
  - Storefront Renderer injects the actions runtime as a module script, which runs after parsing, so calls made before then throw `TypeError` ([standard actions](https://shopify.dev/docs/storefronts/themes/best-practices/standard-actions)).
  - The events library is one extra CDN ES-module request.
  - Byte sizes aren't documented **(unverified)**; measure them.
  - Payload validation runs only under `shopify theme dev` (`--standard-events-inspector`), not in production.
  - Dawn's override adds one extra `GET /cart.js` and one SRA GET per app-initiated update.

### 2. Pre-landers on Shopify

- **Templates.** Use alternate templates `templates/page.advertorial.json`, `page.listicle.json` and `page.comparison.json`, assigned per page (`page.template_suffix`), or previewed with `?view=advertorial` ([Alternate templates](https://shopify.dev/docs/storefronts/themes/architecture/templates/alternate-templates)). A theme can hold up to 1,000 JSON templates, each with 25 sections.
- **Minimal header.** A JSON template's root `"layout"` key selects `layout/<name>.liquid` ([JSON templates](https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates)). A `layout/landing.liquid` that renders `{% sections 'landing-header-group' %}` therefore gives pre-landers their own header group, editable in the theme editor ([section groups](https://shopify.dev/docs/storefronts/themes/architecture/section-groups)).
  - `"layout": false` removes theme-editor customization. Avoid it.
  - A per-section "hide header" toggle can't reach the layout's `<head>`, so choosing a layout is the cleaner switch.
- **Pixels and analytics.** Web pixels (app and custom) load on online-store pages through the event bus and honor consent ([About web pixels](https://shopify.dev/docs/apps/build/marketing/pixels)).
  - The landing layout **must** output `{{ content_for_header }}`; without it, Shopify scripts and pixels won't load (inferred from the [Layouts](https://shopify.dev/docs/storefronts/themes/architecture/layouts) requirements).
  - Same-domain pre-landers keep the Meta, TikTok and GA cookies first-party.
  - Keeping `content_for_header` as a plain tag inside `<head>` on a JSON-template page keeps the page eligible for **HTML streaming** ([platform performance](https://shopify.dev/docs/storefronts/themes/best-practices/performance/platform)).
- **noindex.**
  - Native option: a page metafield `seo.hidden` (integer `1`) adds noindex/nofollow, removes the page from the sitemap and from storefront search, and is removed by deleting the metafield ([Optimize storefront SEO](https://shopify.dev/docs/apps/build/marketing/optimize-storefront-seo); [Shopify blog](https://www.shopify.com/blog/noindex-shopify-page)). Apps may already own this definition ([community](https://community.shopify.com/t/seo-hidden-not-working/333427)).
  - Theme option: the landing layout emits `<meta name="robots" content="noindex">` when a global setting "noindex pre-landers" is on, or when a page boolean metafield is set. The layout can read `page.metafields`, but not template section settings.
- **URL parameters and SSR.**
  - `?variant=` and `?selling_plan=` are **native and server-rendered**. `product.selected_variant`, `selected_or_first_available_variant` and `selected_selling_plan` all honor them ([product object](https://shopify.dev/docs/api/liquid/objects/product)), so they cause no CLS.
  - Liquid **can't read arbitrary query parameters**. The [`request` object](https://shopify.dev/docs/api/liquid/objects/request) exposes path, host, page_type and locale only, so `tier` and `plan` are client-only.
  - Shopify doesn't document how its full-page cache keys query strings **(unverified)**.
  - Merchants report that variant URLs lose other parameters when theme JS rewrites the URL ([community](https://community.shopify.com/t/campaigm-utm-url-paramaters-being-removed-from-product-pages/68923)). Capture UTMs and click IDs before any `history.replaceState`.
- **Disclosure.**
  - FTC native-advertising guidance: label ads that could pass as editorial ("Advertisement" or "Sponsored"), with the label placed before or above the headline ([FTC guide](https://www.ftc.gov/tips-advice/business-center/guidance/native-advertising-guide-businesses); placement per [Wiley](https://wiley.law/alert-FTC_Provides_Guidance_on_Native_Advertising)).
  - The 2023 Endorsement Guides (16 CFR 255) require "clear and conspicuous" disclosure of material connections ([Manatt](https://www.manatt.com/insights/newsletters/advertising-law/an-in-depth-look-at-the-ftcs-updates-2)).
  - The Consumer Reviews and Testimonials Rule (16 CFR 465, in force since 2024-10-21) carries civil penalties for fake or insider testimonials and for review suppression ([FTC final rule](https://www.ftc.gov/system/files/ftc_gov/pdf/r311003consumerreviewstestimonialsfinalrulefrn.pdf)). Advertorial "editor" personas and testimonials must be real or disclosed.

### 3. Reviews and UGC integrations

- **Shopify's standard.** Shopify defines `reviews.rating` (type `rating`, with `value`, `scale_min` and `scale_max`) and `reviews.rating_count` (`number_integer`). "Themes that display product ratings should reference this metafield" ([standard definitions](https://shopify.dev/docs/apps/build/metafields/list-of-standard-definitions)).
  - These metafields are API-only (not editable in admin). The newer `product_review` standard **metaobject** program requires apps to keep them in sync ([standard review metaobject](https://shopify.dev/docs/apps/build/metaobjects/standard-review-metaobject)).
  - Dawn's `card-product.liquid` and `featured-product.liquid` read `metafields.reviews.rating.value.rating`, `.scale_max` and `reviews.rating_count`.
  - Dawn's `{{ product | structured_data }}` example output has **no `aggregateRating`** ([structured_data](https://shopify.dev/docs/api/liquid/filters/structured_data)), so rich results come from apps.

| App | App embed and blocks | Writes `reviews.*`? | Own metafields | JSON-LD |
|---|---|---|---|---|
| Judge.me | Embed required; star badge, review widget, carousels, all-reviews page ([widgets](https://judge.me/help/en/articles/8415708-overview-of-the-judge-me-widgets), [carousel](https://judge.me/help/en/articles/11625803-testimonials-carousel)) | Yes, per Judge.me ([help](https://judge.me/help/en/articles/8394936-displaying-product-ratings-and-review-counts-with-judge-me-metafields)) | Store-wide average and app-namespaced fields; exact keys **(unverified)** | App-injected; can duplicate theme schema ([ryze](https://www.get-ryze.ai/blog/review-and-rating-schema-for-shopify-without-breaking-rich-results), **(unverified)**) |
| Okendo | "Okendo Reviews" embed required; Reviews Widget, Star Rating, Reviews Carousel, Media Grid/Carousel, Badge ([OS2.0 install](https://support.okendo.io/en/articles/5537298-installing-okendo-on-shopify-online-store-2-0), [carousel](https://docs.okendo.io/on-site/on-site-widgets/reviews-carousel-widget)) | **(unverified)** | `okendo.summaryData` (JSON) | Reads `okendo` metafields ([rich snippets](https://support.okendo.io/en/articles/3813081-set-up-google-rich-snippets-for-product-ratings)) |
| Yotpo | "Yotpo Reviews" embed; Reviews Widget and Star Rating 3.0 blocks ([OS2.0](https://support.yotpo.com/shopify-installing-yotpo-reviews-on-online-store-20)) | Yes, via "Shopify Metafields Sync" on Starter plan and above ([rich snippets doc](https://support.yotpo.com/docs/yotpo-reviews-rich-snippets)) | `yotpo.reviews_average` / `reviews_count` **(unverified)** | Yotpo rich-snippet feature |
| Loox | App blocks added from Loox "Widgets" → "Add to theme": Star Rating, Product Reviews, carousels ([OS2.0](https://help.loox.io/article/681-adding-loox-widgets-to-your-store), [carousels](https://help.loox.io/article/607-loox-carousel-widgets)) | Yes, both namespaces on every publish ([Loox](https://help.loox.io/support/solutions/articles/501000353558-shopify-standard-metafields-for-loox-reviews)) | `loox.avg_rating`, `loox.num_reviews` | **(unverified)** |
| Stamped | Main widget, badge span `stamped-product-reviews-badge` ([install](https://stampedsupport.stamped.io/hc/en-us/articles/8866686727579)) | Lists `reviews.*` equivalents, but metafield sync is "as-requested" and Stamped *recommends against* relying on it ([metafields](https://stampedsupport.stamped.io/hc/en-us/articles/8868043217947-Shopify-s-Metafields-data)) | `stamped.reviews_average`, `stamped.reviews_count` | Widget-driven |

- **Performance.** No controlled benchmark exists. One audit found Judge.me and Stamped had no measurable impact on blocking time, and Loox a low impact ([hyperspeed](https://hyperspeed.me/blog/?p=1212), **(unverified)**). Some apps add "100KB+" per PDP ([fudge](https://www.fudge.ai/blog/best-shopify-review-apps/), **(unverified)**).
  - The structural point holds regardless: app embeds load site-wide, and app widgets need JS.
  - Native stars from metafields cost no JS, and they survive SRA re-renders. App badge scripts don't re-run in SRA HTML.
- **App blocks.** App blocks need JSON templates and sections whose schema allows `{"type":"@app"}`. They are not supported in statically rendered sections ([App blocks](https://shopify.dev/docs/storefronts/themes/architecture/blocks/app-blocks)). Dawn's `main-product`, `featured-product`, `main-cart-footer`, `header`, `footer` and `apps` sections all allow them.

### Implications for Blueprint

#### A. Cart drawer architecture
**Components (custom elements; behavior in `assets/`):**
- `<bp-cart-drawer>`: wraps a native `<dialog>` with `showModal()`, `aria-labelledby` pointing at the "Your cart (n)" heading, and `closedby="any"`. Its trigger is a real `{{ routes.cart_url }}` link (progressive enhancement). Focus returns to the trigger.
- `<bp-cart-lines>`: steppers and remove buttons. A mutation queue coalesces input per line key with a 300 ms debounce.
- `<bp-rewards-bar>`: server-rendered from settings tiers. Its progress basis is merchandise lines (excluding gifts and protection) after discounts, in presentment currency. Thresholds come from a per-currency map (shop metafield or settings), with an "estimated" fallback.
- `<bp-gift-sync>`: a pure function `(cart JSON, tiers) → {add[], remove[]}` that targets gift variants by ID, tags them with `_bp_gift`, and remembers declines in `localStorage` keyed by cart token.
- `<bp-protection-toggle>`: a switch with the visible price and the text "Loss, theft and damage covered". The default comes from a setting, but **default-on only adds once per cart and never re-adds after a removal**. The line is always visible, with a one-tap remove.
- `<bp-upsell>`: product metafield, then the complementary standard metafield, then a collection fallback. Excludes items in the cart, gifts and protection. The deal price shows only when the setting is on, and is verified after the add.
- Totals (subtotal, bundle discount from allocations, total), "Secure checkout", payment icons and `content_for_additional_checkout_buttons`.
- Empty state: best-seller collection with native stars.
- A live region `#bp-cart-status` and `role="alert"` errors, both kept **outside** the swapped HTML.

**Events.** Internal pubsub `cart:updated {source, cart}`, Dawn-compatible (`PUB_SUB_EVENTS.cartUpdate`). Standard Events `CartLinesUpdateEvent`, `CartErrorEvent`, `CartNoteUpdateEvent` and the `cart:view` view element (trigger `dialog`) for theme-initiated changes only.
- `Shopify.actions.openCart.configure` opens the dialog.
- `updateCart.configure({eventTarget: () => drawer, handler})` calls `defaultHandler()`, then one SRA GET for the drawer sections, then gift sync, then publishes `cart:updated` with `source:'standard-action'`.
- Register both inside a `DOMContentLoaded` listener placed above `{{ content_for_header }}`.

**Requests per interaction** (sections ≤ 3: `cart-drawer`, `cart-icon-bubble`, `cart-status`):

| Interaction | Requests |
|---|---|
| Add to cart (PDP) | 1 × `add.js` + sections, rendered optimistically. A second `update.js` only if a gift tier is crossed (gift add/remove and qty in one call). |
| Qty step / remove | 1 × `change.js` + sections, plus at most 1 × `update.js` reconcile when a tier changes. |
| Protection toggle | 1 × `add.js` or `change.js`(0) + sections. |
| Upsell add | 1 × `add.js` + sections, then a client-side check of `final_price`. |
| Note | 1 × debounced `update.js {note}`, no sections. |
| App/agent `updateCart` | Storefront API write (Shopify), plus 1 SRA GET, plus a possible gift `update.js`. |
| Drawer open | 0 (already rendered). Re-sync GET only if the cart token or `item_count` cookie changed since render. |

#### B. Pre-lander URL-parameter contract
- **Templates.** `page.advertorial.json`, `page.listicle.json` and `page.comparison.json`, using `"layout": "landing"`. `layout/landing.liquid` keeps `{{ content_for_header }}` and renders `{% sections 'landing-header-group' %}` (minimal or hidden). It shows a "Sponsored/Advertisement" label above the headline when the advertorial setting is on.
- **noindex.** Primary: the page metafield `seo.hidden = 1` (native). Secondary: a landing-layout setting "noindex all pre-landers" emitting a robots meta tag.
- **CTA product picker.** A `product` setting plus `tier` and `plan` selects. **Liquid builds the CTA URL server-side**:
  `{{ product.url }}?variant=<id>&selling_plan=<id if plan=sub>&tier=<handle>&plan=<sub|once>` plus UTMs appended in JS.

**Parameters:**

| Param | Values | Resolved | Validation and fallback |
|---|---|---|---|
| `variant` | numeric ID | **SSR** (native) | Must belong to the product. If unknown, Shopify falls back to the first available variant. |
| `selling_plan` | numeric ID | **SSR** (native) | Ignored if it isn't in the variant's allocations. |
| `tier` | `1`–`3` or a tier handle | **JS** | Must match a configured tier; otherwise use the merchant's default tier. If tiers are variants (a "Pack" option), the CTA also sets `variant`, so SSR covers it. |
| `plan` | `sub`, `once` | **JS** (mirrors `selling_plan`) | `sub` without a valid plan becomes `once`. |
| `utm_*`, `fbclid`, `ttclid`, `gclid` | passthrough | JS | Copied from the pre-lander URL into the CTA. Never stripped. |

- **Precedence.** `variant` > tier-mapped variant > default. `selling_plan` > `plan` > the product's default purchase option.
- **Avoiding CLS.** Add a tiny inline script before the tier picker that reads `location.search` and sets `data-bp-tier` / `data-bp-plan` on `<html>`. CSS shows the checked state with the same box sizes, so nothing shifts.
- **Errors and state.** Invalid input fails silently to the defaults. The PDP never calls `replaceState` until it has captured attribution parameters, and it then preserves them.

#### C. Reviews integration pattern
1. **Native snippet `bp-rating`.** Reads `product.metafields.reviews.rating.value` and `reviews.rating_count`. Used on cards, the PDP title, the upsell, the empty-cart best sellers and comparison tables. It costs no JS and survives SRA.
2. **Provider setting** (`auto | standard | judgeme | okendo | yotpo | loox | stamped | none`). In `auto`, the theme reads `reviews.*` first, then the app namespaces (`loox.*`, `stamped.*`, `yotpo.*`, `okendo.summaryData`). If none are present it renders nothing; it never shows 0 stars.
3. **App widget slots.** `@app` block slots in the main product, featured product, pre-lander and `apps` sections, for widgets, carousels and UGC galleries. Don't place a native star block and an app star block side by side by default.
4. **JSON-LD.** The theme emits `aggregateRating` only when the setting "Theme outputs rating schema" is on, and that setting defaults to off, because apps inject their own schema. This avoids duplicates.
5. **Merchant documentation.** Explain how to enable each app's standard-metafield sync (Yotpo "Shopify Metafields Sync"; Stamped on request) and how to toggle each app embed. Note that review content shown on pre-landers is subject to 16 CFR 465.

**Skeleton-preview note.** If Blueprint later adopts the Liquid-first developer preview (`{% block %}` / `{% partial %}`), the drawer's server HTML can be a `{% partial 'cart-drawer' %}` region refreshed with `partials.fetch()` and `apply()`, instead of SRA ([Developer preview](https://shopify.dev/docs/storefronts/themes/getting-started/developer-preview)). App blocks still require JSON templates, so pre-landers and the PDP must stay JSON.

---

## Part 4: Performance strategy and competitive teardown

Research date: 2026-10-23.

**How this was sourced.** shopify.dev pages were read through Shopify's docs search (`search_docs_chunks`), which returns the page text verbatim. Third-party pages could not be opened directly because the sandbox proxy blocked outbound page fetches. Those claims come from search-result extracts of the linked pages, and they are marked "(vendor)" when the publisher sells a competing product or service. The Dawn figures were measured by me from a shallow clone of `Shopify/dawn` at commit `05222537` (2026-10-22, `theme_version` 16.0.0). Anything I could not confirm is marked **(unverified)**.

---

### 1. Performance

#### 1.1 How the LCP image should work on Shopify

- **Use `image_url` + `image_tag` and pass explicit `widths` and `sizes`.** The filters generate the `srcset` and the `width`/`height` attributes, and they serve the image from the CDN ([Performance best practices](https://shopify.dev/docs/storefronts/themes/best-practices/performance)). Shopify says to avoid JS-computed or "auto" sizes on LCP images, because the browser can't choose a source until the script has run ([Never lazy-load the LCP image](https://shopify.dev/docs/storefronts/themes/best-practices/performance/never-lazy-load-lcp-image)).
- **Shopify's full recipe for the LCP image:** `loading: 'eager', fetchpriority: 'high', preload: true`, applied only when the section is above the fold ([Use image_url and image_tag](https://shopify.dev/docs/storefronts/themes/best-practices/performance/use-shopify-image-filters-efficiently)).
- **`preload: true` on `image_tag`** sends a `Link: rel=preload` response header (which can travel as a 103 Early Hint) and adds no `<link>` tag to the HTML ([Early Hints at Shopify](https://performance.shopify.com/blogs/blog/early-hints-at-shopify)). There is a catch: Shopify sends **at most 10 preload Link headers**, filled in this order:
  1. automatic render-blocking preloads
  2. `stylesheet_tag: preload`
  3. other preloads, such as fonts
  4. scripts
  5. **images last**

  A `<head>` with 10 or more render-blocking resources therefore silently drops the LCP image preload ([Use preload resource hints sparingly](https://shopify.dev/docs/storefronts/themes/best-practices/performance/use-preload-resource-hints-sparingly)). Shopify also says to keep your own preloads to two or fewer.
- **Above-the-fold detection.** `section.index` is `nil` in the theme editor, in static sections and in the Section Rendering API. Write the test as `unless section.index > N` so that `nil` falls through to the eager path. The default `image_tag` behaviour already loads eagerly for the first 3 sections and whenever the index is `nil` ([section.index guide](https://shopify.dev/docs/storefronts/themes/best-practices/performance/use-section-index)). For grids, use `forloop.index <= 4` to pick which cards load eagerly.
  - **Blueprint caveat:** Blueprint renders the page directly from templates and blocks, with no sections, so `section.index` may not be available. The template should pass an explicit `above_fold`/`priority` parameter into the media block instead (inference from the repo conventions).
- **No fade-ins on the LCP element.** Chrome ignores `opacity:0` elements as LCP candidates, so a reveal animation pushes LCP back to the moment the animation runs. Shopify cites a case where mobile LCP fell from 3.6 s to 2.2 s after a hero fade was removed ([Don't hide the LCP image behind animations](https://shopify.dev/docs/storefronts/themes/best-practices/performance/dont-hide-lcp-image-behind-animations)).
- **No CSS `background-image` for LCP content** ([background-image guide](https://shopify.dev/docs/storefronts/themes/best-practices/performance/avoid-background-images-hero)).
- **What Dawn 16.0.0 actually does (measured).** In `snippets/product-media-gallery.liquid`, the first PDP image gets `lazy_load: false`, which makes it eager. `snippets/product-thumbnail.liquid` sets no `fetchpriority` and no `preload`. **This is a concrete, verifiable edge over Dawn on the PDP.**
- **Mobile `sizes` for a PDP gallery.** A typical value is `(min-width: 990px) 55vw, 100vw`. Pair it with `widths: '360, 540, 720, 900, 1080, 1296, 1512'`, because a 100vw image on a 3× DPR phone needs about 1080–1200 px. Check the result with the Responsive Image Linter, as Shopify recommends.

#### 1.2 Fonts

- **Both fonts are in the Shopify font library.**
  - DM Sans: `dm_sans_n1`…`dm_sans_i9`, all weights and italics.
  - Instrument Serif: **only `instrument_serif_n4` and `instrument_serif_i4`**.

  Source: [Fonts — available fonts](https://shopify.dev/docs/storefronts/themes/architecture/settings/fonts).
  - **Design implication:** Editorial headings cannot use a real bold. Set `font-synthesis: none` (or weight 400 only) so browsers don't produce a faux bold.
- **Library mechanics.** A `font_picker` setting returns a `font` object. `font_face` emits `@font-face`, `font_url` returns the CDN URL, and `font_modify` gives you other weights and styles ([Fonts](https://shopify.dev/docs/storefronts/themes/architecture/settings/fonts)).
  - **`font_face` adds no `font-display` unless you pass `font_display: 'swap'`.** Without it, Chrome treats the font as `block`, which can hide text for up to 3 s ([Reduce CLS from font swapping](https://shopify.dev/docs/storefronts/themes/best-practices/performance/reduce-cls-font-swapping)).
  - **Library fonts come from `fonts.shopifycdn.com`.** Dawn adds a manual `<link rel="preconnect" href="https://fonts.shopifycdn.com" crossorigin>` (measured, `layout/theme.liquid:15`) and preloads the body and heading fonts with `font_url`.
- **Self-hosted alternative.** Put subset woff2 files in `assets/`. They are then served from the store's own domain under `/cdn/`, so the browser reuses the existing connection and needs no extra DNS/TCP/TLS round trips ([Serve assets from Shopify CDN](https://shopify.dev/docs/storefronts/themes/best-practices/performance/use-shopify-cdn); [Self-host web fonts](https://shopify.dev/docs/storefronts/themes/best-practices/performance/self-host-web-fonts)).
  - Inline the `@font-face` rules in `<head>` above `content_for_header`.
  - Preload with `preload_tag: as: 'font', type: 'font/woff2'`. It adds `crossorigin` itself; don't pass it.
  - Shopify's guidance is 1–2 families, 2–4 weights each, and no more than 6 font files in total.
  - DM Sans and Instrument Serif are both SIL OFL, so self-hosting is allowed (from general knowledge; **(unverified)** against the font files' licence text).
  - Expected size: a Latin-subset woff2 is roughly 15–25 KB per static weight, so a single DM Sans variable file might be around 35–50 KB **(unverified estimates; measure after subsetting)**.
- **Recommended hybrid.** Keep `font_picker` so merchants can still choose a font, but detect the defaults, e.g. `settings.type_body_font.family == 'DM Sans'`.
  - When a default is in use, serve the self-hosted subsets and preload only the body regular weight.
  - Otherwise, fall back to `font_face: font_display: 'swap'` plus the preconnect.
- **Avoid CLS on font swap.**
  1. Set a unitless `line-height`.
  2. Define metric-matched fallback faces (`size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` on `local(Arial)` / `local("Times New Roman")`), generated with Fontaine or Capsize.

  Shopify says font swap can account for 0.05–0.15 CLS on text-heavy pages ([Reduce CLS from font swapping](https://shopify.dev/docs/storefronts/themes/best-practices/performance/reduce-cls-font-swapping)). A heavier but simpler option is to preload Instrument Serif only on the Editorial preset.

#### 1.3 JavaScript budget

- **Shopify's guidance:**
  - Avoid frameworks and jQuery.
  - Prefer CSS over JS.
  - `defer` non-critical scripts. `script_tag` can't emit `defer`, so write the `<script>` tag by hand ([Defer render-blocking CSS and JS](https://shopify.dev/docs/storefronts/themes/best-practices/performance/defer-non-critical-resources)).
  - Load features on interaction with dynamic `import()`, triggered by click, hover/focus, visibility or idle ([Load JS on user interaction](https://shopify.dev/docs/storefronts/themes/best-practices/performance/load-javascript-on-user-interaction)).
  - Shopify's app guidance aims for a JS bundle of ≤ 16 KB minified, and ≤ 10 KB JS / ≤ 50 KB CSS for an app's entry point ([App performance best practices](https://shopify.dev/docs/apps/build/performance/general-best-practices)).
  - Shopify minifies theme CSS and JS automatically unless a file is already named `.min.*` ([The Shopify platform](https://shopify.dev/docs/storefronts/themes/best-practices/performance/platform)).
- **Dawn 16.0.0 PDP baseline (measured).** Default settings: cart drawer and scroll animations on, predictive search on. Sizes are from `wc -c` on the source files and `gzip -9` of the unminified files, so the bytes on the wire will be a little smaller after Shopify minifies and Brotli-compresses them.

  | Asset group | Files | Raw | gzip |
  |---|---|---|---|
  | JS (global.js 47.5 KB raw / 11.1 KB gz is the largest; product-info.js 17.5 KB; cart.js 17.0 KB; predictive-search.js 9.6 KB; standard-actions-override.js 6.1 KB; cart-disclosure-modal.js 5.8 KB …) | ~21 | **~142 KB** | **~38 KB** |
  | CSS (base.css 81.4 KB raw / 13.5 KB gz; section-main-product.css 32.3 KB; component-card.css 14.1 KB; cart-items 12.6 KB …) | ~27 | **~209 KB** | **~44 KB** |

  Much of this code serves features a single-hero-SKU PDP rarely uses: predictive search, localization, cart-notification/drawer code loaded up front, `quantity-popover`, `price-per-item`, `magnify`/`product-modal`, and `pickup-availability`.
  - **Implication:** "< 50 KB JS" measured compressed is not much tighter than Dawn's ~38 KB gz. To actually beat Dawn, Blueprint needs **≤ 20–25 KB compressed of theme JS on initial PDP load**.
- **Shopify's own JS, which counts in Lighthouse and which the theme can't control:**
  - `content_for_header` injects platform scripts: analytics/Trekkie, web-pixels-manager, perf kit, consent tracking. It can't be deferred or edited ([Defer render-blocking](https://shopify.dev/docs/storefronts/themes/best-practices/performance/defer-non-critical-resources); [corewebvitals.io Shopify guide](https://www.corewebvitals.io/core-web-vitals/shopify-guide)).
  - On the PDP, **dynamic checkout buttons** (Shop Pay and other wallets) add the payment-button stylesheet and script ([Load first-paint resources before content_for_header](https://shopify.dev/docs/storefronts/themes/best-practices/performance/load-critical-resources-before-content-for-header)).
  - Every installed pixel runs in the web-pixels sandbox ([Shopify Help — pixels](https://help.shopify.com/en/manual/promoting-marketing/pixels/overview)).
  - I found **no published KB measurement** for these scripts. My working estimate is 100–250 KB compressed of Shopify-owned JS on a PDP with Shop Pay **(unverified; measure with DevTools Coverage, filtering `/cdn/shopifycloud/`, `/checkouts/internal/`, `shop.app`)**.
  - For Lighthouse, this platform JS is a large share of TBT, "Reduce unused JavaScript" and main-thread work, and it is identical for Blueprint and Dawn. Theme JS is therefore the variable Blueprint controls.
- **Keep `content_for_header` in place.** Leave it inside `<head>` and unmodified, because wrapping or moving it disables HTML streaming ([The Shopify platform](https://shopify.dev/docs/storefronts/themes/best-practices/performance/platform)). Put critical CSS, font preloads and the import map *above* it.

#### 1.4 CLS: announcement bar, sticky ATC, media

- **Announcement bar**
  - Render it server-side in normal flow, with a fixed `min-height`.
  - Don't inject it with JS or insert it after paint.
  - A rotating or marquee bar should animate with `transform` only.
  - Dismissal should remove the bar *only after user input*, which keeps the shift inside the 500 ms input exclusion window, or should collapse it at the next navigation.
- **Sticky ATC**
  - Use `position: fixed` and reveal it with `transform: translateY(100%) → 0`, toggled by an IntersectionObserver on the main ATC button.
  - Never insert it into normal flow.
  - Reserve body bottom padding up front, or overlay the bar.
  - Make the reveal instant under `prefers-reduced-motion: reduce`.
- **App-injected widgets** (stars under the title, trust/payment rows, delivery estimates): reserve `min-height` on the app block wrapper per breakpoint and add an `:empty` skeleton. Cookie banners and chat bubbles should be `position: fixed` ([Reserve space for app-injected content](https://shopify.dev/docs/storefronts/themes/best-practices/performance/reserve-space-app-injected)).
  - **This is the biggest real-world CLS source for supplement and skincare stores**, which run Judge.me, Okendo or Loox reviews, Recharge or Skio subscriptions, and Kaching-style bundles.
- **Images:** keep the `width`/`height` attributes from `image_tag` and use `aspect-ratio` boxes for galleries and video posters.
- **Below-the-fold sections:** `content-visibility: auto` with `contain-intrinsic-size: auto 600px`. This is a general web technique; I found no Shopify doc on it.
  - **Caveat:** an intrinsic size estimate that is too small can itself cause layout shift when the user scrolls.

#### 1.5 Shopify-specific Lighthouse realities

- **Theme Store bar:** a minimum average Lighthouse performance score of **60** across the home, product and collection pages, on desktop and mobile, plus a minimum average accessibility score of **90**. Shopify tests on its own benchmark dataset, with real images and content ([Theme Store requirements](https://shopify.dev/docs/storefronts/themes/store/requirements)).
- **Shopify's weighted "speed score":** home 17%, product 40%, collection 43%. You can replicate the benchmark with a dev store, Shopify's test-product CSV, a preview URL with `pb=0`, and the median of ≥ 3 runs ([Testing for performance](https://shopify.dev/docs/storefronts/themes/best-practices/performance/testing-for-performance)). Apps are judged the same way: Built for Shopify allows at most a 10-point drop ([BFS requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements)).
- **Field data:** the Web Performance dashboard (private RUM) and CrUX at p75 over 28 days ([Lab vs field](https://shopify.dev/docs/storefronts/themes/best-practices/performance/lab-vs-field)). Shopify also publishes a per-theme CWV pass-rate table ([performance.shopify.com theme table](https://performance.shopify.com/pages/theme-performance-data-table)). Third-party reads of that table give Dawn ≈ 84.9% passing, Impulse ≈ 89–91%, and Prestige ≈ 89–90% ([thunderpagespeed, vendor](https://www.thunderpagespeed.com/blog/shopify-theme-speed-comparison/); [magedelight](https://www.magedelight.com/blog/best-shopify-themes/)). Those are field pass rates on merchants' real stores, not lab scores.
- **Lighthouse scoring:** TBT 30%, LCP 25%, CLS 25%, FCP 10%, SI 10% ([Lighthouse score calculator](https://unlighthouse.dev/tools/lighthouse-score-calculator)).
  - Mobile emulation is Slow 4G (1.6 Mbps, 150 ms RTT) with a 4× CPU slowdown ([Improve mobile page load speed](https://shopify.dev/docs/storefronts/themes/best-practices/performance/improve-mobile-page-load-speed)).
  - PageSpeed Insights reportedly uses a lower effective CPU multiplier than local DevTools runs **(unverified; [IndieHackers citing DebugBear](https://www.indiehackers.com/post/why-your-mobile-pagespeed-score-refuses-to-budge-even-after-desktop-hits-95-b70859dace))**. PSI and DevTools scores are therefore not interchangeable.
- **Published Dawn numbers (lab, no apps):** about 90–97 on mobile, e.g. "92 PSI mobile, 1.8 s LCP" ([thunderpagespeed, vendor](https://www.thunderpagespeed.com/blog/fastest-shopify-themes/)). One ranking lists Dawn at 67 ([koala-apps](https://koala-apps.io/best-shopify-themes/fastest/)). Methods differ and most numbers are for the home page, and **I found no rigorous public PDP-specific Dawn benchmark.**
- **Real stores:**
  - Median mobile score of 47 across 1,533 stores (Beauty & Personal Care median 40). Stores with 0–5 third-party services had a median of 74, versus 44 for stores with 21–30 ([EcomHint benchmark, vendor](https://ecomhint.com/blog/shopify-speed-benchmark)).
  - A 47k-store scrape found a median of 53, a median mobile LCP of 10.1 s, and app count as the strongest predictor ([Shopify Community](https://community.shopify.com/t/i-spent-800-hours-scraping-47-000-shopify-stores-actually-heres-the-data-on-themes-niches-apps-and-speed/615505)).
- **Ways to beat Dawn, all verifiable on the same store:**
  1. `fetchpriority="high"` plus a `preload: true` header on the PDP hero, which Dawn lacks.
  2. Fewer render-blocking stylesheets. Dawn links ~27 CSS files on a PDP, and anything past 10 overflows the preload budget and pushes the image preload out.
  3. Inline a small critical CSS block and load component CSS per block.
  4. Load drawer, search, localization, zoom/modal and quantity-popover JS on interaction.
  5. Self-host subset fonts on the same origin.
  6. Turn scroll-reveal off by default. Dawn ships `animations.js` and reveal classes.
  7. Make the dynamic checkout button an explicit merchant choice.

---

### 2. Competitive teardown

#### 2.1 Who actually wins supplements and skincare

- **Dawn (free) leads adoption.** It holds about 13% of health/supplement stores ([CommerceRank](https://www.commercerank.ai/guides/themes/best-supplement-themes)) and about 15% overall in ShopThemeDetector's data.
- **Paid themes:** in ShopThemeDetector's supplement cohort, **Prestige (4.4%)** and **Impulse (4.0%)** lead, followed by Broadcast at 1.7% ([ShopThemeDetector supplements](https://shopthemedetector.com/blog/shopify-theme-for-a-supplement-store/)).
- **Beauty and skincare:** the most-cited Theme Store themes are **Be Yours** (RoarTheme), **Sleek** (FoxEcom) and Symmetry, and **Minimog** dominates ThemeForest ([ShopThemeDetector H&B](https://shopthemedetector.com/blog/best-shopify-health-beauty-themes/); [tinyseo](https://tinyseo.com/best-shopify-themes/for-beauty-stores/)).
- **Paid-social "CRO themes":** Shrine/Shrine Pro, Booster and Elixir are bought by exactly Blueprint's buyer, the paid-social DTC brand. They sit outside the Theme Store.
- **Chosen top 3 for the vertical:** Be Yours, Sleek and Minimog. Market share figures for these are thin **(unverified)**.

#### 2.2 Comparison table

| Theme | Price | Buy box (qty breaks / bundles / subs / sticky ATC / badges) | Cart drawer (upsell / rewards bar / ship protection) | Landers / presets | Speed evidence | Common complaints |
|---|---|---|---|---|---|---|
| **Dawn** (Shopify) | Free | Native volume pricing (Plus), selling-plan picker, no qty-break UI, no sticky ATC, no badges | Drawer; no upsell or rewards | No landers; style presets only | Lab ~90+ clean (vendor); field CWV pass ≈ 85% (Shopify table via 3rd parties) | Lacks CRO features, so merchants add apps and the speed lead disappears |
| **Impulse** (Archetype / WeCommerce) | $400 (one locale shows $450) ([Theme Store](https://themes.shopify.com/themes/impulse)) | Sales points, product tabs, quick buy; no native sticky ATC listed; no qty breaks | Slide-out cart, cross-sell; no free-ship bar listed | Presets incl. Impulse, Terrain, Apothecary | Field pass 78–91% depending on source ([STD](https://shopthemedetector.com/shopify-themes/impulse)); lab mobile 30–55 (vendor) | "Limited for the price"; "don't update to 9.0"; an update broke styling, fixes behind a paywall ([reviews](https://themes.shopify.com/themes/impulse/presets/impulse/reviews?locale=nl); [Community](https://community.shopify.com/t/why-does-impulse-theme-version-5-5-1-slow-down-banner-load-times/166404)). 95% positive / ~1,193 reviews |
| **Prestige** (Maestrooo) | $400 ([Theme Store](https://themes.shopify.com/themes/prestige)) | Native sticky ATC toggle, quick buy, stock counter, before/after slider; qty pricing Plus-only; no qty-break UI | Slide-out + sticky cart; no rewards bar found | 5 presets (Prestige, Couture, Vogue, Strass, Signature); v11.4.0 Jul 2026 | Field pass ~79–90%; lab PDP 58 mobile (undated, [GemPages](https://gempages.net/blogs/shopify/fastest-shopify-themes)) | Steep learning curve, "overkill under 30 SKUs"; 91% positive / ~860 reviews (7% negative) ([GemPages review](https://gempages.net/blogs/shopify/shopify-prestige-theme)) |
| **Motion** (Archetype) | $400 ([Theme Store](https://themes.shopify.com/themes/motion)) | Video/animation-heavy, quick add, size chart | Slide-out cart | 3 presets (Motion, Memo, Satchel); v11.1.0 Oct 2025 | Field CWV pass 87.5% (vendor) | "Super hard to work with" for custom code; image cropping; uncertain update cadence ([Community](https://community.shopify.com/t/which-one-motion-or-impulse/355601)). 97% / ~540 |
| **Be Yours** (RoarTheme) | $350 ([Theme Store](https://themes.shopify.com/themes/be-yours)) | Ingredient tabs, ritual steps, before/after, hotspots, pre-order, gift wrap | Slide-out + sticky cart | 4 presets (Be Yours, Sheen, Peace, Harmony, a one-product dark preset) | 54/100 page speed (3rd-party, [koala-apps](https://koala-apps.io/blog/best-shopify-themes/online-course/)) | Few complaints; 98% positive / ~600+ |
| **Sleek** (FoxEcom) | $350 ([Theme Store](https://themes.shopify.com/themes/sleek)) | Stock counter, quick view, promo tiles, recommendations | Slide-out + sticky cart, gift wrap | 5 presets | No published score found | Few reviews (~260–284, 100% positive); updates are manual code merges ([FoxEcom docs](https://docs.foxecom.com/sleek-theme/getting-started/update-sleek-theme)) |
| **Minimog** (FoxEcom, ThemeForest) | $88 regular / $2,750 extended licence; 6 months support | Bundles, FBT, urgency, countdowns via FoxKit (companion app) | Upsells, free-ship goal | 85+ demos | No neutral lab data; "doesn't wreck speed" (vendor-adjacent) | Outdated features, mobile polish, licence confusion ([GemPages](https://gempages.net/blogs/shopify/minimog-shopify-theme)) |
| **Shrine Pro** | ~$349 one-time (conflicting $39 listing) ([shopthemedetector](https://shopthemedetector.com/blog/shrine-pro-shopify-theme-review/)) | Qty breaks, bundle blocks, sticky ATC, urgency, trust badges | ~20 drawer features: goal progress bar, timer, free/conditional gifts, toggle upsells, savings total | Product-landing focus; 40+ sections | Mobile claims vary: >85 or 64 ([Clyro](https://www.clyro.com/blog/shrine-theme-shopify-review)); field: 62.1% pass, LCP 1.9 s ([STD](https://shopthemedetector.com/compare/themes/minimog-vs-shrine-pro)) | No-refund policy, outage blamed on Cloudflare, one global bundle only, support delays ([Trustpilot](https://www.trustpilot.com/review/shrinetheme.com)) |
| **Booster** | $199/yr or $299 lifetime (1 yr support) ([affninja](https://affninja.com/shopify-booster-theme-review/)) | 40+ features: countdown, upsell popups, sticky ATC, bundles | Cart upsells | Few landers | **Field CWV pass ~43–50%, lowest of the cohort** ([STD premium](https://shopthemedetector.com/blog/best-premium-shopify-themes/)); reviewer 41 mobile PSI | App conflicts ("good chance it will crash"), broken ATC/Afterpay, week-long support waits ([Trustpilot](https://www.trustpilot.com/review/boostertheme.com?page=6)) |
| **Elixir** | $200, rising with updates; no trial ([vendor](https://ecomelixir.com/products/elixir-shopify-theme)) | Subscription block, Bundle & Save block, qty-break styles (some features slated for V2) | "Custom cart experience" planned for V2 | **Native pre-lander pages in the editor**, a 7-template bundle | Independent mobile Lighthouse **85** vs vendor's "95+" claim ([DropMagic](https://dropmagic.ai/shopify-themes/elixir-theme-review)) | Sparse reviews; grey-market resale on Etsy; CRO claims unverified ([SectionStore](https://sectionstore.io/shopify-themes/elixir-theme-review/)) |

Notes:
- Theme Store listings show **no performance score**. I found no official per-listing "speed" figure, so the speed column uses Shopify's CWV table as reported by third parties, or third-party lab tests.
- Lab numbers come from different stores, pages and dates, so **don't compare them across rows**.

#### 2.3 Patterns across competitors

1. **Theme Store premium themes** (Impulse, Prestige, Motion, Be Yours, Sleek) are $350–$450. They are polished and well supported, but they **lack DTC buy-box primitives**: no native qty breaks or tiered bundles, no subscription UI beyond Shopify's selling-plan picker, and no rewards bar or shipping protection. Merchants bolt on Kaching/Bundler, Recharge/Skio, Rebuy/UpCart and Route, and those apps cost the speed back.
2. **CRO themes** (Shrine, Booster, Elixir) include those primitives for $200–$349. They are sold off the Theme Store, so they skip Shopify's review, and they carry the worst trust signals: no-refund policies, outages, app conflicts, and Booster's ~45% CWV pass rate.
3. **Updating is a universal pain.** Editor settings carry over to a new version, but code edits and app-injected snippets don't, so merchants delay updates ([Community](https://community.shopify.com/t/how-will-i-update-shopify-theme-without-losing-my-customization/277717); [Shopify help](https://help.shopify.com/docs/themes/store/success/updates)).
4. **No competitor publishes a reproducible PDP benchmark** against Dawn on the same store.

#### 2.4 Where Blueprint beats them

- **Price:** at $149 one-time, Blueprint undercuts every Theme Store premium theme by $200–$300 and Shrine Pro by about $200. Minimog is cheaper at $88, but buyers need FoxKit and get only 6 months of support.
- **CRO primitives without the CRO-theme speed tax:** native qty-break, bundle and subscription cards in the buy box, plus a rewards-bar and upsell drawer. Each loads on interaction, and none is injected by an app. The pitch: "replace 3–5 apps" with a measurable speed result.
- **Proof instead of claims:** publish a reproducible PDP benchmark against Dawn (method in §3.4), Lighthouse CI JSON and WebPageTest filmstrips. Elixir's "95+" claim measured 85 independently, so specific, reproducible numbers are a real differentiator.
- **Native pre-lander and advertorial templates** in the editor. Today only Elixir and Shrine have them, and both have trust problems.
- **Trust posture:** a clear refund policy, a documented upgrade path for keeping customizations through updates, a changelog, and reserved space for the common review and subscription apps.
- **Accessibility at ≥ 95 by default.** Most CRO themes don't claim this. Avoid aggressive urgency patterns such as fake timers, which also raise FTC and consumer-law risk for supplements.

---

### 3. Implications for Blueprint

#### 3.1 Performance budget: PDP, mobile, first load, theme-owned only

| Resource | Budget (compressed, over the wire) | Dawn 16 baseline (measured, gzip of source) |
|---|---|---|
| Theme JS, initial | **≤ 20 KB br**, hard cap 25 KB, in ≤ 3 requests (a `type=module` entry plus 1–2 component chunks) | ~38 KB in ~21 files |
| Theme JS, lazy (drawer, bundles, zoom, search, sticky ATC) | ≤ 40 KB total, each chunk ≤ 12 KB, loaded on interaction or visibility | (all loaded up front) |
| CSS | **≤ 30 KB br total**: ≤ 12 KB inlined critical + 1 render-blocking main file; component CSS per block | ~44 KB in ~27 files |
| Render-blocking requests in `<head>` | **≤ 3**, which leaves preload slots for the LCP image and the font | ~3 CSS in head + many in body |
| Fonts | ≤ 2 files preloaded (DM Sans 400 subset, plus Instrument Serif 400 on Editorial only); ≤ 4 font files total; ≤ 80 KB total | Library fonts via `fonts.shopifycdn.com`, ≥ 2 preloads |
| LCP image | ≤ 120 KB at 412 px × DPR (around 1080w WebP/AVIF from Shopify CDN); `fetchpriority=high` + `preload: true`; explicit `sizes` | eager only |
| Other above-the-fold images | ≤ 2 eager; everything else lazy | — |
| Total theme requests before LCP | ≤ 8 (HTML, CSS, JS entry, 1–2 fonts, LCP image) | ~20+ |
| Main-thread work from theme JS | ≤ 50 ms at 4× CPU; no long task > 50 ms from theme code | — |
| CLS | ≤ 0.02 from the theme (announcement bar, sticky ATC, gallery, fonts) | — |

#### 3.2 Techniques checklist

1. Give the template-owned PDP media block an explicit `priority` parameter, emitting `loading: 'eager', fetchpriority: 'high', preload: true` on the first media only. Remove any opacity or reveal transition from it.
2. Count render-blocking `<head>` resources in CI, so the image preload is never dropped by the 10-slot cap.
3. Put critical CSS, font preloads, CSS variables and the import map above `content_for_header`; never wrap or move that tag.
4. Use web components (custom elements) and no framework. Use `type="module"`/`defer`, then `import()` on click, focus, hover or IntersectionObserver for the cart drawer, bundle and qty-break logic, subscription toggle, gallery zoom, search and localization.
5. Self-host the default fonts as subsets with metric-matched fallbacks. Use `font_display: 'swap'` for every library font and `font-synthesis: none` for Instrument Serif.
6. Announcement bar: server-rendered, fixed `min-height`, transform-only rotation. Sticky ATC: `position: fixed` with a transform reveal. Honour `prefers-reduced-motion` on both.
7. Ship `min-height` CSS hooks for common app blocks (review stars, subscription widget), plus `content-visibility: auto` on long below-the-fold slices.
8. Make dynamic checkout buttons a deliberate setting, documented as a speed trade-off.
9. Gate releases in CI with Lighthouse on a fixed dev store and Shopify's test CSV, using the median of 5 runs, with fixed budgets for JS/CSS bytes and request counts (`lighthouse-ci` assertions).

#### 3.3 Honest read on the claims

- **"94 mobile Lighthouse out of the box" is achievable only under narrow conditions:**
  - Shopify's demo or benchmark store, **no third-party apps or pixels**, and the dynamic checkout button off or measured as-is.
  - A PDP with an optimized hero, run on PageSpeed Insights (which tends to score higher than local DevTools).
  - The number is the median of several runs, which vary by ±3–5 points.

  Real paid-social stores run 15–30 third-party services (Meta/TikTok pixels, Klaviyo, reviews, subscriptions, heatmaps) and land at a median of 40–55 regardless of theme. As written, the claim invites refunds and complaints.
  - **Recommended wording:** "94 median mobile Lighthouse on our PDP demo, with no apps installed (method linked)", plus "we beat Dawn by X points on the same store".
- **"Better than Dawn on the same store and product" is realistic.** Dawn's PDP leaves verifiable gains on the table: no `fetchpriority` or preload on the hero, ~21 JS and ~27 CSS files, cross-origin library fonts, and scroll animations on by default.
  - **The catch:** because Shopify's platform JS is identical for both themes and dominates TBT, the lead will be modest, likely +2 to +6 points (**estimate**). It can disappear in run-to-run noise unless measured as the median of ≥ 5 interleaved runs.
  - It also depends on Blueprint's CRO features (bundles, rewards bar, upsell drawer) staying lazy. If they render eagerly, Blueprint loses to Dawn.
- **The 90+ performance, ≥ 95 accessibility/best-practices/SEO targets** are realistic for a theme with no apps. Best Practices can be dragged down by console errors and third-party cookies from Shopify or apps, which the theme can't control.
- **Theme Store packaging:** if Blueprint is ever submitted to the Theme Store, it must support sections and app blocks in the main product section ([requirements](https://shopify.dev/docs/storefronts/themes/store/requirements)). That conflicts with this repo's no-sections convention, so Blueprint should be sold direct.

#### 3.4 Benchmark protocol to publish

- **Setup:** one dev store, Shopify's test-product CSV plus one representative supplement PDP, and the same product URL for both themes, each served from its own preview URL with `?pb=0`.
- **Runs:** Lighthouse 12 mobile defaults, **interleaved** runs (Dawn, then Blueprint, repeated ×7), reporting the median plus LCP, TBT and CLS.
- **Corroboration:** WebPageTest Moto G4/4G filmstrips.
- **Publication:** the raw JSON and the dates.

---

## Part 5: AI kit (MCP server) and Updater: research

Research date: 2026-10-23. "(unverified)" marks claims backed only by secondary sources or not checked first-hand. Several primary domains (modelcontextprotocol.io, help.shopify.com, developers.openai.com, cursor.com) could not be fetched directly from this environment. Claims about those sites come from search-result excerpts or GitHub mirrors and are marked to match.

### 0. Licensing blocker found during research (read first)

Dawn's license grants modify/sell rights *only* "to develop themes that integrate or interoperate with Shopify software or services, and, if applicable, to distribute, offer for sale or otherwise make available any such themes via the Shopify Theme Store. All other uses of the Software are strictly prohibited" ([Dawn LICENSE.md](https://github.com/Shopify/dawn/blob/main/LICENSE.md)). The Skeleton theme in this repo has the same clause (`/home/user/skeleton-theme/LICENSE.md`). On a plain reading, a Dawn-derived theme sold for $149 through Lemon Squeezy, Gumroad or Payhip falls outside that grant. This is not legal advice, but it is a launch blocker until counsel signs off. The remedies are (a) list on the Theme Store, (b) clean-room the theme with no Dawn/Skeleton code, or (c) get written permission from Shopify.

### 1. MCP server in TypeScript

**Spec version.** The current MCP revision is **2026-07-28** ([MCP blog, 2026-07-28 release](https://blog.modelcontextprotocol.io/posts/2026-07-28/)). The previous one is 2025-11-25, and the spec repo holds both ([spec directory](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/main/docs/specification)). The 2026-07-28 changes that matter here:
- **Stateless core.** `initialize` and `Mcp-Session-Id` are removed. Each request carries its version and capabilities in `_meta`, and `server/discover` is optional. Apps that need state mint an explicit handle from a tool, and the model passes it back.
- **Elicitation becomes Multi Round-Trip Requests.** Server-initiated `elicitation/create`, sampling and roots are replaced by MRTR: the server returns `resultType: "input_required"` and the client retries with `inputResponses`.
- **Deprecations.** Roots, Sampling and Logging are deprecated, with a 12-month minimum deprecation window. Dynamic Client Registration is deprecated in favour of Client ID Metadata Documents. Legacy HTTP+SSE is deprecated.
- **Routing headers.** Streamable HTTP requests must carry `Mcp-Method` and `Mcp-Name` headers.
- **Extensions.** Tasks and MCP Apps move into extensions.

All of the above is from the [2026-07-28 release post](https://blog.modelcontextprotocol.io/posts/2026-07-28/). Design the session/draft state as an explicit `draft_id` handle, as the spec now expects.

**SDK.** The TS SDK v2 splits into `@modelcontextprotocol/server` and `@modelcontextprotocol/client`. You use `McpServer`, `server.registerTool(name, {description, inputSchema: z.object(...)}, handler)` and `serveStdio(...)`, with Zod v4 / Standard Schema validation. It runs on Node, Bun and Deno, and has Express/Hono/Fastify/Workers adapters ([TS SDK v2 docs](https://ts.sdk.modelcontextprotocol.io/v2/index.md)). That page calls v2 "the stable release line" for 2026-07-28, while search snippets of the same URL called it beta (conflicting; verify on npm before pinning). v1 remains `@modelcontextprotocol/sdk`, which Anthropic's MCPB guide still links ([Claude MCPB docs](https://claude.com/docs/connectors/building/mcpb.md)).

**Primitives.**
- **Tools** are model-invoked.
- **Resources** are app-attached context. Claude Code exposes them as `@server:uri` mentions ([Claude Code MCP docs](https://code.claude.com/docs/en/mcp)).
- **Prompts** are user-selected templates with string arguments, via `prompts/list` and `prompts/get` ([MCP prompts concept](https://modelcontextprotocol.io/docs/concepts/prompts), unverified: fetched via search excerpt).

**Transports.** stdio suits a local process. Streamable HTTP suits remote servers. SSE is legacy.

**How each client connects (late 2026).**
- **Claude Desktop.**
  - *Local:* an `.mcpb` bundle (zip of a stdio server plus `manifest.json`), installed by double-click, drag-drop, or Settings > Extensions. Node is bundled with Claude Desktop.
  - *Config UI:* `user_config` in the manifest auto-generates a settings UI, and the manifest spec covers sensitive fields ([Claude MCPB docs](https://claude.com/docs/connectors/building/mcpb.md)).
  - *Directory:* listings for desktop extensions are deprecated, so local servers reach the directory only inside a plugin (same page).
  - *Manual config:* hand-edited `claude_desktop_config.json` (Settings > Developer > Edit Config, top-level `mcpServers`) still works per third-party guides ([example guide](https://www.morphllm.com/claude-desktop-mcp), unverified).
  - *Remote:* servers are added as custom connectors by HTTPS URL on Free (one connector), Pro, Max, Team and Enterprise ([add-unlisted](https://claude.com/docs/connectors/custom/add-unlisted.md)).
- **Claude Code.**
  - *Local:* `claude mcp add --transport stdio --env KEY=v blueprint -- npx -y @blueprint/mcp`.
  - *Remote:* `claude mcp add --transport http name https://…`.
  - *Shared config:* project `.mcp.json` with `${VAR}` expansion.
  - *Prompts* appear as `/mcp__server__prompt` commands. Elicitation dialogs (form and URL) are supported.
  - *Per-tool approval:* `_meta["anthropic/requiresUserInteraction"]: true` forces a human approval on every call, even in bypass modes.
  - *Output size:* results over 50k characters are spilled to a file.

  All of the above is from the [Claude Code MCP docs](https://code.claude.com/docs/en/mcp).
- **Cursor.** Project `.cursor/mcp.json` or global `~/.cursor/mcp.json`. A stdio entry is `command/args/env/envFile`. Remote entries use `url` (+ `auth`), with `${env:NAME}` interpolation ([Cursor MCP docs](https://cursor.com/docs/mcp), via search excerpt; unverified).
- **ChatGPT.** It needs a **remote MCP server on public HTTPS** and cannot reach localhost (OpenAI offers a tunnel for private networks) ([OpenAI dev-mode guide](https://developers.openai.com/api/docs/guides/developer-mode), excerpt; unverified). Full MCP with write actions is in beta for **Business, Enterprise and Edu**, and sources conflict on Plus/Pro ([OpenAI Help 12584461](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt), excerpt; unverified). Writes may prompt for confirmation or be blocked. Tool annotations drive the confirmation UI, but forum reports say `readOnlyHint` is sometimes ignored ([OpenAI forum](https://community.openai.com/t/mcp-annotations-being-ignored/1369672), unverified).
  - **Consequence:** a local stdio kit does *not* work in ChatGPT. Supporting ChatGPT means a hosted HTTPS endpoint, which conflicts with "no cost to us".

**Annotations and confirmation.**
- **Annotation hints.** `readOnlyHint`, `destructiveHint` (default true; meaningful only when not read-only), `idempotentHint` and `openWorldHint` ([summary](https://developers.outreach.io/mcp-server/tool-annotations); spec text not fetchable).
- **Trust rules.** The spec says clients **MUST** treat annotations as untrusted unless the server is trusted. There **SHOULD** always be a human in the loop who can deny invocations. Servers **MUST** validate inputs, apply access controls, rate-limit and sanitize outputs ([spec tools.mdx 2026-07-28](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx)).
- **Elicitation.** In 2025-11-25, form mode must not collect secrets; use URL mode for those ([spec mirror](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation), unverified).

**Security best practices.** The official guide covers confused deputy (per-client consent, exact redirect URIs), forbids token passthrough, and covers session hijacking ([MCP security best practices](https://modelcontextprotocol.io/specification/latest/basic/security_best_practices), via excerpt). Local-server compromise is the risk most relevant to us: an npx-installed server runs with the user's privileges ([mcpservers.org summary](https://blog.mcpservers.org/posts/mcp-security-best-practices), unverified). Mitigations:
- Pin versions.
- Sign the `.mcpb` bundle.
- Keep a minimal dependency tree.
- Never log tokens.
- Treat reviews and theme content as untrusted text, since they are prompt-injection carriers.

### 2. Shopify Admin GraphQL API for themes

**Reads.**
- `themes` / `theme(id)` return `role`.
- `OnlineStoreTheme.files(filenames:, first:)` returns text, base64 or URL bodies plus `checksumMd5` ([theme query](https://shopify.dev/docs/api/admin-graphql/2026-04/queries/theme)).
- `ThemeRole` values ([ThemeRole](https://shopify.dev/docs/api/admin-graphql/2026-10/enums/ThemeRole)):
  - `MAIN`, `UNPUBLISHED`, `DEVELOPMENT`
  - `DEMO` (Theme Store trial)
  - `LOCKED` ("identified as unlicensed")
  - `ARCHIVED`

**Writes.**
- `themeDuplicate(id, name)` exists and was **added in 2025-10** ([changelog](https://shopify.dev/changelog/posts/duplicate-themes-with-the-admin-graphql-api); [ref 2026-10](https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/themeDuplicate)).
- `themeCreate(source: URL!, name, role)` takes a public ZIP URL or a `stagedUploadsCreate` URL. The role may only be `UNPUBLISHED` or `DEVELOPMENT` ([themeCreate](https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/themeCreate)).
- `themeFilesUpsert` takes at most 50 files per call and returns a `job` ([themeFilesUpsert](https://shopify.dev/docs/api/admin-graphql/2027-01/mutations/themeFilesUpsert)).
- **`themeFilesCopy` copies only *within one theme*** (single `themeId`, `srcFilename` → `dstFilename`), so it cannot move merchant JSON between themes ([themeFilesCopy](https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/themeFilesCopy)).
- `themeFilesDelete`.
- `unstable` adds `draftThemeFilesCommit` (staged, session-based atomic commit), worth watching ([unstable object](https://shopify.dev/docs/api/admin-graphql/unstable/objects/OnlineStoreThemeFileOperationResult)).
- `themePublish` exists. Blueprint must never call it.

**Scopes and the exemption.**
- **Per-mutation docs.** `themeCreate`, `themeDuplicate`, `themeFilesUpsert` and friends say "needs `write_themes` and an exemption from Shopify". The wording is generic and doesn't distinguish app types.
- **Access-scopes page.** It narrows the rule: "If your app uses **public distribution** and needs to modify a theme or theme files, then it needs an exemption in addition to the write_themes scope" ([access scopes](https://shopify.dev/docs/api/usage/access-scopes)).
- **REST Asset note.** It likewise targets "an app distributed through the Shopify App Store" ([REST Asset](https://shopify.dev/docs/api/admin-rest/2026-10/resources/asset)).
- **Community reports.** They show exemptions are per-app/client-ID, with ACCESS_DENIED on new apps ([thread](https://community.shopify.dev/t/themefilescopy-access-denied-on-dev-app-despite-approved-write-themes-exemption/34703), unverified). One vendor's docs send merchants to "your own custom app" for theme-file edits because their public app lacks the exemption ([PR](https://github.com/Ryze-AI-Adgent/mintlify-docs/pull/29)).
- **Conclusion.** A merchant-owned custom app (custom distribution) very likely needs no exemption. That is not stated explicitly for GraphQL theme mutations, so **test on a real paid store before launch**.
- **Fallback with no exemption question.** The free **Theme Access** app issues `write_themes`-scoped passwords for Shopify CLI ([Theme Access](https://shopify.dev/docs/storefronts/themes/tools/theme-access)).

**REST.** REST Admin is legacy since 2024-10-01. New public apps must be GraphQL-only since 2025-04-01 ([REST Theme](https://shopify.dev/docs/api/admin-rest/2026-10/resources/theme)).

**Custom apps in late 2026.**
- **Admin-created custom apps.** You can no longer create them ("Develop apps" flow retired 2026-01-01). Existing ones keep working with their static `shpat_` token ([legacy admin custom apps](https://shopify.dev/docs/apps/build/authentication-authorization/legacy/admin-custom-apps); [distribution](https://shopify.dev/docs/apps/launch/distribution)).
- **Dev Dashboard path.** New apps are created there: Admin > Settings > Apps > Develop apps > "Build apps in Dev Dashboard" ([help excerpt](https://help.shopify.com/en/manual/apps/installing-apps), unverified). The steps are:
  1. Create app.
  2. Create a version with scopes and **Release**.
  3. Install.
  4. Exchange **client ID + secret** via the **client credentials grant** for a token that **expires in 24h** (`expires_in: 86399`) ([create via Dev Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard/create-apps-using-dev-dashboard); [client credentials](https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant?lang=node)).
- **Same-organization requirement.** Client credentials work only when the app and the store are in the **same organization** (`shop_not_permitted` otherwise). A merchant building from their own admin should satisfy this (unverified; test).
- **Expiring-token rules.** Custom and merchant-created apps are exempt from the 2027 public-app rule ([changelog](https://shopify.dev/changelog/posts/expiring-offline-access-tokens-required-for-all-public-apps-as-of-january-1-2027)).

**Content APIs.**
- **Products, metafields, metaobjects.** Read with `read_products` and `read_metaobjects`.
- **`reviews.rating` / `reviews.rating_count`.** These standard metafields are written by review apps ([standard metafields](https://shopify.dev/docs/apps/build/metafields/list-of-standard-definitions)).
- **`product_review` metaobject.** A standard metaobject, but only approved review partners syndicate to it ([standard metaobjects](https://shopify.dev/docs/apps/build/metaobjects/list-of-standard-definitions)).
- **`pageCreate`.** Supports `isPublished` and `templateSuffix` ([Page](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/Page)). **Note: pages are store-wide, not theme-scoped, so `pageCreate` is a live-store write.**

**Rate limits.** Leaky bucket by calculated cost: 100 pts/s Standard, 200 Advanced, 1000 Plus. Mutations cost 10 ([rate limits](https://shopify.dev/docs/apps/build/apis/graphql-admin/rate-limits)).

### 3. Shopify's own AI/MCP offerings

- **Shopify AI Toolkit and Dev MCP** (`@shopify/dev-mcp`, `claude plugin install shopify-ai-toolkit@claude-plugins-official`). It covers developer docs and schema lookup, validation of GraphQL, Liquid and **themes** (`validate_theme` runs Theme Check), and store tasks through Shopify CLI's authenticated context ([AI Toolkit](https://shopify.dev/docs/apps/build/ai-toolkit); [Dev MCP](https://shopify.dev/docs/apps/build/devmcp)). CLI `store auth` / `store execute` run Admin GraphQL against a store ([CLI store](https://shopify.dev/docs/api/shopify-cli/store)). `app execute` restricts mutations to dev stores ([app execute](https://shopify.dev/docs/apps/build/apis/graphql-admin/api-exploration/admin-cli-app-execute)).
- **Storefront MCP.** Catalog and cart tools were **removed** and replaced by UCP (`/api/ucp/mcp`). Only policies/FAQ remain on `/api/mcp` ([migrate](https://shopify.dev/docs/apps/build/storefront-mcp)). This is buyer-facing and irrelevant to theme editing.
- **Merchant connectors for ChatGPT and Claude** (May 2026). They cover orders, products and analytics from inside the assistant ([Shopifreaks](https://www.shopifreaks.com/shopify-launches-chatgpt-and-claude-connector-apps-that-let-merchants-manage-their-store-from-within-their-preferred-ai-agent/), unverified). The Shopify connector seen in this session exposes generic `graphql_query`/`graphql_mutation`. Whether it permits theme mutations is unverified.
- **Sidekick in the theme editor.** It changes theme settings and adds *existing* sections and blocks. **Generate block** writes AI Liquid into `/blocks` (300-block cap). It is not available on the Starter plan or vintage themes, and Shopify Support won't debug the output ([Sidekick theme editor](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/sidekick); [generate blocks](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/sidekick/generate-blocks), excerpts). A changelog title says block generation works for "all Theme Store themes" ([changelog](https://changelog.shopify.com/posts/ai-block-generation-for-all-theme-store-themes)), so support on a non-Store theme is unverified.
- **Differentiation.** Blueprint's kit should not be a generic Admin wrapper; Shopify already ships that. It should be *theme-semantic*:
  - Knows Blueprint's section and block schemas and presets.
  - Composes merchandising content (listicles from reviews, comparison pages) into valid JSON templates.
  - Always works in a diffed draft theme.
  - Works on the merchant's own model, on any MCP client.
  - Should *recommend* installing Dev MCP for `validate_theme` rather than re-implementing Theme Check.

### 4. Review app APIs (for `draft_listicle_from_reviews`)

| App | Merchant read API | Auth | Notes |
|---|---|---|---|
| Judge.me | `GET https://api.judge.me/api/v1/reviews` (`per_page` ≤100, `product_id`, `rating`) | `api_token` (private, server-side) + `shop_domain` | Token under Settings > Integrations > View API tokens. It can't be self-rotated ([Judge.me help](https://judge.me/help/en/articles/8409180-using-judge-me-api)). |
| Okendo | Storefront REST `https://api.okendo.io/v1/stores/{okendo_user_id}/reviews` | **None** (public). Merchant API uses Basic auth with user ID + API key | `nextUrl` pagination, cached ([Okendo storefront](https://docs.okendo.io/on-site/storefront-rest-api); [merchant](https://docs.okendo.io/merchant-rest-api/quick-start)) |
| Yotpo | `GET /v1/apps/{app_key}/reviews` | `utoken` from `POST /oauth/token` (app key + secret) | Path from an aggregator (unverified) ([Yotpo docs](https://apidocs.yotpo.com/reference/table-of-contents)) |
| Stamped | `https://stamped.io/api/v2/{storeHash}/dashboard/reviews` | Basic (public key : private key) | **Professional or Enterprise plan** required ([Stamped REST](https://stampedsupport.stamped.io/hc/en-us/articles/10152777765659-Stamped-REST-API)) |
| Loox | No documented public read API found | — | CSV export from Manage Reviews > Export ([guide](https://help.octaneai.com/en/articles/7932802-exporting-reviews-from-loox)) |

**Fallback chain:**
1. Provider adapter.
2. Okendo public endpoint (no key).
3. A CSV/JSON export the merchant drops into a local folder (Loox, Yotpo, Judge.me all export CSV).
4. `reviews.rating` / `rating_count` metafields for aggregate stars only (no review text).

**Handling rules:**
- Treat review text as untrusted input that may carry prompt injection.
- Quote reviews verbatim with attribution.
- Never fabricate reviews.

### 5. Prompt library format

MCP prompts are user-controlled, argument-templated, and side-effect-free. They surface as slash commands in Claude Code (`/blueprint:listicle`) and other hosts ([Claude Code MCP](https://code.claude.com/docs/en/mcp); [prompts concept](https://www.speakeasy.com/mcp/core-concepts/prompts.md)). Not every host surfaces prompts, and ChatGPT and Cursor support for prompts is unverified.

**Recommendation: single source, two outputs.**
- Keep `prompts/*.md` with YAML front-matter: `name`, `title`, `description`, `arguments[{name, description, required}]`, `tools_used`, `writes: true|false`, `version`.
- The server loads that folder and registers each file via `registerPrompt`.
- The same files stay readable and copy-pasteable for hosts without prompt support. A build step can also emit Claude Code skills or a Cursor rules variant.
- Organise by job: `audit/`, `merchandising/`, `content/`, `setup/`.
- Each prompt ends with an explicit "call `diff_draft` and show me the diff before any write" step.

### 6. Updater: how paid themes outside the Theme Store ship updates

**What Shopify does for Theme Store themes.**
- **Automatic updates.** Applied in place *only if all files except `settings_data.json` and `templates/*.json` are untouched*.
- **Manual updates.** Required if a setting ID or type is changed or removed, a range min/max tightens, or a section or block is removed. The update installs as an **unpublished copy** with customizations carried over, leaving the parent untouched.
- **Value resets.** A setting value that becomes invalid resets to the new default.
- **Semver.** X = removed or renamed settings, sections or blocks; Y = additive; Z = fixes.
- **Release notes.** Ship a `release-notes.md`.

All of the above is from [Shopify: Updating your theme](https://shopify.dev/docs/storefronts/themes/store/success/updates). Hand code edits are not carried over ([help](https://help.shopify.com/manual/using-themes/updating-themes); [community](https://fuelthemes.net/update-shopify-theme-without-losing-customizations/), partly unverified). None of this is available to off-Store themes.

**Market practice.**
- **Out of the Sandbox.** A Theme Updater app in the App Store copies theme-editor settings to a new version. Some customizations need manual transfer ([OOTS blog](https://outofthesandbox.com/blogs/shopify-theme-blog/shopify-theme-updater-app); [Turbo trial via updater](https://help.outofthesandbox.com/hc/en-us/articles/115007101688-Preview-Turbo-in-your-store), excerpts).
- **Shrine.** Uses an in-theme "authenticate the theme" flow ([Trustpilot](https://nl-be.trustpilot.com/review/shrinesolutions.com), unverified), yet "nulled" Shrine Pro builds are openly resold on Gumroad ([example listing](https://argylegame.gumroad.com/l/Shrine-Pro-1-4-3-nulled)). In-theme checks don't stop piracy.
- **Booster, Debutify.** No primary sources found (unverified).

**Options.**
- **(a) Manual.** Download the zip, upload it as a new theme, then copy `config/settings_data.json`, `templates/*.json`, `sections/*-group.json` and customised `locales/*.json`. The copy is done by hand in the code editor, or by uploading a zip that already contains them. Overwriting files by uploading a zip over an old theme has wiped settings ([community](https://community.shopify.com/t/how-do-i-manually-update-the-dawn-theme-without-losing-changes/57721)). Free, but error-prone.
- **(b) Shopify CLI.** Steps:
  1. `shopify theme pull --live --only config/settings_data.json --only "templates/*.json" --only "sections/*-group.json" --only "locales/*.json"`.
  2. Overlay the files onto the new release folder and run migrations.
  3. `shopify theme push --unpublished --theme "Blueprint 1.0.3"`.

  Use **never** `--publish` / `--allow-live` ([theme push](https://shopify.dev/docs/api/shopify-cli/theme/theme-push)). It authenticates with a Theme Access password, so there is no exemption question. It needs Node and a terminal.
- **(c) Embedded/hosted updater app.** Steps:
  1. `themeCreate(source: signed zip URL)`.
  2. Read the merchant JSON from MAIN via `theme.files`.
  3. Migrate.
  4. `themeFilesUpsert` into the new theme. `themeFilesCopy` can't go cross-theme.

  A *hosted* app serving many stores is **public distribution**: App Store review plus the theme-modification **exemption**. Custom distribution is limited to one store or one Plus org ([distribution](https://shopify.dev/docs/apps/launch/distribution)). It also costs hosting.
- **(d) GitHub integration.** Shopify commits editor changes to the connected branch ([version control](https://shopify.dev/docs/storefronts/themes/best-practices/version-control); [changelog 2026-08-26](https://shopify.dev/changelog/posts/github-commits-now-name-the-last-theme-editor)). The merchant merges an upstream `blueprint/v1.0.x` release branch and resolves JSON conflicts. This is great for agencies and too technical for most merchants.

**Migration strategy for `settings_data.json` and JSON templates.**
- `settings_data.json` holds `current`, `presets` and optional `platform_customizations`, keyed by setting ID ([settings_data.json](https://shopify.dev/docs/storefronts/themes/architecture/config/settings-data-json)). Merchant layout lives in `templates/*.json` and `sections/*-group.json`.
- **Policy for 1.x.** Follow Shopify's "automatic update" constraints voluntarily:
  - Never rename or remove setting IDs, types, sections or blocks.
  - Additive changes only.
  - Keep deprecated settings in schema, ignored in code (relabelled "Deprecated").
  - Breaking changes wait for 2.0.
- **Declarative migrations.** Ship `migrations/<version>.json` with ops such as `renameSetting`, `renameSectionType`, `renameBlockType`, `mapValue`, `dropSetting` and `addDefault`. The updater applies these ops in version order to `current`, every preset, every `templates/*.json` and every `*-group.json`. The ops must be idempotent, with a version stamp in `theme_info.theme_version`. Leave unknown section, block and app-block entries untouched, and leave `platform_customizations` untouched.
- **Locales.** Start from the release's locale files, then re-apply the merchant's edited keys. "Edit default theme content" writes into `locales/*.json` (unverified).
- **Code-edit detection.** Ship `release-manifest.json` with MD5 per file. Compare it to `checksumMd5` from `theme.files`. Report modified Liquid/CSS/JS files to the merchant and never auto-port them.

**Licensing keys.**
- **Lemon Squeezy.** `POST /v1/licenses/activate` (`license_key`, `instance_name`) → `instance_id`. `/validate` (+`instance_id`). `/deactivate`. No API key needed, rate limit 60/min. Every activate creates a new instance ([LS License API](https://docs.lemonsqueezy.com/help/licensing/license-api); [validate](https://docs.lemonsqueezy.com/api/license-api/validate-license-key); [nolt](https://lemonsqueezy.nolt.io/733), unverified).
- **Gumroad.** `POST https://api.gumroad.com/v2/licenses/verify` (`product_id`, `license_key`, `increment_uses_count=false`). No auth needed ([mirror of Gumroad docs](https://www.mintlify.com/antiwork/gumroad/api/licenses/verify), unverified).
- **Payhip.** New system: `GET /api/v2/license/verify?license_key=` with a per-product `product-secret-key` header. Keys auto-disable on refund ([Payhip help](https://help.payhip.com/article/317-software-license-keys-new)).
- **Where to check.** Check in the **updater, at download time**, keyed to the `*.myshopify.com` domain as `instance_name`. Do not check in theme JS:
  - Storefront code is public and trivially stripped (see the nulled Shrine builds).
  - Every storefront call to a vendor API adds latency and leaks the key.
  - A vendor outage or misfire would break a live store, which punishes paying merchants.
  - Shopify's own `LOCKED` role is reserved for Shopify's licensing, not ours.

### Implications for Blueprint

#### Recommended MCP architecture (v1)
- **Transport.** Local **stdio** server in TypeScript.
  - **Distribution:** (1) npm `npx -y @blueprint/mcp` for Claude Code, Cursor and Codex, with copy-paste `.mcp.json` / `.cursor/mcp.json` snippets; (2) a signed **`.mcpb`** for Claude Desktop, whose `user_config` collects shop domain, client ID and client secret as sensitive fields.
  - **SDK:** target the 2026-07-28 spec on SDK v2 only if it negotiates 2025-11-25 clients. Otherwise use v1.x (verify).
  - **ChatGPT:** out of scope for v1. It needs a public HTTPS server, and write mode is Business/Enterprise/Edu. Offer a later "deploy your own Worker" template so hosting stays at no cost to us.
- **Auth.** The merchant creates a **Dev Dashboard app** in their own org, releases a version with scopes, installs it, and gives the kit client ID and secret. The server runs the client-credentials grant and refreshes before 24h. A legacy `shpat_` token is accepted for pre-2026 custom apps.
  - **Scopes:** `read_products`, `read_metaobjects`, `read_themes`, `write_themes`, and `read/write_online_store_pages` (verify exact page scope names).
  - **Secrets:** never echoed in tool output.
- **Tools.**

| Tool | Class | Annotations / rails |
|---|---|---|
| `list_themes`, `list_sections`, `read_template`, `read_settings`, `get_current_preset`, `read_products`, `read_metafields`, `read_reviews` | Read | `readOnlyHint:true`, `openWorldHint:false` (reviews: true). Paginate, and keep output under 50k chars. |
| `create_draft` (themeDuplicate of MAIN → "Blueprint AI draft – <date>") | Write (non-destructive) | Returns a `draft_id` handle. Records the theme ID in local state. |
| `diff_draft` | Read | Produces a unified diff plus a `change_token` (hash of planned files and base `checksumMd5`). |
| `update_block_settings`, `draft_listicle_from_reviews`, `apply_template_change` | Write (draft only) | Requires a matching `change_token`. `destructiveHint:false`, `idempotentHint:true`, `_meta["anthropic/requiresUserInteraction"]:true`. Elicitation or MRTR confirm where supported. |
| `create_page_from_template` | **Live-store write** | `isPublished:false` only. `destructiveHint:false`, requires confirmation, and labelled clearly as touching the live store. |
| `revert_draft_file` | Write (draft only) | Restores from the server-side snapshot. |

- **Safety rails (enforced in code, not prompts).**
  - Before every write, re-query `theme.role` and refuse unless it is `UNPUBLISHED` or `DEVELOPMENT` *and* the ID is in the server's own draft registry. Hard-refuse `MAIN` and `LOCKED`.
  - Use an **operation allowlist** of persisted GraphQL documents. `themePublish`, `themeDelete` and `themeFilesDelete` on non-drafts aren't in the binary at all. Add a CI test that greps for them.
  - **File allowlist** for writes in v1: `templates/*.json`, `sections/*-group.json`, `config/settings_data.json`. No Liquid/JS writes in v1.
  - Validate against Blueprint's section schemas before writing (unknown setting IDs → reject). Suggest Dev MCP `validate_theme` for code.
  - Use optimistic concurrency via `checksumMd5`. Back off on throttle.
  - Wrap review and product text in delimiters marked as data, never instructions.
- **Prompts.** Keep `prompts/*.md` with front-matter, registered as MCP prompts and also usable as plain files.

#### Recommended updater (v1)
- **Positioning blocker.** The sales page promises an "updater app". A hosted multi-store app is public distribution, which needs App Store review and the exemption. For v1, ship **`blueprint update`**: a local CLI in the same npm package and `.mcpb`, using the merchant's own Dev Dashboard app. Reword the copy to "updater tool" until an App Store app (with exemption) exists. Keep option (b), the Shopify CLI script, as the documented fallback, and (a) as last resort.
- **Merchant steps:**
  1. Run `npx @blueprint/mcp update` (or ask the assistant "update Blueprint").
  2. Enter the license key. The tool validates it via Lemon Squeezy, Gumroad or Payhip using the myshopify domain as instance.
  3. Our tiny serverless function returns a short-lived signed zip URL. Alternatively, the CLI downloads the zip and uses `stagedUploadsCreate`.
  4. `themeCreate` → new **unpublished** theme "Blueprint 1.0.x". Poll until processing completes.
  5. Read `settings_data.json`, `templates/*.json`, `sections/*-group.json` and `locales/*.json` from MAIN, and the version stamp.
  6. Apply `migrations/*` from the old version to the new one. Merge locales. Show a diff and the list of code-modified files from the checksum manifest.
  7. `themeFilesUpsert` (≤50 files per call) into the new theme.
  8. The merchant previews and publishes manually. Keep the old theme as rollback.
- **Migration policy.** Stay additive in 1.x. Ship declarative, idempotent migrations. Keep deprecated settings. Version-stamp `theme_info`. Never touch unknown sections, blocks or app blocks.

#### Blockers (plain)
1. **Dawn/Skeleton license restricts sale to the Theme Store.** Selling a Dawn-based theme via Lemon Squeezy, Gumroad or Payhip appears prohibited. Needs legal review, a clean-room rebuild, or a Theme Store listing.
2. **`write_themes` exemption.** Official text implies only public apps need it, but mutation docs are generic. **Verify `themeDuplicate`, `themeCreate` and `themeFilesUpsert` from a merchant Dev Dashboard app on a real paid store before launch.** Fallback: Theme Access password plus Shopify CLI.
3. **A hosted "updater app"** for all buyers = public distribution, which means App Store review plus the exemption.
4. **Client-credentials grant** requires the app and store in the same org. Confirm the merchant-from-admin flow qualifies.
5. **ChatGPT** needs remote HTTPS, and write actions are plan-gated, so it is excluded from the "works with ChatGPT" claim in v1.
6. **`pageCreate` writes to the live store.** This breaks "write only to draft" unless pages are created unpublished and disclosed.
7. **Review APIs are uneven.** Stamped requires Professional+, Loox has no documented API, and Yotpo needs secret plus utoken. The CSV fallback is mandatory.

---

