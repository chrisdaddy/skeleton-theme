# Updating Blueprint

Every 1.x update is included with your licence. Updates are **additive**:
- settings, sections and blocks are never removed or renamed;
- block limits are never lowered.

Your customisations therefore carry over. When an update changes how something is stored, it includes a migration that adjusts your saved settings for you.

The updater installs the new version as a **separate, unpublished theme**. Your live theme isn't touched. Look at the new one, then publish it when you're happy. The old theme stays in your theme library as the rollback.

## What carries over

| Carried over | Not carried over |
|---|---|
| Theme settings (colours, fonts, cart, everything in **Theme settings**) | Edits to the theme's code (Liquid, CSS, JavaScript) |
| Every template's sections, blocks and settings, including templates you created | Files you added to the code yourself |
| Header and footer (section groups) | |
| Your translations and wording changes (**Edit default theme content**), merged with new text the update adds | |

The updater lists any code files you edited, so you can re-apply those changes if you still need them.

## Update with the command line

You need Node.js 22 or later, your licence key, and the Shopify app you created for the [AI kit](../ai-kit.md). The app must have `read_themes` and `write_themes`. In a terminal:

```sh
BLUEPRINT_SHOP=your-store.myshopify.com \
BLUEPRINT_LICENSE_KEY=BP-XXXX-XXXX-XXXX-XXXX \
BLUEPRINT_CLIENT_ID=… BLUEPRINT_CLIENT_SECRET=… \
npx -y @blueprint/mcp update
```

The command:
1. Checks your licence for this store, and fetches the latest version and its changes.
2. Reads your live theme's settings, templates, section groups and translations.
3. Applies the migrations, and lists any code files you edited.
4. Asks before going on. Then it creates **"Blueprint &lt;version&gt;"** as an unpublished theme and copies your settings in.
5. Prints a preview link.

Run it with `--dry-run` to see the plan without creating anything.

## Update by hand

If you prefer not to use the command line:

1. **Download** the new zip from the [Portal](licences.md) and upload it in **Online Store → Themes → Add theme → Upload zip file**.
2. **Copy settings and templates** from your live theme to the new one, in the code editor (**⋯ → Edit code**): `config/settings_data.json`, every `templates/*.json` you changed, and `sections/header-group.json` and `sections/footer-group.json`.
3. **Apply the release notes' manual steps:** the release notes in the Portal list any migration steps for that version.

## After updating

- **Preview the new theme**, especially your product page, cart and pre-landers.
- **Publish it** in **Online Store → Themes → ⋯ → Publish**.
- **Clean up:** keep the old theme for a while as a rollback, then delete it.

If something looks wrong after publishing, publish the old theme again and contact support with the version numbers.
