# Blueprint Theme

Blueprint is a Shopify Online Store 2.0 theme for physical-product DTC brands: supplements, skincare, pet, fragrance, coffee and apparel. It is built from original code.

The theme includes:
- 3 presets: Clinical, Editorial and Bold
- native bundle and quantity-break tiers
- a subscription toggle wired to selling plans
- a cart drawer with rewards, shipping protection and an upsell
- advertorial, listicle and comparison pre-landers
- an AI kit (MCP server and prompt library)

**Status:** Phase 0 (foundation). See [`docs/PLAN.md`](docs/PLAN.md) for the plan of record and [`docs/RESEARCH.md`](docs/RESEARCH.md) for the research behind it.

## Develop

Requirements: [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) and Node.js 22 or later.

```sh
shopify theme dev --store <your-dev-store>   # preview on a development store
shopify theme check                          # must report no offenses
npm test                                     # unit tests and contrast check (offline)
```

Read [`AGENTS.md`](AGENTS.md) before changing code. It lists the conventions every change must follow.

## Repository layout

| Path | Contents |
|---|---|
| `layout/`, `config/`, `sections/`, `blocks/`, `snippets/`, `templates/`, `locales/`, `assets/` | The theme |
| `data/demo-content.json` | Presets, demo stores and copy from the reference demo |
| `reference/` | The reference demo (visual and behavioural target) |
| `tools/`, `tests/` | Checks and test suites |
| `docs/` | Plan, research, brief and merchant docs |
