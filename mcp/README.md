# @blueprint/mcp: the Blueprint Theme AI kit

An MCP server that lets Claude (or any MCP client) work on a Shopify store running the Blueprint theme. Every change happens in a **draft copy** of the theme, as a diff you approve. The live theme is never edited, published or deleted.

- **Pre-landers from real reviews:** listicles and advertorials built from your copy plus review quotes copied word for word. Quotes that aren't in a review are refused.
- **Theme changes:** section and block settings, whole templates and theme settings, each checked against Blueprint's schemas before it's applied.
- **22 ready-made prompts:** comparison pages, FAQ from support tickets, an ingredients table from a label, a PDP audit, rewards thresholds from your AOV, and more.

Setup is in [`docs/ai-kit.md`](../docs/ai-kit.md).

## Tools

| Tool | Does | Changes |
|---|---|---|
| `list_themes`, `get_current_preset`, `list_sections`, `read_template`, `read_settings`, `read_products`, `read_metafields`, `read_reviews` | Read the store and theme | Nothing |
| `create_draft` | Copies the live theme into an unpublished "Blueprint AI draft" | A new unpublished theme |
| `diff_draft` | Shows a draft's pending change, or how it differs from the live theme | Nothing |
| `update_block_settings`, `apply_template_change`, `draft_listicle_from_reviews`, `draft_advertorial_from_reviews`, `revert_draft_file` | Edit a draft: first a diff and a `change_token`, then the same call with the token applies it | Draft theme files only |
| `create_page_from_template` | Creates a page using a template | An **unpublished** page, only with `confirm: true` |
| `setup_metafields` | Creates Blueprint's metafield and metaobject definitions where missing | Definitions, additive only, with `confirm: true` |

## Rails (enforced in code)

- **Writes:** only to themes this server created (its draft registry), and only while Shopify reports them unpublished or in development. The role is re-checked before every write.
- **Files:** only `templates/*.json`, `sections/*-group.json` and `config/settings_data.json`. Never Liquid, CSS, JS, assets or locales.
- **Validation:** every file is checked against Blueprint's section, block and settings schemas.
- **Plan, then apply:** a change applies only with its `change_token`. That token covers the new content and the base file's checksum, so a file someone else changed meanwhile is never overwritten.
- **Allow-listed operations:** the server can only send the GraphQL operations in `src/operations.ts`. Publishing and deleting themes isn't among them; a test fails the build if either mutation appears anywhere in the code.
- **Reviews are data:** the text is cleaned and handed over as quotations, never as instructions.

## Development

```sh
npm install
npm test               # builds, then rails, end-to-end (MCP client ↔ server ↔ in-memory store) and review tests
npm run validate:manifest
npm run pack:mcpb      # Claude Desktop bundle (unsigned)
```

`npm run sync` regenerates `src/generated/` (the section and settings schema index, and the metafield definitions) from the theme repository.
