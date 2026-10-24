# Blueprint Portal

A Cloudflare Worker (D1 + R2, no dependencies) behind the direct-sale channel (`docs/PLAN.md` §13.1):

- **Order webhooks** from the Blueprint sales store (a Shopify store) mint licence keys:
  - 1 per Theme, Extra licence or Done-for-you;
  - 5 per Agency pack.

  Refunds revoke the refunded units' keys, unused keys first. Cancellations revoke the whole order.
- **Activation:** a key binds to one `*.myshopify.com` store on first use. A merchant can move it to another store up to 3 times in 30 days.
- **Releases:** the updater (`blueprint update`) and the AI kit get the latest version, its manifest and a download link signed for 15 minutes.
- **Buyer portal:** magic-link sign-in with the order email shows the buyer's keys, which store each is on, the download and the changelog.

## Setup

```sh
npx wrangler d1 create blueprint-portal         # put the database_id in wrangler.toml
npm run db:init
npx wrangler r2 bucket create blueprint-releases
npx wrangler secret put SHOPIFY_WEBHOOK_SECRET  # from the sales store's Settings → Notifications → Webhooks
npx wrangler secret put SIGNING_SECRET          # e.g. openssl rand -hex 32
npx wrangler secret put RESEND_API_KEY
npm run deploy
```

In the sales store, add webhooks (JSON, the latest API version) for **Order payment** → `https://portal.blueprinttheme.com/webhooks/orders/paid`, **Refund create** → `/webhooks/refunds/create` and **Order cancellation** → `/webhooks/orders/cancelled`.

Products need these SKUs:

| SKU | Product | Keys |
|---|---|---|
| `BP-THEME` | Blueprint (1 store) | 1 |
| `BP-AGENCY` | Agency (5 stores) | 5 |
| `BP-LICENSE` | Extra licence | 1 |
| `BP-DFY` | Done for you | 1 |

Publishing a release (zip, manifest, row in `releases`) is `node tools/publish-release.mjs <version>`; see `LAUNCH.md`.

## Tests

`npm test` runs the Worker in Node 22. `node:sqlite` stands in for D1, running this `schema.sql`, and an in-memory map stands in for R2. The tests cover:

- purchase → key → binding → refund revocation;
- webhook signatures;
- agency packs and partial refunds;
- transfer limits;
- signed downloads;
- magic-link sign-in and CSRF.
