#!/usr/bin/env node
// stdio entry point: `npx -y @blueprint/mcp`, or the .mcpb bundle in Claude Desktop.
// `npx -y @blueprint/mcp update` runs the theme updater instead (docs/merchant/updating.md).
//
// Configuration (environment):
//   BLUEPRINT_SHOP                      your-store.myshopify.com
//   BLUEPRINT_THEME_PASSWORD            a Theme Access password: drafts (Shopify lets only exempt
//                                       apps change themes, so theme edits use this instead)
//   BLUEPRINT_CLIENT_ID / _SECRET       a Dev Dashboard app in the store's organization, or
//   BLUEPRINT_ADMIN_TOKEN               an Admin API access token (shpat_…): products, pages, content
//   JUDGEME_API_TOKEN, OKENDO_STORE_ID, YOTPO_APP_KEY, STAMPED_API_KEY + STAMPED_STORE_URL   reviews (optional)
//   BLUEPRINT_MCP_HOME                  where the draft registry is kept (default ~/.blueprint-mcp)

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { adminExecutor, tokenProvider } from './admin.ts';
import { DraftRegistry } from './registry.ts';
import { createServer } from './server.ts';

// `npx -y @blueprint/mcp update`: the theme updater (dist/update/cli.mjs, copied at build).
if (process.argv[2] === 'update') {
  const cli = './update/cli.mjs';
  const { main } = (await import(cli)) as { main: (args: string[]) => Promise<number> };
  process.exit(await main(process.argv.slice(3)));
}

const env = process.env;
const shop = (env.BLUEPRINT_SHOP ?? '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)) {
  console.error('Set BLUEPRINT_SHOP to your store\'s myshopify.com domain (e.g. your-store.myshopify.com).');
  process.exit(1);
}

const token = tokenProvider({ shop, clientId: env.BLUEPRINT_CLIENT_ID, clientSecret: env.BLUEPRINT_CLIENT_SECRET, accessToken: env.BLUEPRINT_ADMIN_TOKEN });
const server = createServer({
  admin: adminExecutor(shop, token, fetch, env.BLUEPRINT_THEME_PASSWORD || undefined),
  shop,
  registry: new DraftRegistry(shop),
  reviewKeys: {
    judgemeToken: env.JUDGEME_API_TOKEN,
    okendoStoreId: env.OKENDO_STORE_ID,
    yotpoAppKey: env.YOTPO_APP_KEY,
    stampedApiKey: env.STAMPED_API_KEY,
    stampedStoreUrl: env.STAMPED_STORE_URL,
  },
});
await server.connect(new StdioServerTransport());
