# Blueprint Theme

Blueprint is a Shopify Online Store 2.0 theme for physical-product DTC brands: supplements, skincare, pet, fragrance, coffee and apparel. It is built from original code.

The theme includes:
- 3 presets: Clinical, Editorial and Bold
- native bundle and quantity-break tiers
- a subscription toggle wired to selling plans
- a cart drawer with rewards, shipping protection and an upsell
- advertorial, listicle and comparison pre-landers
- an AI kit (MCP server and prompt library)

**Status:** Phase 1 (design foundation) done. See [`docs/PLAN.md`](docs/PLAN.md) for the plan of record and [`docs/RESEARCH.md`](docs/RESEARCH.md) for the research behind it.

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
```

The checklists run from the repository root once `tools/preview` has its dependencies.

Read [`AGENTS.md`](AGENTS.md) before changing code. It lists the conventions every change must follow.

## Repository layout

| Path | Contents |
|---|---|
| `layout/`, `config/`, `sections/`, `blocks/`, `snippets/`, `templates/`, `locales/`, `assets/` | The theme |
| `data/demo-content.json` | Presets, demo stores and copy from the reference demo |
| `reference/` | The reference demo (visual and behavioural target) |
| `tools/`, `tests/` | Checks and test suites |
| `docs/` | Plan, research, brief and merchant docs |
