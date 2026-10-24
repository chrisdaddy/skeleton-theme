# PLAN: Blueprint Theme

**Status:** approved to proceed with Phase 0 (owner's answers, 2026-10-23, below).

### Decisions log

| # | Question | Owner's answer | What the plan does |
|---|---|---|---|
| Q1 | Development stores | Not created yet | **Before stores exist:** Phase 0 and Phase 1 code proceeds; Theme Check and unit tests run offline. **To create them:** three free Plus-plan dev stores via the Dev Dashboard or `shopify store create dev --plan plus --demo-data` (Plus gives Flow and custom-app Functions). Needed by the end of Phase 1. **Network:** Shopify hosts were blocked in earlier sessions; on 2026-10-24 the stores and shopify.dev were reachable. **Still needed:** a Theme Access password per store and the seed app's client credentials as environment secrets (docs/demo-stores.md). |
| Q2 | Channel | **Direct first**, Theme Store rules later | D2 as recommended |
| Q3 | Base and repo | **Yes**: original code, replace Skeleton and `AGENTS.md`, keep this repo | D1 + D3 as recommended |
| Q4/Q5 | Subscription and reviews apps | "Whatever you suggest; give merchants options" | Default and first-tested: **Shopify Subscriptions** and **Judge.me**. **Subscriptions:** works with any selling-plan app (Recharge, Skio, Loop, Appstle); the theme toggle steps aside when an app's own widget is present. **Reviews:** a provider setting (`auto`, standard metafields, Judge.me, Okendo, Yotpo, Loox, Stamped, none) plus `@app` slots everywhere stars or reviews appear. |
| Q6 | License and delivery | "How does Elixir do it? Do that, or our own custom; Lemon Squeezy last" | Elixir-style own stack (§13.1) |
| Q7–Q15 | Remaining questions | Not yet answered | Plan defaults apply until changed |

### Progress

| Phase | Status | Notes |
|---|---|---|
| 0. Setup | Done | Original foundation, new `AGENTS.md`, CI (Theme Check, unit tests, contrast) |
| 1. Foundation | Done, pending store verification | See "Phase 1 delivered" below |
| 2. Product page | Done offline, pending store verification | See "Phase 2 delivered" below. Quick-add sheet moved to Phase 4 (it belongs with product cards) |
| 3. Cart drawer | Done offline, pending store verification | See "Phase 3 delivered" below |
| 4. Content sections | Done offline, pending store verification | See "Phase 4 delivered" below. Includes the quick add moved from Phase 2 |
| 5. Templates and pre-landers | Done offline, pending store verification | See "Phase 5 delivered" below. Includes the collection page moved from Phase 4 |
| 6. Demo stores | Built and verified offline; seeding waits on store credentials | See "Phase 6 delivered" below. One Dev Dashboard app's credentials, plus Theme Access passwords, in the environment settings |
| 7. AI kit | Built and tested offline (in-memory store); store end-to-end waits on credentials | See "Phase 7 delivered" below. The `write_themes` launch blocker is still to verify on a real store |

#### Phase 1 delivered

- **Settings and tokens (§3):**
  - The Quick style group comes first: accent, background (light/dark), headings (sans/serif) and corners (sharp/soft/round/custom).
  - Light and dark color sets, each with optional overrides.
  - Contrast-safe derived tokens, computed in Liquid with `color_mix` and `color_contrast`, aiming for 4.6:1 because `color_contrast` rounds to one decimal.
  - `tools/lib/tokens.mjs` mirrors the Liquid derivation, so CI checks exactly what the storefront renders.
- **Presets:** Clinical, Editorial and Bold in `settings_data.json`. Every preset passes in both modes. The proposed dark and light counterpart sets from §3.4 are now in use.
- **Fonts:**
  - The Shopify font library supplies DM Sans and Instrument Serif via `font_picker`.
  - Bold, italic and bold-italic variants come from `font_modify`.
  - Two preloads at most.
  - Metric-matched fallback faces (from Capsize metrics) stop text shifting when fonts swap in.
- **Layouts and chrome:**
  - Layouts: `theme`, `landing` (pre-landers, with default `noindex, follow` plus a per-page `blueprint.robots` override) and `password`.
  - Header and footer groups, plus landing header and footer groups.
  - Announcement bar: rotating, the same height for every message (no layout shift), pausable, and off under reduced motion.
  - Header: menu with dropdowns, a mobile `<dialog>` drawer, search, account and a live cart count.
  - Footer: menu, text, newsletter and social blocks, plus payment icons and policies.
  - Minimal pre-lander header and footer.
- **JavaScript:**
  - `bp-core.js` holds the lazy module loader, cart-count refresh, the invoker-commands fallback and reveal-on-scroll.
  - `bp-standard-actions.js` loads above `content_for_header`.
  - Every-page theme JS is **1.7 KB** Brotli (budget 8 KB) and CSS is 3.1 KB, enforced by `tools/budget-check.mjs`.
- **Offline preview:**
  - **Why:** Shopify hosts are blocked from the build environment.
  - **How:** `tools/preview/` renders the theme with LiquidJS and mock data from `data/demo-content.json` (Verde, Ode, Rawform), then screenshots every preset at 390 and 1440 px.
  - **Results:** layout shift measured ≤ 0.017 on every view, with no console errors. Screenshots are in `docs/screenshots/phase-1/`.
  - **Limits:** it approximates Shopify's renderer. Phase 1 acceptance still needs a pass on a real store (Q1).
- **Still to verify on a store:**
  - that `dm_sans_n4`, `dm_sans_n6`, `dm_sans_n7` and `instrument_serif_n4` are valid font handles;
  - that the editor's `visible_if` settings behave as expected;
  - that the Standard Actions handlers fire.

#### Phase 4 delivered

- **Sections:**
  - All 25 SPEC §4 types (§4.1) and the 17 essentials (§4.3): 42 merchant-addable sections with 61 presets, plus the `quick-add` section used by product cards.
  - Some file names are more descriptive than the plan's: `image-with-text`, `bundle-builder`, `featured-collection`, `before-after`.
  - `rich-text` and `contact-form` were rebuilt on the shared settings.
- **Shared settings** (every content section): color style, width (page, narrow, full), heading tag, top and bottom padding, hide on mobile or desktop, custom CSS class. They come from `snippets/section-attributes.liquid` and `snippets/section-heading.liquid`.
- **Product data first (SPEC §4):**
  - These sections read the bound product's metafield first, then their own blocks: badges, benefits, clinical results, ingredients (including the COA file), us vs. them, FAQ and guarantee.
  - "Hide when empty" is a setting.
  - The product is the section's product picker, or the page's product.
- **Honesty and money:**
  - Button prices, subscription prices and savings come from variants and selling plans. The subscription heading's `[percent]` token is the plan's real saving, rounded down, and the section hides when the product has no plan.
  - The hero shows "From $X" when prices vary.
  - The bundle builder computes totals in cents from variant prices, and its saving is rounded down (unit-tested). Its percentage is display-only and must match an automatic discount; the setting says so.
  - Reviews, comments and UGC carry "real customers only" notes.
  - Review summaries come only from the `reviews.*` metafields.
  - The countdown defaults to a fixed end. The per-visitor mode is labelled and never resets on reload. A countdown with no end date shows only in the theme editor.
  - Placeholder counts are never invented.
- **Without JavaScript:**
  - Quiz answers are links to their results.
  - The bundle builder posts `items[n][id]` to the cart.
  - Before/after shows both photos side by side.
  - Tabs show every panel.
  - Countdowns show their end date.
  - Video embeds are links, and sliders scroll natively.
- **Accessibility:**
  - Native range input for before/after, ARIA tabs with arrow keys, and slideshow autoplay with a pause button (off by default).
  - Marquees, counters, autoplay and videos stop under reduced motion.
  - Real tables for ingredients and comparisons, with yes/no announced as text.
  - Sections are not region landmarks (60 unlabelled regions helped nobody); headings carry the structure.
- **Product card and quick add:**
  - Badges come from `blueprint.badge`, "Save N%" from a real compare-at price (rounded down), and "Sold out". Cards show the rating from the `reviews.*` metafields and a hover image.
  - Quick add: single-variant cards are a real add-to-cart form, sent in place. Other cards open the full buy box in a dialog (`sections/quick-add.liquid`, the product theme blocks rendered as static blocks); without JS they link to the product.
- **JavaScript:** 12 small modules, each loaded when its section scrolls into view or on interaction:
  - slider, counter, video, before/after, timer, quiz, bundle, tabs, recommendations, quick add.
  - All of them together are 19.9 KB, but no page loads them all up front.
- **CSS:**
  - One `section-content.css` (5.6 KB) for every content section, so a page of sections costs one request.
  - The product card's styles and the accordion moved to `base.css`.
  - Worst case (one of every section on a page): 13.9 KB of CSS. Now enforced by `tools/budget-check.mjs`.
- **Demo mapping:** `tools/preview/demo-sections.mjs` turns each demo store's reference sections into Blueprint section JSON. Phase 6 seeding will reuse it.
  - It strips reference prices from button copy; buttons show the product's own price.
  - It takes guarantee days only from "N-day" copy.
- **Checklist:** `npm run check:sections` (`tools/preview/sections-checklist.mjs`) runs 135 checks, and all pass. It covers:
  - All 10 demo stores' sections and every section preset in all three presets, at 390 and 1440: no console errors, no sideways scrolling, nothing unexpectedly empty, no axe violations.
  - Reduced motion and no-JS behaviour.
  - Interactions: quiz, bundle (totals and add), before/after by keyboard, tabs by keyboard, countdown, FAQ JSON-LD, related products, and both quick-add paths.
  - The buy-box (451) and cart (280) checklists still pass.
- **Screenshots:** `docs/screenshots/phase-4/` has every demo store's sections at 1440, and Verde, Ode and Rawform at 390.
- **Plan changes:**
  - The upsell's in-cart deal label is `blueprint.cart_deal_label` on the upsell product (§6.1 said `upsell_deal_label` on the main product). The deal belongs to the upsell however it was chosen.
  - `main-collection-grid` filters, sort and the collection banner move to Phase 5, with the templates.
- **Still to verify on a store:**
  - that `closest.product` in featured-product blocks resolves to the section's product picker;
  - that static `content_for 'block'` blocks render in `quick-add` through the Section Rendering API;
  - that `/cart/add` accepts `items[n][id]` form posts;
  - that `request.design_mode` hides the unset countdown;
  - that `product_recommendations_url` returns the section with `intent=complementary`.

#### Phase 7 delivered

- **Package** `mcp/` (`@blueprint/mcp` 0.1.0):
  - TypeScript compiled to `dist/`, stdio transport, MCP SDK 1.32.1.
  - Runs with `npx -y @blueprint/mcp`, or as a Claude Desktop bundle: `npm run pack:mcpb`. The manifest passes `mcpb validate`, and the unpacked bundle was run.
  - Auth: the client credentials grant with a Dev Dashboard app, with tokens refreshed before their 24 hours run out, or an `shpat_` token.
- **Tools:** all 17 from §12, with read tools marked `readOnlyHint`. Output is capped at 50k characters; long reads page with `offset`.
  - **Plan, then apply.** Every draft write is two calls. Without `change_token` the tool returns the diff and a token. The same call with the token applies the change.
  - **`diff_draft`** shows the pending plan with its token, or the draft against the live theme.
- **Rails** (`src/rails.ts`, `src/operations.ts`):
  - **Draft check before every write:** the theme must be in the draft registry, and its role is re-read (UNPUBLISHED or DEVELOPMENT, not processing). Tested: a draft the merchant has published is refused.
  - **File allowlist:** `templates/*.json`, `sections/*-group.json`, `config/settings_data.json`.
  - **Schema validation:** against a generated index of every section, theme block and setting (`src/generated/theme-index.json`, from `npm run sync`). All 39 templates, groups and settings files Blueprint ships pass it, and the negative cases fail.
  - **Optimistic concurrency** on `checksumMd5`.
  - **Allow-listed operations:** the server sends only the documents in `src/operations.ts`. A test fails the build if `themePublish` or `themeDelete` appears in `src/` or `dist/`. Every operation validates against the 2026-07 Admin schema.
  - **Live-store writes:** `create_page_from_template` makes unpublished pages only and never touches existing ones. `setup_metafields` only adds what's missing. Both need `confirm: true`.
- **Reviews:**
  - Sources in order: Judge.me, Okendo, Yotpo, Stamped, then CSV (Loox and other exports).
  - Text is stripped of markup, control and bidi characters, and returned as data with a note. Names become first name and initial; "verified" only when the app says so.
  - **Honesty rule in code:** the drafting tools reject any quote that isn't a verbatim excerpt of a fetched review (whitespace, case and curly quotes aside). Advertorials keep their disclosure on, and listicle headlines use `[count]`.
- **Prompts:** the 22 from §12 in `prompts/*.md`, with front-matter. They're served as MCP prompts with arguments, and work as plain text elsewhere.
- **Tests** (`cd mcp && npm test`, also a new CI job), 22 in all:
  - Rails: refusing the live theme, published drafts, non-draft themes, non-allowlisted files, invalid content, stale tokens and concurrent edits.
  - End to end: a real MCP client and the server over the in-memory transport, against an in-memory store whose live theme is this repository's theme files. This is the Phase 7 acceptance flow, offline: create a draft → read reviews → a fabricated quote is refused → a listicle from real quotes is planned, applied, and validates → the live theme is unchanged and writing to it is refused → diff and revert work.
  - Review providers, using canned responses in each API's documented shape.
  - Prompt parsing.
- **Docs:**
  - `docs/ai-kit.md`: app scopes, Claude Desktop, Claude Code and Cursor setup, review keys, what the kit will and won't do, troubleshooting.
  - `mcp/README.md`.
  - ChatGPT is documented as "not in v1"; the v1.1 remote template is not built.
- **Changes from the plan:**
  - **Scopes:** `read_metaobject_definitions` is added, and `setup_metafields` needs `write_metaobject_definitions` and `write_products`.
  - **Tier field:** the definition field is `discount_label` (what the Liquid reads), as in Phase 6.
- **Still to verify on a real store:**
  - **The launch blocker:** do `themeDuplicate` and `themeFilesUpsert` work from a merchant's Dev Dashboard app without a `write_themes` exemption? If not, the fallback is the Theme Access password plus Shopify CLI, which isn't built.
  - The review apps' live response fields; the mappings follow their documented shapes.
  - The acceptance run on a store with real reviews.
  - The `.mcpb` publisher signing, and publishing the npm package (the `@blueprint` scope has to be ours).

#### Phase 6 delivered

- **Store configs** (`tools/demo/catalog.mjs` → `tools/demo/stores/<id>.json`, all ten reference stores; Verde, Ode and Rawform are required):
  - **Products:**
    - Products and variants with prices in cents from the reference tiers; Rawform has 24 variants (Flavour × Size × Pack).
    - Gift, reward and protection products; inventory.
    - Where the reference is silent, the values match the preview's mock data so the two agree. The hero prices are unit-tested variant by variant against `tools/preview/mock-products.mjs`.
  - **Content:** metaobjects for tiers, benefits, ingredients, studies, comparison rows, FAQs and the guarantee; product metafields, `reviews.*` and `descriptors.subtitle`.
  - **Selling plans:** one subscribe-and-save group (1, 2 and 3 months) when the reference states the saving.
  - **Collections:** best sellers, plus one smart collection per product type.
  - **Pages and menus:** five pages and two menus.
  - **Automatic discounts** for everything the theme promises:
    - free shipping at reward 1;
    - gifts at the reward thresholds;
    - the tier gift;
    - the upsell deal;
    - mix-tier quantity discounts.

    Tests check that each "$N value" or "$N in cart" label equals the real price or discount.
  - **Theme settings:** the reference colours go into the set for their own mode (Rawform, Omni and Dreamr are dark). Button text and accent text are left to the theme's contrast-safe derivation. The demo stores' settings now run through `tools/contrast-check.mjs` in CI, and all ten pass in both modes.
- **Definitions** (`tools/demo/definitions.mjs`):
  - The §6 metaobject and metafield definitions, with field keys matching the Liquid (the tier's `discount_label`, not `discount_title`).
  - The AI kit's `setup-metafields` will reuse them in Phase 7.
- **Seed** (`tools/seed-demo.mjs`, logic in `tools/demo/seed.mjs`):
  - Admin GraphQL, 2026-07, through one Dev Dashboard app with the client credentials grant. No tokens are stored or copied.
  - Every step looks up before it writes, so re-running only changes what differs. A second run against the in-memory admin creates nothing (unit-tested).
  - Product media and section photos are labelled placeholder PNGs (`tools/demo/images.mjs`), uploaded once under fixed names.
  - `--dry-run` seeds `tools/demo/fake-admin.mjs`.
- **Schema validation:** `tools/demo/validate-operations.mjs` downloads the published 2026-07 Admin schema from shopify.dev's public proxy. It checks the seed's 25 operations, and the actual variables of all 1,694 calls a seed of the ten stores makes, with graphql-js. All are valid.
- **Demo theme** (`tools/demo/theme.mjs <store> [--push]`):
  - The release theme plus the store's templates (photos as `shopify://shop_images/…`), colours and cart settings.
  - An announcement-bar notice that products, prices and reviews are samples.
  - Theme Check passes on the build. It pushes as an unpublished theme through `tools/store.mjs`.
- **Template changes:**
  - Listing templates name products through the catalog: the Bold bundle builder's "Whey Isolate" is now the hero, `rawform-whey`.
  - The advertorial follows the reference's order: lead image, lede, pull quote, closing paragraph, CTA. The listing templates close with guidance for the merchant; the demo stores close with the reference's line, naming the store's real guarantee.
- **Side by side** (`tools/demo/compare.mjs`):
  - It drives the reference to a store and page and expands its scrolling frame, then captures Blueprint: the offline preview with the store's colours (`?demo=1`), or the live store with `--target=store`.
  - `docs/screenshots/phase-6/` has 30 offline comparisons: three stores × home, product, advertorial, listicle and collection × 390 and 1440.
  - **Visible gaps, all by design:**
    - Pre-landers use the minimal landing header where the reference shows the store header (§9.1).
    - Product pages lead with the product name and its subtitle, where the reference's headline is the tagline.
    - The default tier is the preselected one (2 pouches), so the price block shows its price.
- **Shot list:** `docs/SHOT_LIST.md`, 192 shots across ten stores, generated from every `photo` field (`node tools/demo/shot-list.mjs`).
- **Docs:** `docs/demo-stores.md` covers the app's scopes, environment variables, run order and the manual steps (the Search & Discovery product-type filter; a subscription app to check out subscriptions).
- **Not done (needs credentials):**
  - seeding the three stores and pushing their themes;
  - the store-side comparisons, which are Phase 6's acceptance;
  - the store verifications listed for Phases 1–5.

#### Phase 5 delivered

- **Pre-lander sections** (all with presets, on `layout/landing.liquid`):
  - `article-header` (eyebrow, headline, lede, an "Advertisement" disclosure that is on by default and warns in the editor when hidden), `author-byline` (read time from the page content when blank), `article-body` (text, heading, image, quote, product and button blocks, `@app`), `pull-quote`, `listicle` (a `[count]` token keeps the headline's number honest), `comparison-table` (2–4 columns, highlight, sticky first column on phones).
  - `offer`: the real buy box (the product theme blocks, `@app`) for a picked product, starting on a chosen tier and plan, with a guarantee line. It is the sticky CTA's `#Offer` target.
  - `sticky-cta`: shows after a scroll depth, hides while the offer is on screen, and is `inert` while hidden. Without JS it sits at the end of the page.
- **Landing layout:** `noindex, follow` by default (theme setting), overridable by the page's `blueprint.robots` metafield; `blueprint.header` = `full` swaps in the store header. The cart drawer is included.
- **URL contract (§9.3):** `snippets/cta-url.liquid` builds every CTA link: `variant` (the tier's variant), `selling_plan` (the tier's plan when the CTA is set to subscribe), `tier` and `plan`. `bp-core.js` adds `utm_*`, `fbclid`, `ttclid`, `gclid`, `msclkid`, `wbraid` and `gbraid` from the page's URL when a CTA is clicked, keeping the link's own parameters.
- **Templates:** `tools/templates-from-demo.mjs` builds each listing's `index`, `product`, `page.advertorial`, `page.listicle`, `page.comparison` and `page.about` from the reference copy into `listings/{clinical,editorial,bold}/templates/`, and copies Clinical into `templates/`. A CTA links to the tier its words name ("Try the discovery set") and to the subscription when it promises a discount. `cart.json` and `404.json` add best sellers.
- **Collection page:** `main-collection-banner` and `main-collection-grid` with filter pills (the first list filter), a GET filter form (checkboxes and price range), sort, active-filter chips, pagination, quick add and an empty state. `bp-facets.js` swaps results through the Section Rendering API with history support; without JS everything is links and a form. Search, blog, article, page, list-collections, 404 and password were rebuilt on the shared section settings.
- **Fixes found by the checks:**
  - Product settings now resolve to the full product object in the preview (as on Shopify), which exposed CTA links that always pointed at the base variant.
  - The filter panel no longer opens itself on desktop after load (it shifted the page).
  - Recommendations load from 1.5 screens away (`data-bp-load="near"`), so they arrive before the reader and don't push the footer.
  - The comparison table's hidden yes/no labels caused sideways scrolling on phones.
  - Listicle item titles sit one level below the list's heading.
- **Checklist:** `npm run check:landing` (`tools/preview/landing-checklist.mjs`), 567 checks, all pass:
  - every listing's pre-landers, about, contact, collection, home and product templates at 390 and 1440: no console errors, no sideways scrolling, every section renders, one h1, no axe violations, no layout shift on load and CLS under 0.1 while scrolling (the preview now preloads fonts as the theme does on Shopify);
  - robots default and override, landing header and the `full` override;
  - CTA deep links for tiers 1–3 × subscribe / one-time / default: the product page preselects the tier and plan with and without JS and posts that variant and selling plan;
  - campaign parameters carried on click (others not);
  - the offer starts on its tier and adds to cart (drawer with JS, cart page without);
  - sticky CTA hidden at the top, shown mid-article, hidden over the offer;
  - collection pills, chips, checkbox filters, price range, sort, back button and empty state, with and without JS.
  - The buy-box (451), cart (280) and sections (135) checklists still pass.
- **Screenshots:** `docs/screenshots/phase-5/` (`tools/preview/shoot-landing.mjs`).
- **Plan changes:**
  - A tier sold as another product's variant (Ode's discovery set) can't be a `?variant=`. Its CTA links carry only `tier` and `plan`; with JS the page opens on that tier, without JS on the default tier.
  - No inline pre-paint script for JS-only `tier`: switching the checked tier doesn't change any heights, so there's nothing to shift.
- **Still to verify on a store:**
  - that `"layout": "landing"` page templates and the landing section groups render as in the preview;
  - that `page.metafields.blueprint.robots` and `.header` read as expected once the definitions exist (Phase 6 seeding);
  - that Shopify's `filter.url_to_add` / `url_to_remove` and `price_range` values match the mock, and that filters return the section through `?section_id=`;
  - that `?variant=&selling_plan=` preselects the plan server-side.

#### Phase 3 delivered

- **One cart, two places:** `snippets/cart-contents.liquid` (and its `cart-*` snippets) renders the drawer (`sections/cart-drawer.liquid`) and the cart page (`sections/main-cart.liquid`).
  - The drawer is a static section in `layout/theme.liquid`, so its Section Rendering ID is always `cart-drawer`.
  - Settings live in the new theme settings group **Cart**: cart type, three rewards with currency overrides, protection, upsell, express checkout and the empty-cart collection.
- **Works without JavaScript:** every control is a real form.
  - Steppers and remove are GET forms to `routes.cart_change_url`, Shopify's `url_to_remove` pattern.
  - Gifts, protection and the upsell post to `routes.cart_add_url`.
  - Checkout posts `checkout` to the cart.
  - The cart page offers any earned gift that isn't in the cart, including a bundle tier's gift, which a no-JS add can't post.
- **Drawer:**
  - A modal `<dialog>` with `closedby="any"` plus a backdrop-click fallback.
  - Escape closes it, the background is inert, and focus returns to whatever opened it.
  - Its heading reads "Your cart (n)".
  - A polite live region and a `role=alert` sit outside the swapped markup.
  - Its stylesheet loads `media="print"` and switches on before the first open, so the drawer adds no render-blocking request.
- **JavaScript (`bp-cart.js`, 3.6 KB, idle-loaded):**
  - One Section Rendering request per interaction.
  - Stepper presses within 300 ms become one request.
  - Focus stays on the same control across swaps.
  - After an error it shows the message and re-renders from the server, because the change may have gone through.
  - `bp-core.js` opens the drawer from the header link and from `bp:cart:open` (Standard Actions `openCart` included). It also loads the module on demand and keeps the header count and its screen-reader label current.
  - The product form now asks for the drawer's section in its add request, so adding and opening cost no extra request.
- **Gifts and protection:**
  - `reconcile()` is a pure function, covered by 12 unit tests. It decides what to add or remove after each change: reward gifts by threshold, tier gifts that lost their bundle, and protection in an empty cart.
  - Default-on protection is added once and never again after the shopper touches it.
  - A removed reward gift counts as declined for the visit.
  - Line properties: `_bp_gift` (`reward` or `tier`), `_bp_reward` and `_bp_gift_for`.
- **Totals:**
  - The rows are Shopify's `items_subtotal_price`, each cart-level discount, and `total_price`.
  - The saving against compare-at or regular prices is a note, not a row, so the rows always add up.
- **Merchant setup:** `docs/merchant/cart-setup.md` covers the matching discounts for rewards, gifts and the upsell deal.
- **Checklist:** `npm run check:cart` (`tools/preview/cart-checklist.mjs`) runs 280 checks, and all pass.
  - The harness cart (`tools/preview/mock-cart.mjs`) behaves like Shopify's: line keys, nested lines, `sections`, and BXGY and deal discounts.
  - For each demo product it covers:
    - **Drawer:** opens with no reload; counts and labels; focus and inertness; axe on the drawer; figures equal the cart's own fields after every change.
    - **Rewards:** gifts follow thresholds up and down; declining and claiming back.
    - **Controls:** three stepper presses send one request; protection on and off; upsell exclusions.
    - **Errors and closing:** error alert plus re-render; Escape and close-button focus return; no layout shift on open; outside changes (Standard Actions); empty state.
    - **Cart page:** works in place with JS; axe.
    - **Without JS:** add, claim the tier and reward gifts, stepper, protection, upsell, remove, and checkout carrying the total.
- **Screenshots:** `docs/screenshots/phase-3/` has the drawer and cart page for every preset at 390 and 1440. No console errors; layout shift ≤ 0.01.
- **Not done:**
  - **Express checkout:** the buttons are behind a setting. Re-initialising them after a drawer swap needs a store to verify.
  - **Discount-mismatch warning:** the plan's editor-preview warning when thresholds don't match a discount isn't possible from Liquid, so it moves to the setup docs (Phase 8).
  - **Pre-lander drawer:** done in Phase 5; `layout/landing.liquid` renders the drawer, so the offer section adds in place.
- **Still to verify on a store:**
  - that `/cart/change` with a GET `id` (line key) and `quantity` redirects to the cart for any quantity, not only 0;
  - that `/cart/add.js` and `/cart/change.js` return `sections` with a static section ID;
  - that `parent_id` gift lines are removed with their bundle;
  - that `closedby` and focus return work in Safari;
  - the axe and screen-reader pass with VoiceOver.

#### Phase 2 delivered

- **Section:** `main-product`, with a gallery whose first image is the LCP (`fetchpriority="high"`, `preload: true`, real `sizes`), sticky info column, product structured data, and `@theme` + `@app` blocks.
- **Blocks:** 38 theme blocks (30 buy-box `product-*`, 6 content, 2 private). `templates/product.json` lays out the reference buy box; blocks with no real data (viewers, stock, award) ship disabled and render nothing without data.
- **Offers (§7):**
  - Tiers from `blueprint.tiers` or the pack option: variant, variant-size and mix modes.
  - Every figure comes from the variant or its selling-plan allocation, in integer cents. Savings round down. `tools/lib/offer-math.mjs` mirrors the Liquid and is unit-tested against the §7.4 Verde table.
  - All figures are pre-rendered per tier and plan; CSS `:has()` shows the checked ones, so prices are right with JS off.
  - Each tier subscribes to its own plan (`subscription_plan_hint`). Without JS the form can only post the default plan, so when the two differ both are rendered and CSS shows the one that will post.
  - Changing the delivery frequency re-renders the buy box for that plan (Section Rendering API), so the figures always match the plan in the form.
  - A gift tier adds its gift as a separate line with `parent_id` (retried without it) and the `_bp_gift` property.
- **JavaScript:** `bp-product.js` 3.0 KB, plus gallery, sticky bar, countdown and share modules, all lazy. Product page worst case (every block): JS 7.1 KB of 20 KB, CSS 6.2 KB of 30 KB. Both are now enforced by `tools/budget-check.mjs`.
- **Checklist (§16):** `npm run check:buybox` (`tools/preview/checklist.mjs`) runs 451 checks in Chromium against the offline preview, and all of them pass. It covers every product × tier × plan × JS on/off:
  - figures against `offer-math`, the selected style, gift badge, saving size and button total;
  - the posted variant, plan and quantity, the gift line, and the no-JS landing on `/cart`;
  - the preselected tier, under-button order, sticky bar, keyboard, `?tier=&plan=` deep links, and a flavour swap and a frequency change keeping state.
  - Checks 10–11 (cart and checkout totals) need a store.
- **Locales:** `tools/check-locales.mjs` runs in `npm test` and fails on any missing key.
- **Screenshots:** `docs/screenshots/phase-2/` (every preset at 390 and 1440, buy box on tier 3 + subscribe, sticky bar). No console errors; layout shift ≤ 0.017.
- **Still to verify on a store:**
  - that `/cart/add.js` accepts `parent_id` for the gift line;
  - that the last `id`/`quantity` value wins when the section's default inputs and a tier radio both post;
  - that blocks set `"disabled": true` in `product.json` stay hidden;
  - that dynamic checkout buttons read the synced `id` and `selling_plan` inputs;
  - Lighthouse PDP ≥ 90 and the comparison with Dawn.

**Inputs:**
- `docs/brief/START_HERE.md`
- `docs/brief/SPEC.md`
- `reference/Blueprint Theme v4.dc.html` and `reference/Blueprint Theme Compare.dc.html`
- `data/demo-content.json`, extracted from the reference demo because the bundle did not include it
- `docs/RESEARCH.md`

**Contents:**

0. Decisions needed before any code
1. Sales-page claims audit
2. Architecture and file tree
3. Presets, design tokens and settings
4. Section catalog
5. Product blocks (buy box)
6. Data: metafields and metaobjects
7. Bundles and subscriptions
8. Cart drawer
9. Pre-landers and the URL contract
10. Templates
11. Performance budget
12. AI kit
13. Updater and versioning
14. Demo stores
15. Delivery phases and acceptance criteria
16. Buy box checklist test
17. Risks
18. Open questions

---

## 0. Decisions needed before any code

Research found three things in the brief that cannot go ahead as written (RESEARCH, executive summary §1–2).

### D1. Base codebase: write original code, not a Dawn fork (recommended)

| Option | Sell direct ($149, Lemon Squeezy etc.) | Theme Store listing | Merchant edits layout in the customizer | Production-ready |
|---|---|---|---|---|
| Fork Dawn 16 (what the brief says) | **No.** The license allows derivatives "via the Shopify Theme Store" only | **No.** Theme Store §2 bars Dawn derivatives | Yes | Yes |
| Fork Horizon 4.3 | **No.** The license bars every channel | **No** | Yes | Yes |
| Keep Skeleton rc-v2 (this repo as-is) | **No.** Same license clause as Dawn | Codebase allowed, but the architecture fails Theme Store §5 | **No.** The template controls the layout | **No.** Developer preview only |
| **Original OS 2.0 code** (recommended) | **Yes** | **Yes** ("fully original code") | Yes | Yes |

**Recommendation:** write Blueprint as fully original code.
- **Architecture:** JSON templates, sections, header and footer groups, and theme blocks for the buy box.
- **Use of Dawn and Horizon:** we may read them to learn patterns (Section Rendering API, the standard-actions override), but we copy none of their code.
- **Reviewed against the stated requirements:** "8 templates", "edit everything in the customizer", "updates keep your settings and JSON templates", app blocks, and both sales channels. This option meets all of them.
- **Cost:** about 1–2 extra weeks of foundation work compared with a fork, mainly the cart, product form and variant JS. The performance budget wanted that JS rewritten anyway (§11).
- **Legal review:** ask a lawyer to confirm the clean-room approach before launch.

### D2. Distribution channel: decide now, commit by Phase 8

The code is the same either way. These things differ:

| | Direct sale (brief's model) | Theme Store |
|---|---|---|
| Price | $149, plus agency $249 and DFY $1,149 | $100–$500, with Theme Store-only distribution |
| License keys, agency license | Yes (Lemon Squeezy recommended) | Not allowed; Shopify licenses per store |
| Updates | Our `blueprint update` CLI (§13) | Shopify's update flow, at least 4 weeks apart |
| Demo stores | 3 required (Verde, Ode, Rawform); up to 10 | 1 per preset; **no apps** except free reviews or translation apps, so the subscription toggle can't be demoed live (unverified exception list) |
| Features that must change | None | "N people viewing" block cannot ship (no real data source); custom metaobject-typed settings may be disallowed (unverified) |
| Selling outside afterwards | Yes | No (exclusivity) |

**Recommendation:** launch direct, because it matches the pricing, DFY, agency and AI-kit model. Build to Theme Store rules anyway (§5 checklist, ethics rules, Lighthouse floors) so a later listing is a packaging decision, not a rewrite. A listing would end direct sales.

### D3. This repository and its `AGENTS.md`

- **The conflict:** this repo is `chrisdaddy/skeleton-theme`, Skeleton rc-v2. Its `AGENTS.md` forbids `sections/`, JSON templates and schema `presets`, which is exactly what D1 needs.
- **Recommendation:** continue in this repo, renamed `blueprint-theme` if you like, on a long-lived `main` branch.
- **Phase 0 steps:**
  1. Replace the Skeleton theme files with the original Blueprint foundation.
  2. Replace `AGENTS.md` with Blueprint's own conventions (draft in §2.4).
- **Approval:** both steps need your sign-off, because `AGENTS.md` is the repo's rulebook.

---

## 1. Sales-page claims audit

START_HERE says "every claim on that page must be true… If a claim can't be met, flag it." The table checks each claim from `reference/Blueprint Theme v4.dc.html` and `…Compare.dc.html` against this plan.

| Claim (where) | Status under this plan | Action |
|---|---|---|
| 3 presets: Clinical, Editorial, Bold | ✅ 3 theme styles in `settings_data.json` | none |
| 8 templates incl. 3 pre-landers | ✅ index, product, collection, cart, page.advertorial, page.listicle, page.comparison, page.about | none |
| "70+ sections, 30+ product blocks" | ✅ if layout presets count (SPEC §4 says they do): 52 merchant-addable section files in 72 "Add section" entries, plus 17 structural sections (§4). **37** product blocks (§5) | Wording: "70+ section layouts" is accurate. "100+ sections and product blocks" is also true (69 section files + 37 blocks = 106). |
| Native bundle and quantity-break block | ✅ variant-mode tiers, mix-mode bundles and bundle builder (§7) | none |
| Subscription toggle wired to selling plans, "no app" | ⚠️ The toggle is native, but **selling plans only exist through a subscription app** (Shopify Subscriptions is free) | Reword to "Wired to your selling plans. Works with Shopify Subscriptions (free), Recharge, Skio, Loop, Appstle." |
| Cart drawer: rewards bar, protection, one upsell | ✅ Gifts and in-cart deal prices use native **automatic discounts** the merchant sets up in admin (documented). That's no app, but a setup step. | none |
| Native advertorial, listicle and comparison pre-landers | ✅ | none |
| "94 mobile Lighthouse out of the box" / "11 points faster than Dawn" | ⚠️ Plausible only on an app-free demo store as a median of runs. The expected lead over Dawn is +2 to +6 points (estimate, RESEARCH Part 4 §3.3) | Replace with measured numbers and the published method once Phase 2 is done. Don't print "11 points" before it's measured. |
| "Faster than Dawn on the same products" | ✅ expected and measured in CI (§11) | none |
| "Built on Dawn" (footer) / FAQ "Dawn is the base…" | ❌ false under D1, and unsafe under Dawn's license | Rewrite as "Original code, built to Shopify's Online Store 2.0 standards". |
| "Lifetime v1 updates + updater app" / "The updater app swaps the theme files…" | ⚠️ A hosted app for all buyers is public distribution and needs App Store review | v1 ships an **updater tool** (CLI and AI-kit command, §13). Reword "app" to "tool". |
| AI kit works with "Claude, ChatGPT, Cursor, Gemini, Windsurf, any MCP client" | ⚠️ Local stdio works with Claude Desktop and Code, Cursor, Windsurf and Gemini CLI (Gemini unverified). **ChatGPT needs a remote HTTPS server, and write mode is limited to Business, Enterprise and Edu plans** | Drop ChatGPT from v1 copy, or ship the "deploy your own Worker" template in v1.1. |
| "Klaviyo, Judge.me, Loox, Okendo, Recharge, Shopify Subscriptions, Gorgias, Postscript, Triple Whale and Rebuy are tested on every release" | ⚠️ True only once a compatibility store with those apps exists and runs every release | Budget a compatibility store in Phase 8, or reword to the apps we actually test. |
| "Ten demo stores, all live" | ⚠️ The brief requires 3 (Verde, Ode, Rawform); the other 7 are optional | Build all 10 (about +1.5 weeks, §14), or reword to "three live demo stores, ten section stacks". |
| "v1.0.4 live · stores installed this week" | ❌ untrue before launch | Remove until true. |
| Results: "+31% CVR", "+$14 AOV", "−$3,048/yr" with founder quotes | ❌ cannot be true before launch. Fabricated testimonials breach the FTC rule on fake reviews (16 CFR 465) | Remove until real customers supply them, with permission. |
| Done-for-you "$1,000" vs "$1,149 incl. theme" | ⚠️ inconsistent across the page and the compare row | Pick one: $1,000 service + $149 theme = $1,149. |
| "System fonts by default" (problem/solution card) | ⚠️ contradicts the DM Sans and Instrument Serif presets | Reword to "One font family, preloaded, no layout shift". |
| Variant picker with swatches, sizes, strengths | ✅ | none |
| Quiz finder section | ✅ | none |
| Bundle builder with live total | ✅ | none |
| Clinical results, us-vs-them, before/after | ✅ | none |
| Video testimonials, UGC grid, comments | ✅ "Comments" must be real customer comments (§4 note) | none |
| Edit everything in the customizer | ✅ (D1) | none |
| No render-blocking app scripts | ✅ for the theme. Apps can still add their own | Reword to "no render-blocking scripts in the theme". |
| 14-day refund, Discord, DFY scope | Business claims, outside the theme | none |

---

## 2. Architecture and file tree

### 2.1 Principles

- **Online Store 2.0.** JSON templates, with sections everywhere except `gift_card.liquid`. Header and footer go in section groups.
- **A hybrid block model:**
  - **Theme blocks (`blocks/`)** for everything in the buy box. The same blocks render in `main-product`, `featured-product`, the pre-lander `offer` section and the quick-add sheet, so they need to be reusable. `@theme` and `@app` targeting, nested up to 8 levels.
  - **Section-local blocks** for repeating content items (study stats, FAQ items, ingredient rows). Merchants find these simpler, and they keep `blocks/` well under the 300-file limit.
- **No build step.**
  - Plain ES modules and CSS live in a flat `assets/`. Shopify minifies on delivery, and the Theme Store bans minified first-party code.
  - No jQuery, no framework. Web components only.
- **Per-component CSS.** Loaded only where the component renders, via `stylesheet_tag` inside the section or block. Critical tokens and layout CSS are inlined.
- **Every string in `locales/`.** Defaults come from the reference copy.
- **Native-first, app-friendly.** `@app` slots on the product, featured-product, pre-lander and cart surfaces. Nothing hard-depends on an app.

### 2.2 File tree (new = everything; Skeleton files are replaced)

```
layout/
  theme.liquid              # header-group, <main>, footer-group, cart drawer, standard actions bootstrap
  landing.liquid            # pre-landers: landing-header-group + landing-footer-group, noindex logic
  password.liquid
config/
  settings_schema.json      # §3: Quick style group first
  settings_data.json        # current + presets: Clinical, Editorial, Bold
sections/
  header-group.json  footer-group.json  landing-header-group.json  landing-footer-group.json
  (69 section files, listed in §4)
blocks/
  (37 product theme blocks, listed in §5, plus ~12 shared content blocks:
   _heading, _text, _button, _image, _icon, _rating-stars, _price, _stat, _badge, _divider, _spacer, _group)
snippets/
  tokens.liquid             # emits :root and scheme custom properties (§3)
  money-per-unit.liquid  savings.liquid  rating.liquid  icon.liquid  image.liquid
  tier-card.liquid  purchase-option.liquid  cart-line.liquid  rewards-bar.liquid
  meta-tags.liquid  structured-data.liquid  placeholder.liquid  …
templates/
  index.json  product.json  collection.json  cart.json
  page.advertorial.json  page.listicle.json  page.comparison.json  page.about.json
  404.json  search.json  blog.json  article.json  list-collections.json
  page.json  page.contact.json  password.json  gift_card.liquid
listings/                   # per-preset template content (Theme Store multi-preset layout; also used for demo seeding)
  clinical/templates/*.json  editorial/templates/*.json  bold/templates/*.json
locales/
  en.default.json  en.default.schema.json   (+ fr, de, es, … in Phase 8 if wanted)
assets/
  critical.css  base.css  component-*.css  section-*.css
  bp-core.js                # entry module, ~6 KB: pubsub, fetch queue, a11y helpers, lazy loader
  bp-product-form.js  bp-offer.js  bp-variant.js  bp-cart-drawer.js  bp-gallery.js
  bp-sticky-atc.js  bp-marquee.js  bp-counter.js  bp-before-after.js  bp-quiz.js
  bp-bundle-builder.js  bp-search.js  bp-standard-actions.js  …
mcp/                        # AI kit + updater (TypeScript package @blueprint/mcp, §12–13)
prompts/                    # 20+ prompt files (§12)
tools/                      # node scripts: contrast-check, budget-check, demo seed, zip, shot list
tests/                      # unit (node:test) + Playwright buy-box matrix + Lighthouse CI config
data/demo-content.json      # source of truth for demo content (already committed)
reference/                  # reference demo (already committed)
docs/                       # RESEARCH, PLAN, merchant docs, CHANGELOG, LAUNCH, SHOT_LIST
.github/workflows/ci.yml    # Theme Check, unit tests, budgets, contrast, (Lighthouse CI against dev store)
.shopifyignore              # mcp/ prompts/ tools/ tests/ data/ reference/ docs/
```

### 2.3 JavaScript architecture

- **Loading:**
  - `bp-core.js` is the only script on every page, loaded as `type=module`.
  - Components register custom elements and load their behaviour with `import()` when they become visible or the shopper interacts.
  - The cart drawer module loads on first hover or focus of the cart link, or immediately after an add to cart.
- **State and events:**
  - One mutation queue for all cart writes.
  - A `cart:updated` pubsub event that carries the source and the cart.
  - Standard Events dispatch for theme-initiated cart changes.
  - `Shopify.actions.openCart` and `updateCart` handlers registered in an inline script **above** `{{ content_for_header }}`.
- **Progressive enhancement:**
  - Every buy box is a real `<form action="{{ routes.cart_add_url }}">`.
  - Every cart link is a real `{{ routes.cart_url }}` link.
  - The drawer is a `<dialog>`.
  - With JS disabled, the shopper adds to cart and gets the cart page.

### 2.4 Proposed replacement `AGENTS.md` (summary; full text in Phase 0)

1. **Architecture:** OS 2.0. JSON templates. Header and footer groups.
2. **Blocks:** buy-box parts are theme blocks; content items are section blocks.
3. **Assets:** no `{% javascript %}` or `{% stylesheet %}`. CSS and JS live in `assets/`.
4. **Strings:** every string goes in locales. Storefront URLs come from `routes.*`.
5. **Money:** never in settings or metafields. Prices come from variants and selling-plan allocations only.
6. **Honest data:** no fabricated urgency, stock, viewers, reviews or comments in defaults.
7. **Budgets:** JS, CSS and contrast budgets are enforced by `tools/` in CI.
8. **Upstream code:** never copy code from Dawn or Horizon.
9. **Updates:** settings IDs are frozen once released. Releases are additive only in 1.x.

---

## 3. Presets, design tokens and settings

### 3.1 Tokens

These are the SPEC §1 tokens plus three tokens the contrast rule requires.

| Token | Source | CSS custom property |
|---|---|---|
| bg, surface, ink, line, accent, accentSoft, onAccent, star | settings (per mode) | `--bp-bg`, `--bp-surface`, `--bp-ink`, `--bp-line`, `--bp-accent`, `--bp-accent-soft`, `--bp-on-accent`, `--bp-star` |
| **muted** (new) | derived; overridable | `--bp-muted`: secondary text. Replaces the reference's opacity-faded text, which fails contrast. |
| **accentText** (new) | derived; overridable | `--bp-accent-text`: accent used *as text* on bg or accentSoft |
| **inputBorder** (new) | derived; overridable | `--bp-input-border`: 3:1 boundary for inputs and steppers (WCAG 1.4.11) |
| success, onSuccess | derived | FREE GIFT badge (START_HERE requires a green badge) |
| fonts, heading weight and tracking | font_picker + range | `--bp-font-body`, `--bp-font-head`, `--bp-head-weight`, `--bp-head-track` |
| radius, radiusSm, btnRadius | Corners select (+ custom) | `--bp-radius`, `--bp-radius-sm`, `--bp-radius-btn` |

**Derivation** happens in Liquid at render time, using `color_contrast`, `color_mix`, `color_darken` and `color_lighten`:
- `accentSoft` = 16% of the accent mixed into bg. This matches the reference editor.
- `onAccent` = whichever of ink or white contrasts more with the accent. The reference's luminance test (`lum > .55`) gave white on GOODBOY orange at 3.27:1.
- `accentText` = the accent, darkened (light mode) or lightened (dark mode) in 5% steps until it reaches ≥ 4.6:1 on both bg and accentSoft.
- `muted` = ink mixed toward bg at the strongest mix that keeps ≥ 4.6:1.
- Merchant overrides are blank by default. A blank override means "auto".

### 3.2 Contrast: the brief's presets fail its own rule; proposed fixes

Computed from `data/demo-content.json` (WCAG 2.x). ✗ = fails 4.5:1 for text or 3:1 for UI. The fix values are the minimum change that passes, and Phase 1 recomputes them in CI.

| Preset | Failing pairs as given | Proposed derived values |
|---|---|---|
| **Clinical** | muted 60%: 4.68 ✓; strike-through 50%: 3.40 ✗; line as input border: 1.30 ✗ | muted `#686F6B`, inputBorder `#919693` |
| **Editorial** | accent text on bg 4.40 ✗; accent on accentSoft 3.89 ✗; muted 3.99 ✗ | accentText `#A04C2C`, muted `#67615C`, inputBorder `#908A84` (button `#FFF8F0` on `#B5532E` = 4.70 ✓) |
| **Bold** | line 1.43 ✗ only | inputBorder `#616163` |
| VERDE | muted 4.42 ✗ | muted `#606B64` |
| KINDLY | accent on accentSoft 4.13 ✗ | accentText `#107372` |
| **DREAMR** | accent text 3.42 ✗ | accentText `#A375F2` |
| **GOODBOY** | **button text white on `#F0611A` = 3.27 ✗**; accent text 3.19 ✗ | onAccent → ink `#1F1A14` (5.29) or accent → `#C55015`; accentText `#AB4A18` |
| KINDLING | accent text 4.25 ✗ | accentText `#9B4E1D`, muted `#6B6259` |
| ODE, RAWFORM, ALLELE, STILLWATER, OMNI | input borders only | derived inputBorder |

**CI rule:** `tools/contrast-check.mjs` reads every preset and both modes from `settings_data.json`. It fails the build if any of these pairs falls below 4.5:1: ink/bg, ink/surface, muted/bg, muted/surface, accentText/bg, accentText/accentSoft, onAccent/accent, onSuccess/success, ink/accentSoft. It also checks that inputBorder/bg is ≥ 3:1.

### 3.3 `settings_schema.json` groups (in order)

1. **Quick style** (the four settings the reference editor exposes, SPEC §1):
   - `accent_color` (color)
   - `color_mode`: Light | Dark
   - `heading_style`: Sans | Serif
   - `corners`: Sharp 4/3/3 | Soft 12/8/999 | Round 18/12/14 | Custom
   - The three values are card / small / button radius in px. These match SPEC's Editorial, Clinical and Bold presets exactly. The reference editor mock uses slightly different numbers (3/2/3, 12/8/10, 18/12/999); SPEC wins (§18 Q14).
   - `Custom` reveals three range settings via `visible_if`.
2. **Colors, light mode:** bg, surface, ink, line, star. Optional overrides: accentSoft, onAccent, accentText, muted.
3. **Colors, dark mode:** the same fields.
4. **Typography:**
   - `type_body_font` (font_picker, default `dm_sans_n4`)
   - `type_heading_sans` (`dm_sans_n6`)
   - `type_heading_serif` (`instrument_serif_n4`)
   - heading tracking range (−6 to 0 → em/100)
   - heading scale
   - Instrument Serif has no bold in the font library, so `font-synthesis: none`.
5. **Layout:** page width, section spacing scale, grid gap.
6. **Product cards:** image ratio, quick add, rating, badges, hover image.
7. **Buy box defaults:**
   - savings reference: compare-at | singles price (§7.4)
   - per-unit label default
   - show per-month on multi-month tiers
   - subscription copy fallbacks
8. **Cart:**
   - type: drawer (default) | page
   - rewards tiers 1–3: label, threshold, gift variant, and a per-currency override map
   - shipping protection: product, default on or off, copy
   - upsell fallback collection and deal-price toggle
   - empty-state collection
   - dynamic checkout buttons on or off
9. **Pre-landers:** default header style; default robots: noindex+follow | follow | use page metafield (§9).
10. **Reviews:** provider (`auto | standard | judgeme | okendo | yotpo | loox | stamped | none`); theme rating schema off by default.
11. **Social, favicon, search, currency/language selectors, animations:**
    - reveal on scroll defaults off
    - all motion respects `prefers-reduced-motion`
12. **Advanced:** custom CSS hooks (optional), and the theme version stamp (read-only).

**Color schemes:** sections expose `surface_style`: Default | Surface | Accent | Inverse.
- Each style maps to a bg/text pair built from the same preset's tokens.
- Setting a section background therefore always sets its matching text color (SPEC §1).
- This replaces Dawn-style free-form color schemes. It keeps the settings count low and makes contrast verifiable.

### 3.4 Presets in `settings_data.json`

| | Clinical | Editorial | Bold |
|---|---|---|---|
| color_mode | Light | Light | Dark |
| Light set | SPEC Clinical | SPEC Editorial (cream) | proposed: bg `#FFFFFF`, ink `#0F0F12`, accent `#D8FF3D` (button only; accentText derived) |
| Dark set | proposed from OMNI (`#0B1526` family) | proposed: bg `#1C1814`, surface `#2A241F`, ink `#F6F1E8` | SPEC Bold |
| Headings | DM Sans 600, −0.04em | Instrument Serif 400, −0.01em | DM Sans 700, −0.05em |
| Corners | Soft (12/8/999) | Sharp (4/3/3) | Round (18/12/14) |
| Listing templates | `listings/clinical/` = Verde stack | `listings/editorial/` = Ode stack | `listings/bold/` = Rawform stack |

- **Why the "proposed" sets exist:** the brief defines only one mode per preset. A merchant flipping "Background: dark" on Clinical needs a designed dark set, so I've proposed values (§18 Q13).
- **The ten demo-store configs** (VERDE … STILLWATER) ship as `tools/demo/stores/<id>.json`, generated from `data/demo-content.json`. They are applied by the seed script, not shipped as theme presets. The Theme Store caps presets at 5.

---

## 4. Section catalog

**Counting.** There are 69 section files.
- 52 are merchant-addable (they have `presets`).
- Their layout presets give **72 entries** in the "Add section" picker.
- The other 17 are structural: header/footer group sections and the main sections of templates.

**Per-product rule (SPEC §4).** A section that shows product data reads in this order:
1. The bound product's metafield (§6).
2. The section's own blocks or settings.
3. Hide the section, but only if the merchant chose "hide when empty".

Theme editor dynamic sources are available on every text setting.

**Common settings on every content section:**
- `surface_style`
- padding top and bottom
- width (page | narrow | full)
- heading tag (h2/h3)
- "hide on mobile/desktop"
- custom CSS class
- `prefers-reduced-motion` handling is automatic.

### 4.1 SPEC §4 types (25 files, 39 picker entries)

| # | Section | Ref type (demo uses) | Key settings | Blocks | Metafield source | Picker presets |
|---|---|---|---|---|---|---|
| 1 | `hero` | hero (10) | `layout`: split, centered, full-bleed; eyebrow, heading, subheading, CTA label + link, rating note (auto from `reviews.*` of a picked product), image + mobile image, overlay opacity (bleed), `stats` toggle (centered) | stat (×4), button (×2), `@app` | rating of the picked product | **Hero: split**, **Hero: centered with stats**, **Hero: full-bleed** |
| 2 | `press` | press (7) | heading, style: logos/wordmarks, marquee on/off, speed, grayscale | logo (image or text) | — | **As seen in**, **Press marquee** |
| 3 | `badges` | badges (2) | style: pills or icons, alignment | badge (icon + text) | `blueprint.certifications` | **Trust badges** |
| 4 | `benefits` | benefits (3) | heading, columns 2–4, icon style (line or filled), layout grid or slider | benefit (icon, title, text) | `blueprint.benefits` | **Benefits grid**, **Benefits slider** |
| 5 | `study` | study (8) | heading, subheading, bar or ring style, source line, link | stat (value %, label) | `blueprint.studies` | **Clinical results** |
| 6 | `ingredients` | ingredients (8) | heading, subheading, columns shown, footer link label + URL or file (COA) | row (name, dose, why) | `blueprint.ingredients` | **Ingredients table** |
| 7 | `usvsthem` | usvsthem (6) | heading, "us" and "them" labels, highlight column | row (feature, us ✓/✗/text, them) | `blueprint.comparison` | **Us vs. them** |
| 8 | `subscription` | subscription (6) | heading, subheading, CTA (links to the PDP with `plan=sub`), product | tile (icon, title, text) | price text from the product's selling plan | **Subscription explainer** |
| 9 | `reviews` | reviews (13) | heading, layout carousel or grid, summary on/off, source: manual / standard metafield / app | review (quote, name, verified, image), `@app` | `reviews.rating`, `reviews.rating_count` | **Review carousel**, **Review grid** |
| 10 | `faq` | faq (18) | heading, first item open, JSON-LD on/off (default on), layout single or two-column | question (q, a rich text) | `blueprint.faqs` | **FAQ**, **FAQ (two columns)**, **Product FAQ** |
| 11 | `guarantee` | guarantee (4) | heading, text, days badge, CTA | — | `blueprint.guarantee` | **Guarantee** |
| 12 | `ticker` | ticker (4) | speed, direction, separator icon, pause on hover | item (text, icon) | — | **Scrolling ticker** |
| 13 | `features` | features (6) | heading, layout alternating or grid, image ratio | feature (kicker, title, text, image) | — | **Alternating features**, **Feature grid** |
| 14 | `stats` | stats (2) | heading, animate counters (respects reduced motion), columns | stat (value, prefix/suffix, label) | — | **Statistics**, **Statistics bar** |
| 15 | `videos` | videos (3) | heading, aspect 9:16 or 4:5, autoplay muted when visible, tap to unmute, poster | video (file or URL, quote, name) | — | **Video testimonials** |
| 16 | `quiz` | quiz (3) | eyebrow, heading, subheading, result CTA label, steps 1–4 | step (question), answer (label, result product, result text, URL params) | — | **Quiz finder** |
| 17 | `imagetext` | imagetext (6) | image side left/right, kicker, heading, text, CTA, image ratio | — | — | **Image with text**, **Image with text (right)** |
| 18 | `bundle` | bundle (5) | heading, subheading, min items, discount % (display, must match the automatic discount, §7.3), note, CTA, collection or product list | item (product) | — | **Bundle builder** |
| 19 | `countdown` | countdown (1) | heading, subheading, **mode**: fixed end date-time (default) or evergreen-per-visitor (off by default, labelled), hide when expired | — | — | **Offer countdown**, **Countdown bar** |
| 20 | `ugc` | ugc (4) | heading, columns, layout grid or row, link to post | item (image or video, handle, link), `@app` | — | **UGC grid**, **UGC carousel** |
| 21 | `comments` | comments (2) | heading, count label, source: manual (with a "must be real customer comments" note) or reviews app | comment (name, text, likes) | — | **Comments** |
| 22 | `beforeafter` | beforeafter (4) | heading, before and after labels and images, caption, start position, keyboard-operable slider | — | — | **Before / after** |
| 23 | `founder` | founder (2) | quote, name, role, portrait, signature image | — | — | **Founder note** |
| 24 | `collection` | collection (2) | collection, count, layout grid or carousel, quick add, rating, badges | — | — | **Featured collection**, **Collection carousel** |
| 25 | `steps` | steps (2) | heading, numbered or icon, layout | step (title, text, icon) | — | **How it works**, **How it works (icons)** |

### 4.2 Pre-lander sections (8 files, 10 entries)

| # | Section | Settings | Blocks | Presets |
|---|---|---|---|---|
| 26 | `article-header` | disclosure label (default "Advertisement" / "Sponsored", on), eyebrow, headline, lede, lead image | — | **Advertorial header** |
| 27 | `author-byline` | author name, avatar, role, date, read time (auto from word count when blank) | — | **Author byline** |
| 28 | `article-body` | measure (narrow), drop cap | text, image, pull quote, product card, CTA button, `@app` | **Article body** |
| 29 | `pull-quote` | quote, attribution, style | — | **Pull quote** |
| 30 | `listicle` | heading with `[count]` token (auto "7 reasons…"), numbering style, image side | item (title, body, image, CTA) | **Listicle** |
| 31 | `comparison-table` | columns 2–4, header labels, highlight column, sticky first column (mobile) | row (label, cells ✓/✗/text) | **Comparison table**, **Comparison table (3 columns)** |
| 32 | `offer` | product, default tier, default plan, guarantee line, headline. Renders the real buy box via the product theme blocks (§5) | product theme blocks, `@app` | **Final offer**, **Offer card (compact)** |
| 33 | `sticky-cta` | label, product, tier, plan (builds the deep link), show after scroll %, hide over the offer section | — | **Sticky CTA bar** |

### 4.3 Essentials (17 files, 21 entries)

| # | Section | Presets |
|---|---|---|
| 34 | `rich-text` | Rich text |
| 35 | `multicolumn` | Multicolumn |
| 36 | `image-banner` | Image banner, Image banner (split) |
| 37 | `slideshow` | Slideshow |
| 38 | `collage` | Collage |
| 39 | `newsletter` | Newsletter |
| 40 | `email-signup-banner` | Email signup banner |
| 41 | `contact-form` | Contact form |
| 42 | `featured-blog` | Blog posts |
| 43 | `collection-list` | Collection list, Collection tiles |
| 44 | `featured-product` | Featured product, Product spotlight (uses the product theme blocks) |
| 45 | `video` | Video |
| 46 | `custom-liquid` | Custom Liquid (Theme Store requirement) |
| 47 | `apps` | Apps |
| 48 | `related-products` | Related products, Complementary products |
| 49 | `content-tabs` | Content tabs |
| 50 | `divider` | Divider / spacer |

### 4.4 Global and structural (19 files)

Two of these are merchant-addable and count toward the 72 picker entries: `announcement-bar` (header group) and `sticky-atc` (product template). The other 17 are structural.

- **Layout:** `announcement-bar` (rotating messages; *picker in header group*), `header`, `header-minimal`, `footer`, `footer-minimal`, `cart-drawer`.
- **Product page:** `sticky-atc` (product template), `main-product`.
- **Collection, cart and search:** `main-collection-banner`, `main-collection-grid` (filters, sort, quick add, badges, rating), `main-cart-items`, `main-cart-footer`, `main-search`.
- **Other templates:** `main-404`, `main-blog`, `main-article`, `main-page`, `main-list-collections`, `main-password`.

**Totals:** 25 + 8 + 17 + 19 = **69 section files**. That is 52 merchant-addable (50 + `announcement-bar` + `sticky-atc`) and 17 structural. Picker entries: 39 + 10 + 21 + 2 = **72**.

**Limits respected:**
- At most 25 sections per template. The pre-lander stacks use 6–12.
- At most 50 blocks per section. The listicle and article body cap `max_blocks` at 40.
- No `enabled_on`/`disabled_on` on groups, which would block future updates.

---

## 5. Product blocks (buy box): 37 theme blocks

- **Location:** all are theme blocks in `blocks/`.
- **Where they can be placed:** `main-product`, `featured-product` and `offer` accept `@theme` + `@app`.
- **Default product template order** (✓ = on in the default template, — = available, off by default) follows the reference editor, then START_HERE's "under the button" order.

| # | Block (`blocks/…`) | Ref | Default | Notes / data source |
|---|---|---|---|---|
| 1 | `product-rating` | rating | ✓ | `reviews.rating` / `rating_count` or the provider setting. Hidden when there's no data, never "0 stars". |
| 2 | `product-viewers` | viewers | — | **Honest data only.** Renders only when `product.metafields.blueprint.live_viewers` is set by an integration. No randomness. **Excluded from a Theme Store build** (§0 D2). |
| 3 | `product-award` | award | — | text + optional logo |
| 4 | `product-title` | title | ✓ | h1, optional subtitle from `descriptors.subtitle` |
| 5 | `product-price` | price | ✓ | Price, compare-at, unit price, per-serving. Respects the "discount is never the biggest text" rule. |
| 6 | `product-benefits` | benefits | ✓ | `blueprint.benefits`, else block list; 2 columns |
| 7 | `product-stock` | stock | — | **Real inventory only.** Shows when `inventory_management` is on and quantity is ≤ the threshold. Never "at this price". |
| 8 | `product-offer-tiers` | bundle | ✓ | §7. Tiers, per-month headline, per-serving, savings, gifts, selection state |
| 9 | `product-purchase-options` | sub | ✓ | §7. One-time vs subscribe rows, savings stated, "cancel any time", plan frequency select. Auto-disables when a subscription app block is present. |
| 10 | `product-shipping-countdown` | shipping | — | "Order in 2h 14m for delivery by Thu" from a cutoff time, ship-days and a transit-days setting. Real calendar, no reset tricks. |
| 11 | `product-buy-buttons` | atc | ✓ | ATC (label shows the selected total), dynamic checkout on/off, gift-card recipient form, pickup availability |
| 12 | `product-guarantee` | guarantee | ✓ | one-line guarantee row |
| 13 | `product-moneyback` | moneyback | — | merchant-entered statistic with required source text |
| 14 | `product-payment-icons` | pay | ✓ | `shop.enabled_payment_types` (Shop Pay, Apple Pay, Google Pay, PayPal, cards, pay-in-4 where enabled) |
| 15 | `product-variant-picker` | — | ✓ | pills, swatches (Shopify swatch data, else a color setting), dropdown; per-option style |
| 16 | `product-gift` | — | — | standalone "FREE GIFT" display (the gift on tier cards is automatic) |
| 17 | `product-ingredients-popover` | — | — | `<dialog>` with the `blueprint.ingredients` table |
| 18 | `product-size-guide` | — | — | page or metafield content in a `<dialog>` |
| 19 | `product-delivery-estimate` | — | — | date range from settings |
| 20 | `product-trust-tiles` | — | ✓ | 3 icon tiles: guarantee, shipping, skip/cancel (START_HERE order) |
| 21 | `product-proof-line` | — | ✓ | ★ rating · review count · "N bought today" (the bought-today part is honest data only, §6; hidden otherwise) |
| 22 | `product-sticky-atc` | — | ✓ | Its presence enables the sticky ATC. Settings: show-after (box out of view), content, mobile/desktop. |
| 23 | `custom-liquid` | — | — | |
| 24 | `@app` | — | — | app blocks (Judge.me stars, Recharge widget, …) |
| 25 | `text` | — | — | |
| 26 | `icon-list` | — | — | |
| 27 | `accordion` | — | — | rich text, page or metafield content |
| 28 | `image` | — | — | |
| 29 | `divider` | — | — | |
| 30 | `product-quantity` | — | — | Hidden when tiers are on (the tier sets quantity) |
| 31 | `product-description` | — | — | |
| 32 | `product-badges` | — | — | product labels from tags or metafield |
| 33 | `product-share` | — | — | |
| 34 | `product-pickup` | — | — | pickup availability |
| 35 | `product-complementary` | — | — | `blueprint.upsell` → standard complementary products |
| 36 | `product-faq` | — | — | `blueprint.faqs` accordion |
| 37 | `product-popup` | — | — | link that opens a page in a `<dialog>` |

**Default under-the-button order** (START_HERE rule 2):
1. `product-buy-buttons`
2. `product-proof-line`
3. `product-trust-tiles`
4. `product-payment-icons`

**Gallery.** This is part of `main-product`, not a block:
- thumbnails, plus a badge overlay from `blueprint.badge`
- zoom loaded lazily
- **first image only:** `fetchpriority=high`, `preload: true` and explicit `sizes` (§11)

---

## 6. Data: metafields and metaobjects

**Rule: money is never stored in metafields.** Prices come only from variants and selling-plan allocations. Every metafield used for display text is optional and has a section-block fallback.

### 6.1 Product metafields (`blueprint.*` unless noted)

| Key | Type | Used by |
|---|---|---|
| `tiers` | list.metaobject_reference → `blueprint_tier` | offer tiers |
| `pack_option` | single_line_text (default "Pack") | which option axis means "tier" |
| `servings_per_unit` | number_integer | per-serving (e.g. 30) |
| `serving_label` | single_line_text ("serving", "stick", "chew", "ml") | per-unit label |
| `days_per_unit` | number_integer (default 30) | per-month headline |
| `benefits` | list.metaobject_reference → `blueprint_benefit` | benefits block and section |
| `ingredients` | list.metaobject_reference → `blueprint_ingredient` | ingredients table, popover |
| `coa` | file_reference | ingredients footer link |
| `studies` | list.metaobject_reference → `blueprint_study` | clinical results |
| `comparison` | list.metaobject_reference → `blueprint_comparison_row` | us vs them |
| `comparison_competitor_label` | single_line_text | us vs them |
| `faqs` | list.metaobject_reference → `blueprint_faq` | FAQ + JSON-LD |
| `guarantee` | metaobject_reference → `blueprint_guarantee` | guarantee block and section |
| `badge` | single_line_text | gallery badge ("NSF Certified") |
| `certifications` | list.single_line_text | badges section |
| `upsell` | product_reference | cart "Goes well with" and the complementary block |
| `cart_deal_label` (on the upsell product) | single_line_text | "$18 in cart". Hidden once the deal is seen not to apply after add (§8). Renamed from `upsell_deal_label` in Phase 3. |
| `sold_today` | number_integer | proof line. Written by a documented Shopify Flow template; hidden when missing or stale. |
| `sold_today_date` | date | staleness check |
| `live_viewers` | number_integer | viewers block (integration only) |
| `shot_note` | single_line_text | demo-only placeholder label |
| `reviews.rating`, `reviews.rating_count` | standard | stars everywhere |
| `descriptors.subtitle` | standard | title subtitle |

Variant metafield: `blueprint.pack_quantity` (number_integer).

Page metafields:
- `blueprint.header`: full | minimal | hidden
- `blueprint.robots`: index | noindex-follow
- standard `seo.hidden`, which adds noindex **and nofollow** (verified)

### 6.2 Metaobjects (storefront `PUBLIC_READ`, translatable)

**`blueprint_tier`:**
- `label`, `sublabel`
- `pack_value`: matches the Pack option value, so the tier works with any flavour or size combination
- `variant`: variant_reference, a fixed override that may point to another product, e.g. Allele's "Routine set"
- `quantity`: mix mode
- `badge`: "Most popular" / "Best value"
- `preselected`: boolean
- `gift_variant`: variant_reference
- `gift_value_label`: e.g. "$24 value"
- `subscription_plan_hint`: the selling-plan name to prefer, e.g. "Every 3 months" for a 3-pack
- `discount_title`: mix/discount mode only
- **No price fields.**

**Other metaobjects:**
- `blueprint_benefit`: `icon` (file or choice), `title`, `text`
- `blueprint_ingredient`: `name`, `dose`, `why`, `image`, `source_url`
- `blueprint_study`: `stat_value`, `stat_suffix`, `label`, `source`, `source_url`
- `blueprint_comparison_row`: `feature`, `us`, `them`
- `blueprint_faq`: `question`, `answer` (rich text)
- `blueprint_guarantee`: `title`, `days`, `body`, `icon`

### 6.3 Shipping the definitions

A theme cannot create definitions. Three routes:
- **v1:** a one-command setup in the AI kit, `blueprint setup-metafields`. It uses the merchant's own Dev Dashboard app to create the definitions (merchant-owned).
- **Documentation:** a manual click-path for merchants who prefer the admin.
- **Optional later:** a free "Blueprint Setup" public app.

Every block and section works without the definitions, by falling back to its own blocks.

---

## 7. Bundles and subscriptions

### 7.1 Tier model: one model, three modes

| Mode | When | How tiers map | Price source | Reconciles at checkout because |
|---|---|---|---|---|
| **Variant** (default) | Same item in packs: Verde, Omni, GOODBOY, Kindling, Rawform, DREAMR | Pack option values 1/2/3 (or a fixed `variant` reference) | pack variant `price` / `compare_at_price` | the variant price *is* the line price |
| **Variant (size)** | Sizes as tiers: Ode 10/50/100 ml | tier `variant` = size variant | variant price | same as above |
| **Mix** | Pick-any multipacks: Kindly 3-pack, Stillwater 3/5-pack | `quantity` N of any variants (bundle builder UI) | variant prices + a native automatic discount (min qty N), named by `discount_title` | the cart shows the real discount allocation; the theme shows the discount only after the cart confirms it |

**Why not Shopify Bundles or Cart Transform:** neither can be purchased with a selling plan (RESEARCH Part 2). Merchants who want shared-inventory kits can still use Shopify Bundles for one-time products; the tier UI renders bundle products like any variant.

### 7.2 Subscription toggle

- **Source:** reads `variant.selling_plan_allocations` for the selected tier variant. One percentage selling-plan group should cover all pack variants.
- **Display:**
  - Two rows: one-time and subscribe.
  - The subscribe row states the real saving, computed from the allocation `price` vs `compare_at_price`, which is the variant price.
  - "Cancel any time" comes from the plan description, else a locale default.
  - The frequency select appears only when there is more than one plan.
- **Rules:**
  - `subscription_plan_hint` picks the matching interval for multi-month packs. A 3-pouch tier defaults to "every 3 months", not monthly.
  - When `product.requires_selling_plan` is set, one-time is hidden.
  - With no plans (or after the app is uninstalled, when plans are deleted after 48 h) the block renders nothing.
- **App coexistence:** if a subscription app's own block is on the page, our block disables itself so the form never posts two `selling_plan` values.
- **Cart:** each line shows the plan name, which the Theme Store requires.

### 7.3 Add-to-cart matrix (acceptance-tested in §16)

| Tier × plan | No JS (form POST to `routes.cart_add_url`) | JS (`/cart/add.js` + `sections`) |
|---|---|---|
| T*n* × one-time | `id`=V*n*, `quantity`=1, `selling_plan`="" | `items:[{id:Vn,quantity:1,properties:{_bp_tier:n}}]` |
| T*n* × subscribe | `id`=V*n*, `selling_plan`=SP | `items:[{id:Vn,quantity:1,selling_plan:SP,…}]` |
| Tier with gift | gift not posted. The cart page offers a no-JS "Add your free gift" form when a qualifying line lacks its gift | append `{id:G,quantity:1,parent_id:Vn,properties:{_bp_gift:1}}` (nested line, removed with its parent; verify `parent_id` support in Phase 2). Price → $0 via an automatic Buy X Get Y discount the merchant creates (documented). |
| Mix mode | multi-line requires JS; the no-JS fallback is the plain variant form with quantity | `items:[…N lines…]` + automatic discount |

**Inputs:**
- Tier radios use `name="id"`, so the form works without JS.
- Plan radios use `name="selling_plan"`.

### 7.4 Math and honesty

Every number is computed from Shopify money in cents, in presentment currency.

- **Per-serving** = `price ÷ (servings_per_unit × pack_quantity)`, rounded half-up to the cent.
- **Per-month headline** (multi-month tiers) = `price ÷ months`, where months = `pack_quantity × days_per_unit ÷ 30`.
- **Savings %** = `floor((reference − price) ÷ reference × 100)`. Rounding down means we never overstate a saving.
- **Reference price** is a theme setting (§18 Q9):
  - **compare-at:** uses `compare_at_price`. This is what the reference demo shows: $142 vs $198.
  - **singles:** the tier-1 price × quantity, e.g. $142 vs 2 × $79 = $158, so 10%.
  - Default **compare-at only when compare-at is set**, else singles. Merchant docs explain that compare-at must be a genuine former or regular price.
  - *Flag:* in the demo data, the 2-pouch "was $198" is 2× a single's compare-at, not 2× its $79 price. The bundle saving against buying singles is therefore 10%, while the box claims 28%.
- **Visual hierarchy:** the headline is the per-month price or the total. The savings badge is smaller (START_HERE: "a discount is never the biggest text").

**Worked example, Verde** (30 servings/pouch, 20% subscription, compare-at reference):

| Tier | Plan | Total | Per month | Per serving | Compare-at | Save |
|---|---|---|---|---|---|---|
| 1 pouch | once | $79.00 | $79.00 | $2.63 | $99 | 20% |
| 1 pouch | sub | $63.20 | $63.20 | $2.11 | $99 | 36% |
| 2 pouches | once | $142.00 | $71.00 | $2.37 | $198 | 28% |
| 2 pouches | sub | $113.60 | $56.80 | $1.89 | $198 | 42% |
| 3 pouches | once | $199.00 | $66.33 | $2.21 | $297 | 32% (not 33%: rounded down) |
| 3 pouches | sub | $159.20 | $53.07 | $1.77 | $297 | 46% |

*Reference bug:* the demo hardcodes "Subscribe & save 15%" for every store, while Verde's own copy says 20% ("$63/mo"). The theme reads the percentage from the selling plan.

### 7.5 Gifts and tier defaults

- **Gifts:**
  - Each gift tier shows a green **FREE GIFT** badge with a gift icon and its value ("Free travel packs · $24 value"), using the success / onSuccess tokens.
  - The gift is added as a nested $0 line.
- **Default tier and badge:** the default selection is the tier with `preselected`, else the "Most popular" tier.
- **Selected state:**
  - 2px accent border
  - accentSoft fill
  - filled radio
  - `aria-checked`

---

## 8. Cart drawer

Architecture from RESEARCH Part 3, Implications A.

- **Containers:**
  - **`<bp-cart-drawer>`:** wraps a native `<dialog>`, opened with `showModal()` and `closedby="any"`. That gives Escape to close, an inert background and focus return. Its heading is "Your cart (n)". The trigger is a real `/cart` link.
  - **Live region:** `#bp-cart-status` (polite) and `role=alert` errors, both **outside** the swapped HTML.
- **Rewards bar `<bp-rewards-bar>`:**
  - Up to 3 tiers from theme settings: label, threshold and optional gift variant. Defaults come from each store's `rewards`, e.g. Free shipping → Free shaker → Free travel packs.
  - **Progress basis:** merchandise lines after discounts, excluding gifts and protection, in presentment currency.
  - **Thresholds:** per-currency overrides via a JSON setting or shop metafield. Otherwise a converted amount labelled "about".
  - **Gift add/remove:** a pure `(cart, tiers) → {add, remove}` function. Gift lines are tagged `_bp_gift`. A shopper's decline is remembered.
  - **Discounts:** the merchant creates matching automatic discounts (free shipping over $X; BXGY with a minimum amount for gifts). The setup checklist in the docs, plus a "thresholds don't match a discount" warning in the theme editor preview, keep them aligned.
- **Lines:** quantity stepper (debounced 300 ms into one queue), remove, plan name, nested gift, compare-at and final price.
- **Shipping protection:**
  - A merchant-created product (`requires_shipping: false`) with a $2.95 default variant and the "Loss, theft and damage covered" description.
  - The toggle's default comes from a setting. **We recommend off.** If on, it's added once per cart, always visible, and never re-added after a removal. A June 2026 class action against Route alleges pre-checked protection is a hidden fee (RESEARCH Part 3).
  - Excluded from rewards math, upsells and search (`seo.hidden`).
- **"Goes well with":** exactly one upsell.
  - Source order: `blueprint.upsell` → standard complementary products → fallback collection. Excludes items in the cart, gifts and protection.
  - The deal price ("$18 in cart") shows only when the setting is on. After the add, the line's `final_price` is checked; if the discount didn't apply, the label disappears on the next render.
- **Totals:**
  - Shopify's `cart.items_subtotal_price`.
  - Real discount rows from `cart_level_discount_applications` and line allocations. In mix or discount mode the row is labelled "Bundle discount".
  - Shopify's `cart.total_price`.
  - **Deviation from SPEC §6:** in variant mode there is no discount to subtract, so a subtraction row would not add up. A highlighted "You're saving $56 with your bundle" note appears under the subtotal instead.
- **Checkout area:**
  - Checkout button (shows the total), "Secure checkout", payment icons.
  - `content_for_additional_checkout_buttons`, behind a setting with documented speed cost.
  - No discount-code field. Discount codes are entered at checkout, and the Theme Store forbids cart-level code UI.
- **Empty state:** best-seller collection, with stars and quick add.
- **Requests:**
  - ≤ 3 sections per Section Rendering API call: drawer, icon bubble, status.
  - 1 request per interaction, plus at most 1 gift reconcile.
  - After any 4xx, re-fetch `/cart.js`, because the mutation may still have succeeded.
- **Standard Actions:**
  - `openCart` opens the dialog.
  - `updateCart` runs `defaultHandler`, then one GET for the drawer sections, then gift sync, then `cart:updated`.
  - The handlers are registered above `content_for_header` in a `DOMContentLoaded` listener (only the first `configure()` wins).
- **Cart page (`cart.json`):** the same components in page form. This is the no-JS fallback for the gift and protection forms.

---

## 9. Pre-landers and the URL contract

### 9.1 Templates and layout

- **Templates:** `page.advertorial.json`, `page.listicle.json` and `page.comparison.json` use `"layout": "landing"`, which is verified to be supported in JSON templates.
- **Layout `landing.liquid`:**
  - Keeps `{{ content_for_header }}`, so pixels, analytics and Web Pixels work as normal.
  - Renders `landing-header-group`: the minimal header, with styles hidden | logo | logo + CTA.
  - Renders `landing-footer-group`: policies + disclosure.
- **Per-page header override:** the `blueprint.header` page metafield.
- **Campaign pages** are separate templates (`page.advertorial-mothers-day.json`), created with the editor's "Create template" or the AI kit. All pages that use one template share its section settings.

### 9.2 Pre-lander settings (SPEC §3)

| Setting | Where | Notes |
|---|---|---|
| noindex | page metafield `blueprint.robots` (index / noindex-follow), plus theme default "pre-landers: noindex, follow" | Merchants may also use native `seo.hidden`, but it adds **nofollow** too |
| Hidden or minimal header | landing layout, plus the `blueprint.header` page metafield | — |
| CTA product | `product` setting on `offer`, `sticky-cta` and every CTA block | — |
| CTA preselection | tier (1–3) and plan (sub/once) settings, plus an optional variant | Liquid builds the link server-side |

### 9.3 URL contract

The CTA link is built by Liquid:

```
{{ product.url }}?variant=<tier variant id>&selling_plan=<allocation id if plan=sub>&tier=<n>&plan=<sub|once>
```

UTMs and click IDs (`utm_*`, `fbclid`, `ttclid`, `gclid`) from the pre-lander's own URL are appended in JS and never stripped.

| Param | Resolved | Validation and fallback |
|---|---|---|
| `variant` | server (native) | must belong to the product, else the first available |
| `selling_plan` | server (native) | ignored unless it's in the variant's allocations |
| `tier` | JS (Liquid can't read custom params) | 1–3 or a tier handle, else the preselected tier. In variant mode the CTA already sets `variant`, so the server renders the correct state. |
| `plan` | JS, mirrors `selling_plan` | `sub` with no valid plan becomes `once` |

- **Precedence:** `variant` > tier-mapped variant > default. `selling_plan` > `plan` > the product default.
- **No layout shift:**
  - Tier cards always reserve the same height.
  - Preselection only switches the checked state.
  - A tiny inline script sets `data-bp-tier` before first paint when JS-only params are used.

### 9.4 Content shapes (SPEC §7, defaults from `adv` / `list`)

- **Advertorial:** article-header (disclosure on) → byline → article-body (lede, sections, pull quote) → comments → offer (guarantee line) → sticky-cta. CTA: "Check availability →", deep-linked with the preselected tier.
- **Listicle:** heading "7 reasons 41,000 people…", where `[count]` updates automatically → listicle items → offer → sticky-cta.
- **Comparison:** hero → comparison-table → reviews (highlights) → offer.

**Compliance notes in the merchant docs:**
- An advertorial needs a clear "Advertisement" disclosure (FTC native-advertising guidance). It defaults on and can't be hidden without a warning label in the editor.
- Comments and reviews must be genuine (16 CFR 465).

---

## 10. Templates

| Template | Default stack (from `home` / `pdp` in `data/demo-content.json`; Verde shown) |
|---|---|
| `index.json` (Clinical listing) | hero (split) · press · badges · benefits · study · ingredients · usvsthem · subscription · reviews · faq · guarantee |
| `product.json` | main-product (buy box §5) · ingredients · study · usvsthem · faq · related-products · sticky-atc |
| `collection.json` | main-collection-banner · main-collection-grid (filter pills from `filters`, sort, quick add, badges, rating) |
| `cart.json` | main-cart-items · main-cart-footer (same components as the drawer) · collection (best sellers) |
| `page.advertorial.json` | §9.4 |
| `page.listicle.json` | §9.4 |
| `page.comparison.json` | §9.4 |
| `page.about.json` | hero (bleed) · founder · features · imagetext · stats · reviews · newsletter |
| `404`, `search`, `blog`, `article`, `list-collections`, `page`, `page.contact`, `password`, `gift_card.liquid` | polished to the preset: tokens, type, radius, surface styles |

The Editorial and Bold listings get their own `index.json` and `product.json` from the Ode and Rawform stacks.

---

## 11. Performance budget

PDP, mobile, first load, theme-owned bytes only. Rationale and the Dawn baseline are in RESEARCH Part 4 §3.

| Resource | Budget | Dawn 16 PDP (measured) |
|---|---|---|
| Theme JS, initial | **≤ 20 KB** compressed (hard cap 25), ≤ 3 requests | ~38 KB gzip, ~21 files |
| Theme JS, lazy | ≤ 40 KB total, chunks ≤ 12 KB, loaded on interaction or visibility | all loaded up front |
| CSS | ≤ 30 KB compressed total (≤ 12 KB inlined critical) | ~44 KB, ~27 files |
| Render-blocking in `<head>` | ≤ 3 | — |
| Fonts | ≤ 2 preloads, ≤ 4 files, `font_display: swap` | — |
| LCP image | ≤ 120 KB; `fetchpriority=high`, `preload: true`, correct `sizes` | eager only |
| CLS from theme | ≤ 0.02 (announcement bar: fixed min-height, transform rotation; sticky ATC: fixed + transform) | — |
| Main-thread work from theme JS | no long task > 50 ms at 4× CPU | — |

**Targets:**
- Mobile Lighthouse on the demo PDP: Performance ≥ 90 **and** greater than Dawn on the same store and product (median of 7 interleaved runs).
- Accessibility, Best Practices and SEO ≥ 95.
- Theme Store floors (60 / 90 on home, product and collection, mobile + desktop) as a CI gate.

**CI enforcement:**
- `tools/budget-check.mjs`: bytes and request counts from a rendered page.
- `lighthouse-ci` against the dev store: needs store access (§18 Q1).
- A published benchmark method replaces the "94" and "11 points" copy (§1).

**Reduced motion:** marquees, counters, before/after auto-sweep, reveal animations and the hero carousel all stop under `prefers-reduced-motion`.

---

## 12. AI kit (`mcp/` + `prompts/`)

**Package:** `@blueprint/mcp`, TypeScript.
- **Transport:** stdio.
- **Distribution:**
  - npm (`npx -y @blueprint/mcp`) for Claude Code, Cursor, Windsurf and Gemini CLI.
  - A signed `.mcpb` for Claude Desktop, which collects the shop domain and app credentials as sensitive config.
- **Auth:**
  - The merchant creates a Dev Dashboard app in their org with scopes `read_products`, `read_metaobjects`, `read_themes`, `write_themes` and online-store page read/write.
  - The server uses the client-credentials grant and refreshes the 24 h tokens.
  - It also accepts legacy `shpat_` tokens.

**Tools:**

| Tool | Class | Safety rail |
|---|---|---|
| `list_themes`, `get_current_preset`, `list_sections`, `read_template`, `read_settings`, `read_products`, `read_metafields`, `read_reviews` | read | `readOnlyHint`; paginated; output ≤ 50k chars; review text wrapped as data |
| `create_draft` | write (new theme) | `themeDuplicate` of the live theme → "Blueprint AI draft – date"; recorded in the server's draft registry |
| `diff_draft` | read | unified diff + `change_token` (hash of planned files + base checksums) |
| `update_block_settings`, `apply_template_change`, `draft_listicle_from_reviews`, `draft_advertorial_from_reviews` | write, draft only | requires a matching `change_token`; validated against Blueprint's section schemas; file allowlist `templates/*.json`, `sections/*-group.json`, `config/settings_data.json` |
| `create_page_from_template` | **live-store write** | pages created **unpublished** only, with explicit confirmation; disclosed in docs |
| `revert_draft_file` | write, draft only | restores the snapshot |
| `setup_metafields` | write (definitions) | idempotent; additive only |

**Rails enforced in code:**
- Before every write, re-query the theme role. Proceed only if it is UNPUBLISHED or DEVELOPMENT **and** the ID is in the draft registry.
- `themePublish` and `themeDelete` are not in the binary at all; a CI test greps for them.
- An operation allowlist of persisted GraphQL documents.
- Optimistic concurrency using `checksumMd5`.

**Reviews:**
- `read_reviews` order: Judge.me API → Okendo storefront API → Yotpo → Stamped → CSV upload.
- Loox has no API, so it uses the CSV route.

**Prompts:** `prompts/*.md` with front-matter, registered as MCP prompts and also usable as plain files. The 22 planned:
1. listicle from top reviews
2. advertorial from reviews
3. Mother's Day advertorial
4. comparison page vs competitor
5. add benefits row to the PDP
6. benefit icon set brief
7. make Editorial warmer
8. switch preset and preview
9. bundle tiers from margins
10. move the "Most popular" badge
11. FAQ from support tickets
12. ingredients table from a label
13. clinical-results section from a study PDF
14. us-vs-them from a competitor page
15. rewards thresholds from AOV
16. subscription explainer copy
17. hero A/B variants
18. shot list from products
19. translate a pre-lander
20. audit the PDP against the buy-box rules
21. accessibility pass on custom copy
22. update the theme

**Docs:**
- Claude Desktop, Claude Code and Cursor setup.
- ChatGPT: "not in v1", with a v1.1 "deploy your own remote server" template (Cloudflare Worker) that keeps hosting at no cost to us.

**Launch blocker to verify in Phase 7:** whether `themeDuplicate`, `themeCreate` and `themeFilesUpsert` work from a merchant-owned Dev Dashboard app on a real paid store without a `write_themes` exemption. If not, fall back to Theme Access password + Shopify CLI.

---

## 13. Updater and versioning

- **Versioning:**
  - SemVer, starting `v1.0.0`.
  - `theme_info.theme_version` is stamped.
  - `CHANGELOG.md` follows Keep a Changelog.
  - Release zips are built by `tools/zip.mjs`, which excludes non-theme folders.
- **Update policy for 1.x:**
  - Additive only: never rename or remove setting, section or block IDs.
  - Never lower `max_blocks` or `limit`.
  - Deprecated settings are kept and hidden with `visible_if`.
  - Shopify's automatic-update rules follow the same constraints.
- **Updater (direct-sale channel): `blueprint update`**, run as a CLI or by asking the AI kit:
  1. Validate the license key with Lemon Squeezy, using the shop domain as the instance.
  2. Get a short-lived signed zip URL from our small serverless function.
  3. `themeCreate` → a new **unpublished** theme "Blueprint 1.0.x".
  4. Read `settings_data.json`, `templates/*.json`, `sections/*-group.json` and `locales/*.json` from the live theme.
  5. Apply declarative, idempotent `migrations/<from>-<to>.json`. Show a diff, plus the list of code files the merchant edited (detected with a checksum manifest).
  6. `themeFilesUpsert` the merchant files into the new theme, at most 50 per call.
  7. The merchant previews and publishes. The old theme stays as the rollback.
- **No license check inside the theme.** It doesn't stop piracy and it risks paying merchants' stores (RESEARCH Part 5). Elixir copies are resold on Etsy and nulled-theme forums anyway.

### 13.1 Sales, delivery and licensing: own stack, Elixir-style (decided Q6)

**How Elixir does it.** Its own site, ecomelixir.com, was blocked from this environment, so this comes from search extracts and reviews:
- **Storefront:** sells direct from its own storefront. The URL patterns (`/products/elixir-shopify-theme`, `/pages/bundle-builder`) indicate a Shopify store.
- **Licensing:** one license per store, at $200 per license. A "bundle builder" discounts multi-license purchases (2–3 licenses).
- **Delivery:** an `ElixirShopifyTheme.zip` download plus a "Web Portal" for managing licenses in one place.
- **Updates:** "all V1 updates for life". The "Automatic Theme Updater" is described as a web app, "almost finished", that lets merchants connect a custom app to their store. Until it ships, merchants keep customizations by merging the old JSON values into the new files by hand.
- **Other terms:** 30-day money-back guarantee and a Discord community. Prices rise as updates ship.

Sources: [product page](https://ecomelixir.com/products/elixir-shopify-theme), [recent updates](https://ecomelixir.com/pages/recent-updates), [bundle builder](https://ecomelixir.com/pages/bundle-builder), [DropMagic review](https://dropmagic.ai/shopify-themes/elixir-theme-review), [SectionStore review](https://sectionstore.io/shopify-themes/elixir-theme-review/). These pages couldn't be opened directly; the details come from search-result extracts.

**Blueprint does the same, finished.**

| Piece | Choice |
|---|---|
| Storefront and checkout | A Blueprint-owned Shopify store (e.g. blueprinttheme.com) **running Blueprint itself**, which doubles as a live demo. Products: Theme (1 store) $149, Agency (5 licenses) $249, extra license $49, DFY $1,149. |
| Delivery at purchase | The zip is attached to the product with Shopify's free Digital Downloads app (download link on the order confirmation), plus the portal below. |
| License keys | **Blueprint Portal**, a small serverless app (Cloudflare Worker + D1, roughly $0–5/month). An `orders/paid` webhook from the store mints keys: 1 for Theme, 5 for Agency. A key binds to a `*.myshopify.com` domain on first activation. Merchants can self-serve a transfer (deactivate, then reactivate), with a limit per month. |
| Portal for buyers | Magic-link sign-in with the order email. It lists keys and activations, downloads every release zip, shows the changelog, and links to setup docs and Discord. |
| Updates | `blueprint update` (§13) validates the key against the Portal and fetches a signed release URL. A hosted "connect your store" web updater is v1.1: our own App Store app with a `write_themes` exemption, or the merchant's custom app as Elixir plans. |
| Refunds | Refunds are issued in the store admin. The webhook revokes the key. |

- **Trade-off vs Lemon Squeezy:** selling from our own Shopify store makes us the **seller of record**, so VAT/GST on digital goods sold to EU, UK and AU buyers is ours to collect and file (Shopify Tax can calculate it). Lemon Squeezy, as merchant of record, would handle that. It stays the fallback if the tax admin outweighs owning the checkout.
- **Effort:** Phase 8 grows by about 1 week (Portal + webhook + magic-link auth).
- **Fallbacks:** a documented Shopify CLI script, then a manual zip + copy-JSON guide.
- **Theme Store channel:** Shopify's update flow. Merchant JSON is preserved, and updates are spaced at least 4 weeks apart.
- **v1.1 (Nov):** quiz pre-lander, meaning `page.quiz.json` plus the `quiz` section in a full-page layout.
- **v1.2 (Dec):** two more presets, bringing the total to 5. That is the Theme Store maximum, so there is room.

---

## 14. Demo stores

**Required (START_HERE):** one development store per preset:

| Store | Preset | Templates and stack |
|---|---|---|
| Verde | Clinical | `listings/clinical` |
| Ode | Editorial | `listings/editorial` |
| Rawform | Bold | `listings/bold` |

**Seeding** with `tools/seed-demo.mjs <store>`, via the Admin GraphQL API and one Dev Dashboard app (client credentials grant; see `docs/demo-stores.md`):
- **Products and variants:** `productSet`, with Pack option values priced from the tiers. Rawform: Flavour × Size × Pack = 24 variants.
- **Content:** metaobjects and metafields from the store's `product`, `home` and `pdp` blocks.
- **Collections:** from `collection` and `filters`.
- **Pages:** advertorial, listicle, comparison, about.
- **Commerce config:** selling plans via Shopify Subscriptions (needs the free app installed). Automatic discounts for gifts, rewards and the upsell deal.
- **Theme:** settings from the store's preset values; protection product.

**Images:**
- Labelled placeholder images: generated SVG → PNG uploaded as product media, carrying the `photo` text.
- `docs/SHOT_LIST.md` is generated from every `photo` field.

**Optional:** the other 7 stores (about 1.5 weeks with the script) are needed only if the "ten live demo stores" claim stays (§1).

---

## 15. Delivery phases and acceptance criteria

Every PR follows the same rules:
- one feature
- Theme Check clean
- no console errors
- keyboard reachable
- contrast CI green
- a written summary plus screenshots at 390px and 1440px for each preset

| Phase | Scope | Acceptance criteria | Est. |
|---|---|---|---|
| **0. Setup** | D1–D3 decisions; repo reset to an original foundation; new `AGENTS.md`; CI (Theme Check, node tests, contrast check, budget check); dev stores connected | CI green on an empty foundation; `shopify theme dev` runs on all 3 stores | 2 d |
| **1. Foundation** | tokens + settings (§3), 3 presets, fonts, layouts (theme, landing, password), header/footer groups, announcement bar, header, footer, base CSS, `bp-core.js`, a11y primitives (dialog, disclosure, focus ring), Standard Events/Actions bootstrap | all 3 presets × light/dark pass the contrast CI; zero CLS from the announcement bar; JS ≤ 8 KB on a blank page | 1.5 wk |
| **2. Product page** | `main-product`, gallery, 37 blocks, tiers (3 modes), subscriptions, gifts, trust stack, sticky ATC, quick-add sheet, structured data | the §16 checklist passes for every tier × plan × JS on/off on Verde, Ode and Rawform; Lighthouse PDP ≥ 90 and > Dawn | 3 wk |
| **3. Cart drawer** | drawer + cart page, rewards, gifts, protection, upsell, totals, dynamic checkout, empty state, Standard Actions handlers | no full reloads; focus trap, Escape and live announcements verified with axe and a manual screen-reader pass; gift and protection edge cases tested | 2 wk |
| **4. Content sections** | the §4.1 and §4.3 sections, with presets and metafield fallbacks | each section renders all demo stores' content from `data/demo-content.json`; reduced motion respected | 3 wk |
| **5. Templates + pre-landers** | the 8 templates + polish set; landing layout; pre-lander sections; URL contract | deep links preselect correctly with and without JS; noindex verified; no CLS | 1.5 wk |
| **6. Demo stores** | seed script, 3 stores, shot list | the 3 stores match the reference at 390/1440 (side-by-side screenshots) | 1 wk |
| **7. AI kit** | MCP server, 22 prompts, setup docs | end to end on a real store: drafts a listicle from real reviews into a draft theme; refuses to write to the live theme (test) | 2 wk |
| **8. Updater + docs + launch** | `blueprint update`, migrations framework, Blueprint Portal (license keys, downloads, §13.1), sales store, CHANGELOG, merchant docs, LAUNCH.md (zip, license keys, Theme Store checklist), app-compatibility pass | updating a customised store from 1.0.0 to 1.0.1 preserves settings and templates (test); a test purchase mints a key, binds it to a store, and a refund revokes it | 2.5 wk |

**Total:** about 19 weeks for one engineer, or less with parallel tracks after Phase 1.

---

## 16. Buy box checklist test

**Combinations:**
- tier ∈ {1, 2, 3} × plan ∈ {one-time, subscribe} × JS ∈ {on, off} = 12 combinations per product.
- Products: Verde (variant), Ode (variant-size), Rawform (variant with 2 option axes), plus Kindly (mix mode) if seeded.

**Automation:**
- Playwright drives the dev store.
- Pure-math assertions run offline under `node:test`.

| # | Check |
|---|---|
| 1 | Single unit shown alongside the tiers, never one price alone |
| 2 | Each tier shows: quantity or supply; per-month headline on multi-month tiers; total; per-serving; struck compare-at (when the reference is compare-at); savings % or $ |
| 3 | The preselected tier is the configured "Most popular" / "Best value" one |
| 4 | The subscribe row states the real saving % from the selling plan, and "cancel any time" |
| 5 | Selected state has a heavier border, tinted fill and filled radio, and `aria-checked=true` |
| 6 | A gift tier shows a green FREE GIFT badge with an icon and stated value |
| 7 | Under the button, in order: stars + count (+ bought-today only if real data); 3 trust tiles; payment marks |
| 8 | The sticky ATC appears once the buy box leaves the viewport and causes no CLS |
| 9 | Displayed per-serving × servings × packs = displayed total (± rounding rule); savings % = floor(computed) |
| 10 | After add: `/cart.js` line `final_line_price` = displayed total; `selling_plan_allocation` matches the chosen plan; gift line present at $0 |
| 11 | At checkout: the subtotal equals the cart total (Playwright reads the checkout summary on a test-mode store) |
| 12 | The savings badge's font size is smaller than the headline price |
| 13 | Keyboard: every tier, plan and ATC is reachable and operable; screen-reader names are correct |
| 14 | Deep link `?tier=&plan=&variant=` selects the same state as a click |

---

## 17. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| License or legal reading of "original code" | Launch blocker | Clean-room rules in `AGENTS.md`; no copy-paste from Dawn or Horizon; legal review before sale |
| `write_themes` exemption for merchant apps | AI kit and updater writes fail | Test in Phase 0 on a paid store; Theme Access + CLI fallback |
| Discounts the merchant must configure (gifts, rewards, upsell deal, mix mode) drift from theme settings | Displayed ≠ charged | Displayed discounts appear only after the cart confirms them; setup checklist; seed script creates them for the demo stores |
| Selling plans need an app; Theme Store demo stores can't run apps | Subscription demo gap on the Theme Store | Direct channel first; document it |
| "Better than Dawn" margin is small | Claim fails | Lazy-load every CRO feature; CI comparison; publish real numbers only |
| Standard Actions / Events are new (June 2026) and may change | Drawer breaks for agent or app updates | Isolated in `bp-standard-actions.js`; tested against the Dawn reference behaviour |
| `{% partial %}` / `{% block %}` reach GA mid-build | Temptation to switch | Stay on Section Rendering API for v1; revisit for v2 |
| Fabricated social proof in merchant hands (comments, viewers, testimonials) | FTC exposure for merchants; refund risk for us | Honest-data defaults, editor warnings, documentation |

---

## 18. Open questions (answer once; the plan's defaults are in brackets)

1. **Development stores** (not created yet; see Decisions log): URLs and access (collaborator access + a Dev Dashboard app per store). Three stores: Verde, Ode, Rawform. [needed for Phase 0]
2. ~~Distribution channel~~ **Decided:** direct first, Theme Store rules later.
3. ~~Base and repo~~ **Decided:** original code; replace Skeleton and `AGENTS.md`; this repo.
4. ~~Subscription app~~ **Decided:** Shopify Subscriptions first; any selling-plan app supported.
5. ~~Reviews app~~ **Decided:** Judge.me first; provider setting for the rest.
6. ~~License and delivery platform~~ **Decided:** own Elixir-style stack: own Shopify store + Blueprint Portal (§13.1); Lemon Squeezy as fallback.
7. **Real product photography timing.** [placeholders + shot list until then]
8. **Sales-page claims (§1):** approve the rewording, removal of the testimonials and "v1.0.4 live", and the DFY price.
9. **Savings reference:** compare-at or "vs singles"? [compare-at when set, else singles; docs on genuine compare-at prices]
10. **Shipping protection default.** [off]
11. **Ten demo stores:** build all ten, or reword the claim? [build three; reword]
12. **Viewer-count block:** ship it, honest-data only (direct build), or drop it? [ship, off by default, data-gated; excluded from any Theme Store build]
13. **Dark/light counterparts:** approve the proposed values for the Clinical dark, Editorial dark and Bold light sets (§3.4), and the contrast fixes (§3.2).
14. **Corner radii:** SPEC presets (4/3/3, 12/8/999, 18/12/14) and the reference editor mock (3/2/3, 12/8/10, 18/12/999) disagree. [SPEC wins]
15. **Brand logo:** `brand/logo/blueprint-mark-white.svg` was not in the bundle. It's needed for docs and the AI-kit branding (Blueprint blue `#2446D6`).
