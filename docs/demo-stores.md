# Demo stores

Three development stores show the presets with the reference demo's content: Verde (Clinical), Ode (Editorial) and Rawform (Bold). Their data and theme come from `data/demo-content.json`, the same copy the offline preview renders, so the preview and the stores agree.

| Store | Preset | Domain (shopify.theme.toml) |
|---|---|---|
| Verde | Clinical | `verde-yhnern1q.myshopify.com` |
| Ode | Editorial | `odel-zrfdxbxc.myshopify.com` |
| Rawform | Bold | `rawform-t0oqfonb.myshopify.com` |

The other seven reference stores (Omni, Kindly, Dreamr, GOODBOY, Kindling, Allele, Stillwater) have configs too. They're optional, and their data is less finished (see "Optional stores").

## What gets seeded

`tools/demo/stores/<store>.json` holds everything (regenerate it with `node tools/demo/build-stores.mjs`):

- **Products:**
  - The hero product, with its pack or size options and prices from the reference tiers.
  - The best sellers and the upsell.
  - The gift products.
  - Shipping protection.
  - Inventory: 120 of each variant.
- **Metaobjects and metafields:**
  - Metaobjects for tiers, benefits, ingredients, study results, comparison rows, FAQs and the guarantee.
  - Their definitions, in `tools/demo/definitions.mjs`. The Phase 7 AI kit will reuse them.
  - `reviews.*` and `descriptors.subtitle` (standard definitions).
- **Subscriptions:** a "Subscribe & save N%" selling plan group (every 1, 2 or 3 months) when the reference states a subscription saving.
- **Collections:** "Best sellers", plus one smart collection per product type.
- **Pages:** advertorial, listicle, comparison, about and contact, each with its template.
- **Menus:** the main menu and the footer menu.
- **Automatic discounts.** Everything the theme promises is backed by one:
  - free shipping over the first reward threshold;
  - reward gifts over their thresholds;
  - the bundle tier's gift;
  - the upsell's "$N in cart" deal;
  - mix-tier quantity discounts.

  All are titled "Blueprint demo: …".
- **Images:**
  - Labelled placeholder PNGs, one per `photo` in the reference.
  - They're uploaded under fixed file names that are listed in `docs/SHOT_LIST.md`.
  - Replacing a file with a real photo of the same name updates the store everywhere.
- **Theme** (`tools/demo/theme.mjs`):
  - The release theme, with the store's templates (section photos point at the uploaded placeholders).
  - Its colours.
  - Cart rewards, gifts, protection and upsell settings that match the discounts.
  - An announcement-bar notice: "Demo store: sample products, prices and reviews".

Money only comes from variants and selling plans. The labels that state an amount ("$18 value", "$18 in cart") are checked against the real prices and discounts by `tests/unit/demo-seed.test.mjs`.

## One-time setup

1. **Create the seed app** in the [Dev Dashboard](https://dev.shopify.com/dashboard):
   - Use the organization that owns the three dev stores, and call the app "Blueprint demo seeder".
   - In a new version, select these Admin API access scopes, then release it:

     `write_products`, `write_inventory`, `read_locations`, `write_metaobject_definitions`, `write_metaobjects`, `write_files`, `write_publications`, `write_purchase_options`, `write_discounts`, `write_online_store_pages`, `write_online_store_navigation`
2. **Install the app** on Verde, Ode and Rawform.
   - The stores must be dev stores in the same organization; that is what lets the seed use the client credentials grant.
   - A store created from the Shopify admin rather than the Dev Dashboard may not be in the organization. The token request then fails with `shop_not_permitted`.
3. **Add the credentials as environment variables** in the cloud environment's settings. Never paste them into a chat or a file.
   - `BLUEPRINT_SEED_CLIENT_ID` and `BLUEPRINT_SEED_CLIENT_SECRET`: the app's client ID and secret from its settings page.
   - `SHOPIFY_CLI_THEME_TOKEN_VERDE`, `SHOPIFY_CLI_THEME_TOKEN_ODE`, `SHOPIFY_CLI_THEME_TOKEN_RAWFORM`: Theme Access passwords, used for the theme push.
   - Optional: the storefront passwords (**Online Store → Preferences → Password protection**), used to screenshot the stores: `BLUEPRINT_STORE_PASSWORD_VERDE`, `BLUEPRINT_STORE_PASSWORD_ODE` and `BLUEPRINT_STORE_PASSWORD_RAWFORM`. `BLUEPRINT_STORE_PASSWORD` covers all three if they share one.
   - Behind an HTTPS proxy, `tools/store.mjs` passes it to Shopify CLI as `SHOPIFY_HTTPS_PROXY`. Theme Access passwords go through `theme-kit-access.shopifyapps.com`, which the network policy must allow.

   An Admin API access token per store, `SHOPIFY_ADMIN_TOKEN_<STORE>`, also works instead of the app credentials.
4. Start a new session so the variables load.

## Seeding

```sh
node tools/seed-demo.mjs verde --dry-run      # what a first run would create (in-memory, no network)
node tools/seed-demo.mjs verde                # seed the store (safe to re-run; only changes what differs)
node tools/demo/theme.mjs verde --push        # push the demo theme as an unpublished "Blueprint demo" theme
```

- **Steps:** run a subset with `--steps=products,metafields`, or skip some with `--skip=files`.
- **Images:** existing placeholders are kept. `--refresh-images` re-renders them and replaces them in place, so the products and sections using them update.
- **Order:** shop, definitions, files, collections, products, metaobjects, metafields, selling plans, publish, pages, menus, discounts.
- **Publishing the theme:** do it by hand in the admin (Online Store → Themes), after a look in the theme editor.

## Manual steps the API can't do

- **Collection filters:** in the Search & Discovery app, add **Product type** to the storefront filters. The collection page's pills use the first list filter. Availability and price filters are on by default.
- **Subscriptions:**
  - The seed creates the selling plans, so the subscribe toggle shows real allocations and prices.
  - To check out a subscription, the store needs a subscription app that manages contracts, such as the free Shopify Subscriptions app.
- **Currency:** the prices are USD. The seed warns if the store's currency differs.

## Verifying

```sh
node tools/demo/compare.mjs verde ode rawform --target=store [--theme=<theme id>]   # reference vs the store, 390 and 1440
node tools/demo/compare.mjs verde ode rawform                                       # reference vs the offline preview
cd tools/demo && npm install && node validate-operations.mjs                        # every seed call against the Admin schema
```

- **compare.mjs** writes `docs/screenshots/phase-6/<store>-<page>-<width>.jpg`, with the reference on the left and Blueprint on the right.
- **validate-operations.mjs** downloads the published Admin API schema (shopify.dev's public schema proxy). It seeds each store against the in-memory admin and validates every operation and its actual variables with graphql-js.

## Optional stores

Configs build for all ten reference stores, and `--dry-run` works for each. Before seeding the seven optional ones, review their data:

- **Kindly and Stillwater** use mix tiers ("3-pack, any scents"), backed by quantity discounts. Their bundle builder items map to separate products rather than to the hero's variants.
- **Allele's routine set** is a separate product.
- **Thresholds:** reward gifts beyond free shipping aren't modelled for these stores; only the free-shipping threshold, taken from their announcement bar, is set.

They also need an `[environments.<store>]` entry in `shopify.theme.toml`, and the app installed on the store.
