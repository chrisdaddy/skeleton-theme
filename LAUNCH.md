# Launching and releasing Blueprint

This is the owner's runbook. It covers:
1. the one-time launch setup: Portal, sales store, packages;
2. every release: version, zip, publish;
3. licence-key operations;
4. the app-compatibility pass;
5. the Theme Store checklist, for a later listing.

The plan behind it is `docs/PLAN.md` §13. Merchant-facing docs are in `docs/merchant/`.

Secrets never go in this repository or in chat. Put them in Cloudflare (`wrangler secret put`), in the sales store's admin, or in the environment settings of the machine that runs the command.

---

## 1. One-time launch setup

### 1.1 Blueprint Portal (licence keys and downloads)

The Portal is a Cloudflare Worker with D1 and R2 (`portal/`). Its README lists every route.

1. **Create the database and bucket:**
   ```sh
   cd portal
   npx wrangler d1 create blueprint-portal           # copy the database_id into wrangler.toml
   npm run db:init                                   # applies schema.sql
   npx wrangler r2 bucket create blueprint-releases
   ```
2. **Set the domain.** Check the `[vars]` in `wrangler.toml` (`PORTAL_URL`, `EMAIL_FROM`, `DOCS_URL`, `DISCORD_URL`). Then add the custom domain to the Worker in the Cloudflare dashboard.
3. **Set up email.** Verify the sending domain in Resend (SPF and DKIM records), so magic-link emails arrive.
4. **Add the secrets:**
   ```sh
   npx wrangler secret put SHOPIFY_WEBHOOK_SECRET    # from step 1.2, once the webhooks exist
   npx wrangler secret put SIGNING_SECRET            # openssl rand -hex 32
   npx wrangler secret put RESEND_API_KEY
   ```
5. **Deploy:** `npm run deploy`.
6. **Smoke test:** opening `https://portal.blueprinttheme.com/` shows the sign-in page.

### 1.2 Sales store

The sales store is a Shopify store that runs Blueprint itself, so it doubles as a live demo.

1. **Create the store** and add it to `shopify.theme.toml`:
   ```toml
   [environments.sales]
   store = "<sales-store>.myshopify.com"
   ```
2. **Seed the four licence products** from `tools/sales/store.json`: Theme $149, Agency $249, Extra licence $49 and Done-for-you $1,149.
   - Each product is digital and never sells out, and carries the SKU the Portal reads.
   - A unit test checks that the SKUs and the Portal agree.
   - Credentials come from the environment, as for the demo stores (`docs/demo-stores.md`).
   ```sh
   node tools/seed-demo.mjs sales --config=tools/sales/store.json --steps=shop,collections,products,publish --dry-run
   node tools/seed-demo.mjs sales --config=tools/sales/store.json --steps=shop,collections,products,publish
   ```
3. **Add the webhooks:** **Settings → Notifications → Webhooks**, JSON format, latest API version.

   | Event | URL |
   |---|---|
   | Order payment | `https://portal.blueprinttheme.com/webhooks/orders/paid` |
   | Refund create | `https://portal.blueprinttheme.com/webhooks/refunds/create` |
   | Order cancellation | `https://portal.blueprinttheme.com/webhooks/orders/cancelled` |

   Then copy the signing secret shown under the webhook list into `SHOPIFY_WEBHOOK_SECRET` (step 1.1.4).
4. **Attach the zip at purchase.** Install Shopify's free **Digital Downloads** app and attach `dist/blueprint-<version>.zip` to the Theme, Agency and Extra licence products. Buyers then get a download link on the order confirmation, as well as the Portal.
5. **Set up the confirmation email.** Edit the order confirmation notification so it links to the Portal (`https://portal.blueprinttheme.com/`) and the [getting-started guide](docs/merchant/getting-started.md).
6. **Set up taxes.** We are the seller of record for digital goods (PLAN §13.1). Turn on Shopify Tax and register for EU, UK and AU digital-services VAT/GST as thresholds require.
7. **Write the policies:** a 14-day refund policy, and terms that state the licence covers one store per key.

### 1.3 Acceptance: a test purchase

Do this on the live Portal before opening sales.

1. **Buy.** With the payment provider in test mode, buy **Blueprint (1 store)** with an email you can read.
2. **Get the key.** Sign in at the Portal with that email. The key appears, with "Not used yet".
3. **Bind the key.** Run the updater against a development store with that key (§2.4, `--dry-run` is enough). The key now shows that store in the Portal.
4. **Refund.** Refund the order in the admin. The key shows as revoked, and the updater refuses it ("this key was revoked").
5. **Check the Agency pack.** Buy one, and confirm it mints 5 keys. Refund one unit, and confirm only one key is revoked, unused keys first.

The same flow runs offline in `cd portal && npm test` (Node's SQLite standing in for D1).

### 1.4 Packages

- **npm:**
  - Reserve the `@blueprint` scope, or rename the package in `mcp/package.json` and in the docs.
  - Then `cd mcp && npm run build && npm publish --access public`.
  - The package carries both the AI kit and the updater (`npx -y @blueprint/mcp update`).
- **Claude Desktop bundle:**
  - `cd mcp && npm run pack:mcpb`.
  - Sign it (`npx @anthropic-ai/mcpb sign`) with the publisher certificate, then upload it to R2 next to the theme zip, so the Portal offers it.

---

## 2. Every release

The rules are in `AGENTS.md` ("Update safety") and `migrations/README.md`.

### 2.1 Prepare

1. **Merge only additive changes.**
   - `node tools/release.mjs --check`, part of `npm test`, compares the schema with the previous release's manifest.
   - It fails on any removed or renamed setting, section or block, a changed setting type, a lowered limit or a tightened range.
2. **Add a migration if needed.** If a change needs existing stores' JSON to change, add `migrations/<from>-<to>.json`. Examples:
   - a new setting that should be on for existing stores;
   - a value moved to a new setting;
   - a block that existing templates should get.
3. **Bump the version** in two places, which must match:
   - `config/settings_schema.json` → `theme_info.theme_version`;
   - `package.json` → `version`.
4. **Date the CHANGELOG.** Move the notes under `## [x.y.z] - YYYY-MM-DD`. The build refuses an undated entry.
5. **Run every check:**
   ```sh
   npm test                       # unit tests, contrast, budgets, locales, app-compat, docs, release check
   shopify theme check            # no offenses
   (cd mcp && npm test)           # AI kit and its copy of the updater
   (cd portal && npm test)        # Portal
   ```

### 2.2 Build

```sh
node tools/release.mjs
```

This writes two files:
- `dist/blueprint-x.y.z.zip`, the theme folders only. It is what merchants upload and what `themeCreate` installs.
- `release/x.y.z/manifest.json`, which holds:
  - every file's MD5, which the updater uses to spot code the merchant edited;
  - the schema index, the next release's update-safety baseline;
  - the migration chain.

**Commit the manifest**, then tag the release: `git tag vx.y.z`. The zip is not committed (`dist/` is ignored).

### 2.3 Publish

```sh
node tools/publish-release.mjs x.y.z          # prints the wrangler commands
node tools/publish-release.mjs x.y.z --run    # uploads the zip and manifest to R2 and records the release in D1
```

After this:
- the updater and the Portal offer x.y.z;
- the release notes shown in the Portal come from the CHANGELOG section.

Then finish by hand:
- replace the zip attached to the products in Digital Downloads;
- update the theme on the sales store and the demo stores.

### 2.4 Verify the update path

On a development store that runs the previous version and has been customised (settings, a template, a translation):

```sh
BLUEPRINT_SHOP=<dev-store>.myshopify.com BLUEPRINT_LICENSE_KEY=… \
BLUEPRINT_CLIENT_ID=… BLUEPRINT_CLIENT_SECRET=… \
node tools/blueprint.mjs update --dry-run        # plan: migrations, edited code, files to carry over
node tools/blueprint.mjs update                  # installs "Blueprint x.y.z" unpublished
```

Then:
1. Preview the new theme. The customisations should be there.
2. Check that new settings have their migrated values.
3. Check that the live theme is unchanged.

The same flow runs offline in `tests/unit/update.test.mjs`: a synthetic 1.0.1 against a customised 1.0.0.

### 2.5 Announce

- Post the CHANGELOG section in Discord.
- If the release fixes a bug that merchants can see, email buyers. The Portal has their addresses in `licenses.email`.

---

## 3. Licence-key operations

Run these with `npx wrangler d1 execute blueprint-portal --remote --command "…"` from `portal/`.

| Task | How |
|---|---|
| Find a buyer's keys | `SELECT key, product, status, created_at FROM licenses WHERE email = 'buyer@example.com'` |
| See where a key is used | `SELECT shop, activated_at, deactivated_at FROM activations WHERE key = 'BP-…' ORDER BY id DESC` |
| Free a key for another store | The buyer does it in the Portal (**Move to another store**, 3 per 30 days). To do it for them: `UPDATE activations SET deactivated_at = datetime('now') WHERE key = 'BP-…' AND deactivated_at IS NULL` |
| Allow a 4th move this month | Same statement. The limit is enforced only on the Portal button and the API. A move made this way still counts toward the buyer's next 30 days. |
| Revoke a key by hand (chargeback, abuse) | `UPDATE licenses SET status = 'revoked', revoked_at = datetime('now') WHERE key = 'BP-…'` |
| Restore a revoked key | `UPDATE licenses SET status = 'active', revoked_at = NULL WHERE key = 'BP-…'` |
| Buyer changed email | `UPDATE licenses SET email = 'new@example.com' WHERE email = 'old@example.com'`. Magic links go to the new address. |
| Grant a key without an order (press, partner) | Create a 100%-discounted order in the sales store. The webhook mints the key as usual, which keeps every key tied to an order. |

What a revoked key does and doesn't do:
- It blocks downloads and updates only.
- The theme already installed on the store keeps working: Blueprint never checks a licence on the storefront (PLAN §13).

---

## 4. App-compatibility pass

`node tools/app-compat.mjs`, part of `npm test`, checks the integration points in the code on every change:
- `content_for_header` on every layout;
- `@app` on every product surface;
- selling plans posted with the form;
- `reviews.rating` read for stars;
- the `bp:cart:changed` and `bp:cart:open` events;
- `routes.*` for URLs;
- `collection.filters`;
- no jQuery.

Before each minor release, also install the apps on a compatibility development store and check them by hand. Record the result in the release notes.

| App | Check |
|---|---|
| Shopify Subscriptions | Purchase options show the plan and its saving; the cart line shows the plan name; checkout charges the plan price |
| Recharge, or Skio, Loop or Appstle | Same, via their selling plans. With the app's own widget block added, hide Blueprint's Purchase options block |
| Judge.me, Okendo, Yotpo, Stamped, Loox | Stars on the product page and product cards; the app block in the Reviews section; the AI kit reads reviews (all but Loox, which uses CSV) |
| Klaviyo, Postscript | App embed loads its pop-up; the newsletter form creates a customer |
| Rebuy | Its widget in the product page and cart; after it adds to cart, the drawer and count refresh |
| Gorgias | App embed chat loads on every layout, including pre-landers |
| Search & Discovery | Filters and sorting on the collection page; the product-type pills |
| Translate & Adapt | A second language renders every storefront string; links keep the locale |
| Triple Whale, Meta pixel | Events fire on product view, add to cart and checkout from a pre-lander |

Until this pass has run on a store, the sales page should name only the apps that have actually been tested (PLAN §1).

---

## 5. Theme Store checklist (for a later listing)

The direct channel comes first (PLAN D2). A Theme Store listing would end direct sales, and needs these. Requirements: <https://shopify.dev/docs/storefronts/themes/store/requirements>.

**Already true in the code:**
- [x] Fully original code. Not derived from Dawn or Horizon.
- [x] JSON templates for every page except the gift card. Every required template is present: 404, article, blog, cart, collection, index, list-collections, page, page.contact, password, product, search, plus `gift_card.liquid`.
- [x] Header and footer in section groups; a Custom Liquid section.
- [x] Main product sections built from blocks, with `@app` in the main and featured product sections.
- [x] `theme_info`, a favicon setting, no Lorem Ipsum defaults, and colour settings of type `color`.
- [x] Contrast at least 4.5:1 for text and 3:1 for UI, in every preset and both modes (CI). Visible focus, 24 px targets, labelled inputs.
- [x] No fake urgency: countdowns default to a fixed end time; the viewer count renders only with real data.
- [x] No cart-level discount-code field. Discounts and the selling-plan name show in the cart.
- [x] Accelerated checkout on product and cart pages; faceted filtering; related and complementary recommendations; multi-level menus; language and country selectors; newsletter.
- [x] Readable, unminified first-party code; no frameworks.
- [x] Theme Check clean with `theme-check:recommended`.

**To do before submitting:**
- [ ] **Lighthouse:** measure performance (≥ 60) and accessibility (≥ 90), averaged across home, product and collection, mobile and desktop. Use a store loaded with Shopify's benchmark data, `pb=0` previews, and the median of 3 runs.
- [ ] **Theme Store build:**
  - remove the `product-viewers` block, which has no real data source on a demo store;
  - check whether metaobject-typed settings are accepted.
- [ ] **Demo stores:** one per preset, with no apps beyond free reviews or translation apps. The subscription toggle can't be shown live.
- [ ] **Listing:** screenshots, preset descriptions, documentation URL and support email.
- [ ] **Licensing:** the direct channel must close, since the Theme Store is exclusive.
- [ ] **Updates:** Shopify's own update flow replaces `blueprint update`, with releases at least 4 weeks apart.

---

## 6. Not yet verified on real infrastructure

These are built and tested offline. Check each one once the credentials exist, and tick it here.

- [ ] Portal deployed: webhook signatures from a real store, Resend delivery, R2 downloads.
- [ ] The test purchase in §1.3.
- [ ] `blueprint update` against a real store: `themeCreate` from the Portal's signed URL, then file carry-over.
- [x] The AI kit's launch blocker. **Answered 2026-10-25: an app can't write themes without Shopify's exemption; a Theme Access password can** (PLAN, "Store run, 2026-10-25"). The AI kit and the updater must switch routes before launch.
- [ ] Sales store seeded, and Digital Downloads attached.
- [ ] npm package published; `.mcpb` signed.
- [ ] The app-compatibility pass in §4.
