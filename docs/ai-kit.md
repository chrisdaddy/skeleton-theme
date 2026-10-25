# Blueprint AI kit: setup

The AI kit is an MCP server (`@blueprint/mcp`). Claude Desktop, Claude Code, Cursor and other MCP clients use it to work on your Blueprint theme. Every change goes to a **draft copy** of your theme, and you see each change as a diff before it's applied. Your live theme is never edited, published or deleted; you publish a draft yourself in the Shopify admin when you're happy with it.

The kit uses two credentials:
- a **Shopify app** of your own, for products, content and pages (section 1);
- a **Theme Access password**, for draft themes (section 2). Shopify lets only specially approved apps change themes, so theme edits go through the password Shopify provides for theme tools.

## 1. Create a Shopify app for the kit (5 minutes)

1. **Create the app.** Open the [Shopify Dev Dashboard](https://dev.shopify.com/dashboard) with the account that owns your store, and create an app named "Blueprint AI kit".
2. **Choose its access scopes.** Create a version with these Admin API scopes, then release it:

   | Scope | Why |
   |---|---|
   | `read_themes` | Read your theme |
   | `read_products` | Products, prices and Blueprint content |
   | `read_metaobjects`, `read_metaobject_definitions` | Tiers, benefits, FAQs and other Blueprint content |
   | `read_online_store_pages`, `write_online_store_pages` | Create unpublished pages for new pre-landers |
   | `write_metaobject_definitions`, `write_products` | Only for `setup_metafields`: creates Blueprint's definitions |
3. **Install it** on your store from the app's page.
4. **Copy the credentials:** the **Client ID** and **Client secret** from the app's settings. Keep the secret private.

The kit exchanges these for a 24-hour access token itself, using Shopify's client credentials grant. If you already have an Admin API access token (`shpat_…`), you can use it instead (`BLUEPRINT_ADMIN_TOKEN`).

## 2. Create a Theme Access password (2 minutes)

1. In your Shopify admin, install the free **Theme Access** app from the Shopify App Store.
2. Open it and click **Create theme password**. Enter your own name and email.
3. Shopify emails you a link to the password (`shptka_…`). You can view it only once: copy it into the kit's settings below, or your password manager.

The password covers themes only. The kit uses it to copy your live theme into drafts and edit those drafts; it never edits, publishes or deletes your live theme. The [updater](merchant/updating.md) uses the same password.

## 3. Connect your AI assistant

### Claude Desktop

Install the **Blueprint AI kit** bundle (`blueprint-mcp-<version>.mcpb`) from your download portal by double-clicking it. Claude Desktop asks for:
- your store domain (`your-store.myshopify.com`);
- the app's client ID and client secret, and the Theme Access password (stored securely);
- optionally, a Judge.me API token.

### Claude Code

```sh
claude mcp add blueprint \
  -e BLUEPRINT_SHOP=your-store.myshopify.com \
  -e BLUEPRINT_CLIENT_ID=… -e BLUEPRINT_CLIENT_SECRET=… \
  -e BLUEPRINT_THEME_PASSWORD=shptka_… \
  -- npx -y @blueprint/mcp
```

### Cursor, Windsurf, Gemini CLI and other MCP clients

Add a stdio server to the client's MCP settings:

```json
{
  "mcpServers": {
    "blueprint": {
      "command": "npx",
      "args": ["-y", "@blueprint/mcp"],
      "env": {
        "BLUEPRINT_SHOP": "your-store.myshopify.com",
        "BLUEPRINT_CLIENT_ID": "…",
        "BLUEPRINT_CLIENT_SECRET": "…",
        "BLUEPRINT_THEME_PASSWORD": "shptka_…"
      }
    }
  }
}
```

Node.js 22 or later is required.

### ChatGPT

ChatGPT isn't supported in v1, because it needs a remote (HTTP) server. Version 1.1 will include a template to deploy your own on Cloudflare Workers.

## Updating the theme

The same package updates Blueprint: `npx -y @blueprint/mcp update`, with your licence key in `BLUEPRINT_LICENSE_KEY` and the Theme Access password in `BLUEPRINT_THEME_PASSWORD`. It installs the new version as an unpublished theme and carries over your settings. See [Updating Blueprint](merchant/updating.md).

## 4. Reviews (optional)

The kit reads reviews from the first source that is set up, in this order. All but the CSV route need a key in the kit's environment:

| App | Setting |
|---|---|
| Judge.me | `JUDGEME_API_TOKEN` (Judge.me → Settings → Integrations → View API token) |
| Okendo | `OKENDO_STORE_ID` |
| Yotpo | `YOTPO_APP_KEY` |
| Stamped | `STAMPED_API_KEY` and `STAMPED_STORE_URL` |
| Loox, or any app with a CSV export | No key: ask the assistant to use the CSV file on your computer (`csv_path`) |

Review text is treated as customer content:
- it's cleaned and quoted word for word, with first name and initial;
- "verified buyer" appears only when your review app says so;
- any instructions inside a review are ignored.

## 5. Using it

Start with a prompt (Claude Desktop: the + menu → Blueprint; Claude Code: `/` prompts), or just ask. A typical session:

1. "Create a listicle for Verde Daily from our best reviews."
2. The assistant reads your product and reviews, creates a draft theme, and shows you the new template as a diff.
3. You say yes; it applies the change and gives you the draft's preview link.
4. Review the page in the theme editor or the preview, and publish the draft in **Online Store → Themes** when ready.
5. Optionally, ask it to create the page (unpublished) that uses the new template.

The 22 prompts are in [`prompts/`](../prompts/) and work as plain text in any assistant.

## What the kit will and won't do

| Will | Won't |
|---|---|
| Copy your live theme into a draft and edit the draft's templates, section groups and theme settings | Edit, publish or delete your live theme |
| Show every change as a diff first, and apply it only when you agree | Change Liquid, CSS, JavaScript or assets |
| Check every change against Blueprint's settings and sections | Change prices, inventory, discounts or orders |
| Create pages, unpublished, after asking | Publish pages |
| Add Blueprint's metafield definitions, after asking | Change or delete existing definitions or content |

Drafts the kit created are listed in `~/.blueprint-mcp/` on your computer. Delete a draft theme in the Shopify admin when you no longer need it.

## Troubleshooting

- **"shop_not_permitted":** the app and the store must belong to the same organization in the Dev Dashboard. Otherwise, use an Admin API token (`BLUEPRINT_ADMIN_TOKEN`).
- **"refused the request (403)":** a scope is missing. Release a new app version with the scopes above and approve it on the store.
- **"Editing drafts needs a Theme Access password":** add the password from section 2 to the kit's settings.
- **"Shopify refused the Theme Access password":** the password was deleted or mistyped. Create a new one in the Theme Access app.
- **"still being copied":** Shopify takes a moment to duplicate a theme. Try again shortly.
