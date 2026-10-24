# Migrations

A migration moves a merchant's saved theme JSON from one Blueprint version to the next. Shopify keeps a merchant's JSON (`config/settings_data.json`, `templates/*.json`, `sections/*-group.json`) when they edit the theme. A new version therefore can't simply ship new defaults; it ships a migration, and the updater (`blueprint update`) applies it to the merchant's files before copying them into the new theme.

One file per release step: `migrations/<from>-<to>.json`, for example `1.0.0-1.0.1.json`.

```json
{
  "from": "1.0.0",
  "to": "1.0.1",
  "description": "Trust line under the buy button (new setting, on for existing stores).",
  "operations": [
    { "op": "section_setting_default", "section": "main-product", "setting": "show_trust_line", "value": true }
  ]
}
```

Operations only fill in or carry over values, so running them twice is safe. A value the merchant set, even `false` or `""`, is never overwritten.

| Operation | Effect |
|---|---|
| `theme_setting_default` `setting`, `value` | Sets a theme setting if it isn't set |
| `copy_theme_setting` `from`, `to` | Copies one theme setting to a new one, if the new one isn't set |
| `section_setting_default` `section`, `setting`, `value` | In every template and group, sets the setting on sections of that type if unset |
| `copy_section_setting` `section`, `from`, `to` | Copies a section setting to a new one, if unset |
| `block_setting_default` `block`, `setting`, `value`, optional `section` | Same, for blocks of that type (theme blocks or section blocks) |
| `add_block` `file`, `section_id`, `block_id`, `block`, optional `after` | Adds a block if the section has none of that type |
| `add_section` `file`, `section_id`, `section`, optional `after` | Adds a section to a template if its ID isn't there |

`node tools/release.mjs --check` (part of `npm test`) validates every migration file. The engine is `tools/lib/migrate.mjs`.

1.x is additive only, so there are no rename or delete operations. To replace a setting, add the new one, copy the old value across with `copy_*`, and hide the old setting with `visible_if`.
