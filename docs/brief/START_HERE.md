# START HERE: Blueprint Theme on Dawn

You are Claude Code, working inside a Shopify theme project that is already set up: Shopify CLI is installed and a Dawn base has been pulled. This bundle tells you exactly what we are building and how good it needs to be. Read all of it before writing any code:
- this file
- `SPEC.md`
- `data/demo-content.json`
- the reference in `reference/`

## What we are building
**Blueprint Theme** is a premium Shopify Online Store 2.0 theme, built on Dawn, for physical-product DTC brands. Think supplements, skincare, pet, fragrance, coffee, apparel: brands doing $50k–$1M+ a month on paid social. It is the storefront Blueprint DTC builds for $500k/mo clients, packaged as one theme.

It sells for **$149 once**, with done-for-you setup at **$1,149** and an agency license at **$249**. The promise, from the sales page in `reference/Blueprint Theme v4.dc.html`:

> Your ads are good. Your store is losing the sale. Branded presets, native pre-landers, bundles, subscriptions, a cart that sells, and an AI kit so you can change any of it by asking.

Every claim on that page must be true of the theme you ship:
- 3 presets (Clinical, Editorial, Bold)
- 8 templates
- 70+ sections and 30+ product blocks
- a native bundle and quantity-break block
- a subscription toggle wired to selling plans
- a cart drawer with rewards bar, shipping protection and one upsell
- native advertorial, listicle and comparison pre-landers
- faster than Dawn on mobile Lighthouse
- an updater that preserves settings
- an AI kit (MCP server + prompt library)

If a claim can't be met, flag it in the plan. Do not quietly ship less.

Open `reference/Blueprint Theme v4.dc.html` in a browser (serve `reference/` with `npx serve`). Its interactive demo is the **visual and behavioral target**:
- 10 demo stores × 6 page tabs
- the buy box
- bundles
- the cart drawer
- the pre-landers
- the mock theme-editor panel with toggleable blocks and theme settings

The demo is the theme running. Your job is to make it real Liquid.

## Step 0: deep research before you build (required)
Do not write theme code until you have produced `docs/RESEARCH.md` and `docs/PLAN.md` and I have approved the plan. Research with the web and the Shopify docs, and cite sources inline. At minimum, cover:

1. **Dawn internals (current version)**
   - file structure and Horizon-era changes
   - section and block schema
   - `settings_schema.json` and `settings_data.json` presets
   - how Dawn's cart drawer, product form, variant picker, predictive search, quick add and section rendering API work
   - where Dawn is slow, and what to remove or defer
2. **Theme Store requirements and quality bar**, whether or not we list there:
   - accessibility
   - performance thresholds
   - required templates
   - Theme Check
   - no hard-coded strings (locales)
   - app blocks
   - `@app` support
   - color schemes
3. **Selling plans and subscriptions**
   - the selling plan Liquid objects
   - `selling_plan_groups`
   - how the product form submits a `selling_plan`
   - per-variant allocation, pricing display and compare-at with subscription
   - compatibility with Shopify Subscriptions, Recharge, Skio, Loop and Appstle
4. **Bundles and quantity breaks without an app**
   - options: quantity tiers mapped to variants; multi-line add via `/cart/add.js` with `items[]`; Shopify Functions (Cart Transform, Discount) for real bundle pricing
   - the trade-offs of each, and which the theme can do natively versus with the free Shopify Bundles app
   - discount display that reconciles in cart and checkout
5. **Cart drawer best practice**
   - Cart AJAX API, section rendering, and the `cart:updated` event pattern
   - free-shipping and rewards progress bar logic
   - shipping protection as a product line (how leading apps do it, and the theme-native equivalent)
   - upsell from product metafields or a collection
   - Shop Pay and dynamic checkout buttons
6. **Pre-landers on Shopify**
   - page templates with alternate JSON templates (`page.advertorial.json` etc.)
   - keeping the pixel and analytics on the same domain
   - noindex options
   - linking the CTA to a product with a preselected variant, bundle tier or selling plan via URL params
7. **Performance**
   - LCP image strategy (`image_url` widths, `fetchpriority`, `loading`)
   - font loading for DM Sans and Instrument Serif via the Shopify font library, or self-hosted woff2 in assets
   - JS budget: web components, no jQuery, defer everything below the fold
   - CLS from the announcement bar and sticky ATC
   - how to beat Dawn's mobile Lighthouse score on the same store
8. **Theme editor UX**
   - block presets
   - `visible_if` conditional settings
   - section groups (header and footer groups)
   - color schemes vs. our presets
   - sensible defaults so a brand-new store looks finished on install
9. **Metafields and metaobjects** for content that varies per product:
   - benefits
   - ingredients table
   - study results
   - us-vs-them rows
   - FAQ
   - reviews summary
   - guarantee copy
   - upsell product
   - bundle tiers

   Ship metafield definitions or setup instructions plus graceful fallbacks.
10. **Reviews and UGC integrations**: Judge.me, Okendo, Yotpo, Loox, Stamped. App blocks versus metafields for rating stars, review counts and photo reviews.
11. **AI kit (MCP)**
    - how to build an MCP server (TypeScript, the MCP SDK) that uses the Shopify Admin GraphQL API
    - read: products, metafields, theme files, settings
    - write: only to a duplicated **unpublished draft theme** through the Asset API / `themeFilesUpsert`
    - auth with a custom app token
    - which tools to expose
    - the prompt library format
    - safety: never publish, and diff before write
12. **Updater**: how to ship versioned updates that preserve merchant settings. Options: a Theme Kit / CLI-based script, a small embedded app, or GitHub-based distribution. Pick one for v1, document the migration strategy for `settings_data.json` and JSON templates, and explain what merchants actually do to update.
13. **Competitive teardown**: Impulse, Prestige, Motion, Shrine, Booster and the top 3 paid themes for supplements and skincare.
    - what they do in the buy box, cart and pre-landers
    - their Lighthouse scores
    - what merchants complain about in reviews
    - where we beat them

`docs/PLAN.md` must include:
- **Architecture:** a file tree of new and changed files.
- **Sections:** the full section and block catalog mapped to the reference (see SPEC §4), with each section's schema settings.
- **Data:** the metafield and metaobject definitions.
- **Presets:** how the three presets map to `settings_data.json`.
- **Bundles and subscriptions:** the bundle and subscription approach, with its chosen trade-offs.
- **Cart drawer:** the cart drawer architecture.
- **Pre-landers:** the pre-lander URL-param contract.
- **Performance:** the performance budget.
- **AI kit and updater:** the AI kit and updater design.
- **Demo store:** the demo-store build plan (seed products from `data/demo-content.json`).
- **Delivery:** phases with acceptance criteria, risks, and open questions for me.

**Stop after `PLAN.md` and wait for my approval.**

## Non-negotiables
1. **Fidelity:**
   - Match the reference demo's look and behavior per preset: spacing, type, radii, buy box, cart drawer, pre-landers.
   - When the reference and Dawn disagree, the reference wins.
   - Copy in the reference is the default content, moved into locales and section defaults.
2. **Buy box rules** (these apply to every buy box we ship):
   - **Layout:**
     - Show the single unit next to the bundle and supply tiers (IM8-style), never one price on its own.
     - Each tier shows the quantity or supply length, the price per month as the headline number on multi-month tiers, the total, the per-unit or per-serving price, a struck-through compare-at, and savings as a % or $ amount.
   - **Defaults and selection:**
     - Put "Most popular" or "Best value" on the best-margin tier and make it the default selection. This is configurable per product.
     - Subscribe vs one-time is a clear toggle or set of rows. State the subscription saving and "cancel any time" plainly.
     - Make the selected state unmistakable: heavier border, tinted fill, filled radio.
   - **Gifts and trust:**
     - Free gifts are a green "FREE GIFT" badge with a gift icon and a stated value, attached to the tiers that earn them.
     - Under the button, in order:
       - star rating, review count and a "bought today" line
       - three icon tiles: guarantee, shipping, skip/cancel
       - payment marks: Shop Pay, Apple Pay, Google Pay, PayPal, cards, pay-in-4
     - A sticky add-to-cart appears once the box scrolls out of view.
   - **Math:**
     - Per-unit prices, savings % and totals must reconcile with each other and with the cart and checkout.
     - A discount is never the biggest text in the box. The bundle and its value come first.
3. **Brand blue:** Blueprint blue is `#2446D6` (deep `#172C9A`, light `#8FA4F5`). Use it for Blueprint-branded surfaces such as the theme's own admin docs and the AI kit; merchant presets use their own colors.
4. **Native first:** no app is required to get the promised features. Integrate with apps through app blocks, and never hard-depend on one.
5. **Quality gates on every PR:**
   - Theme Check clean.
   - No console errors.
   - Mobile Lighthouse on the demo product page: Performance ≥ 90, Accessibility ≥ 95, and beating stock Dawn on the same store and product.
   - Keyboard reachable.
   - Contrast 4.5:1 in every preset.
   - Works with JS disabled for add to cart: progressive enhancement over Dawn's form.
6. **Locales:** every string lives in `locales/en.default.json` and the schema locales. No hard-coded copy in Liquid.
7. **Merchant settings:** never break them. Every update must keep existing `settings_data.json` and JSON templates working (a migration script if needed).
8. **Process:** small PRs, one feature each, with a short Loom-style written summary and screenshots at 390px and 1440px for each preset.

## Build order (after plan approval)
1. **Foundation:**
   - fork Dawn cleanly into `blueprint-theme`
   - design tokens as CSS custom properties driven by theme settings
   - 3 presets in `settings_data.json`
   - fonts
   - header and footer groups
   - announcement bar with rotating messages
   - remove or defer Dawn JS you don't need
2. **Product page:**
   - the buy box block system: 14+ blocks (see SPEC §5)
   - variant picker as pills or swatches
   - quantity breaks and bundle tiers
   - subscription toggle with selling plans
   - gifts
   - trust stack
   - sticky ATC
   - gallery with thumbs and a badge
3. **Cart drawer:** rewards bar with tiers from settings, shipping protection, one upsell, cross-sell, subtotal with bundle discount line, dynamic checkout, empty state.
4. **Content sections:** the full catalog from SPEC §4, each with presets and defaults, driven by metafields where per-product.
5. **Templates:**
   - `index`, `product`, `collection`, `cart`
   - `page.advertorial`, `page.listicle`, `page.comparison`, `page.about`
   - plus `404`, `search`, `blog` and `article` polished to the preset
6. **Pre-landers:** the URL-param contract into the PDP (`?tier=2&plan=sub&variant=`), and noindex toggles.
7. **Demo stores:**
   - Seed one development store per preset (Verde = Clinical, Ode = Editorial, Rawform = Bold) from `data/demo-content.json` with products, metafields, collections and pages.
   - The others are optional.
   - Image slots use labeled placeholders until real photography lands. Write a shot list from the `photo` fields.
8. **AI kit:**
   - an `mcp/` package: TypeScript MCP server with tools such as `list_sections`, `read_template`, `draft_listicle_from_reviews`, `update_block_settings`, `create_page_from_template` and `diff_draft`
   - it always works on a duplicated unpublished theme
   - plus `prompts/`, a prompt library with 20+ tested prompts
   - plus setup docs for Claude Desktop, Cursor and ChatGPT connectors
9. **Updater + docs:**
   - the versioning and update path
   - `CHANGELOG.md`
   - merchant docs: install, presets, buy box setup, selling plans, bundles, cart, pre-landers, AI kit
   - `LAUNCH.md` covering packaging the zip for sale, the license key approach, and the Theme Store submission checklist

## Ask me (once, up front, in PLAN.md)
- the development store URLs and access
- the subscription app we target first
- the reviews app we target first
- whether we pursue Theme Store listing (it changes licensing and updater constraints)
- the license and delivery platform (Lemon Squeezy, Gumroad or Payhip)
- real product photography timing

## Definition of done
- Every claim on the sales page is true.
- Three preset demo stores look like the reference demo at 390px and 1440px.
- The buy box rules pass a written checklist on every tier combination.
- Lighthouse targets are hit with screenshots.
- Theme Check is clean.
- The MCP server drafts a listicle from real reviews into a draft theme end to end.
- Merchant docs are written.
