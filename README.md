# Blueprint Theme

Blueprint is a Shopify Online Store 2.0 theme for physical-product DTC brands: supplements, skincare, pet, fragrance, coffee and apparel. It is built from original code.

The theme includes:
- 3 presets: Clinical, Editorial and Bold
- native bundle and quantity-break tiers
- a subscription toggle wired to selling plans
- a cart drawer with rewards, shipping protection and an upsell
- advertorial, listicle and comparison pre-landers
- an AI kit (MCP server and prompt library)

**Status:** version 1.0.0, all eight phases built and tested offline. Store verification and launch steps are in [`LAUNCH.md`](LAUNCH.md). See [`docs/PLAN.md`](docs/PLAN.md) for the plan of record and [`docs/RESEARCH.md`](docs/RESEARCH.md) for the research behind it.

## Develop

Requirements: [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) and Node.js 22 or later.

```sh
shopify theme dev --store <your-dev-store>   # preview on a development store
shopify theme check                          # must report no offenses
npm test                                     # unit tests, contrast and budget checks (offline)
```

### Offline preview

When no store is reachable, `tools/preview/` renders the theme with LiquidJS and demo data and takes screenshots. It approximates Shopify's renderer for layout and style checks only.

```sh
cd tools/preview && npm install && npm run shots   # writes out/<preset>/*.html and out/shots/*.png
npm run check:buybox                               # buy box checklist (docs/PLAN.md §16) in Chromium
npm run check:cart                                 # cart drawer and cart page checklist in Chromium
npm run check:sections                             # every content section, preset and demo store in Chromium
npm run check:landing                              # pre-landers, URL contract, collection page and templates in Chromium
```

The checklists run from the repository root once `tools/preview` has its dependencies.

### AI kit

`mcp/` is the Blueprint AI kit: an MCP server that edits draft copies of the theme (never the live one) and serves the 22 prompts in `prompts/`. Setup for merchants is in [`docs/ai-kit.md`](docs/ai-kit.md).

```sh
cd mcp && npm install && npm test                  # rails, end-to-end and review tests
```

### Demo stores

Verde, Ode and Rawform are seeded from the reference copy through the Admin API. Setup (one Dev Dashboard app, environment variables) and the manual steps are in [`docs/demo-stores.md`](docs/demo-stores.md).

```sh
npm run seed -- verde --dry-run                    # what a first seed would create (no network)
npm run seed -- verde                              # seed the store (idempotent)
node tools/demo/theme.mjs verde --push             # push the demo theme, unpublished
node tools/demo/compare.mjs verde ode rawform      # reference vs Blueprint, side by side at 390 and 1440
```

### Releases, updates and the Portal

Releases are additive within 1.x, and `npm test` enforces it against the last release. The runbook is [`LAUNCH.md`](LAUNCH.md).

```sh
node tools/release.mjs                             # build dist/blueprint-<v>.zip and release/<v>/manifest.json
node tools/publish-release.mjs <v> --run           # upload to the Portal (Cloudflare R2 + D1)
node tools/blueprint.mjs update --dry-run          # the updater merchants run as: npx -y @blueprint/mcp update
cd portal && npm test                              # licence keys, webhooks, downloads, sign-in
```

Migrations are in [`migrations/`](migrations/README.md). Merchant docs are in [`docs/merchant/`](docs/merchant/README.md); `npm run docs` regenerates the section and metafield references.

Read [`AGENTS.md`](AGENTS.md) before changing code. It lists the conventions every change must follow.

## Repository layout

| Path | Contents |
|---|---|
| `layout/`, `config/`, `sections/`, `blocks/`, `snippets/`, `templates/`, `locales/`, `assets/` | The theme |
| `data/demo-content.json` | Presets, demo stores and copy from the reference demo |
| `reference/` | The reference demo (visual and behavioural target) |
| `tools/`, `tests/` | Checks, release and update tooling, and test suites |
| `migrations/` | Declarative migrations of merchant JSON between versions |
| `mcp/`, `prompts/` | The AI kit and its prompts; the package also carries the updater |
| `portal/` | Blueprint Portal: licence keys, downloads, buyer sign-in (Cloudflare Worker) |
| `release/` | One manifest per released version (checksums and schema baseline) |
| `docs/` | Plan, research, brief and merchant docs |
