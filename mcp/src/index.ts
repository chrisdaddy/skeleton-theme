#!/usr/bin/env node
// stdio entry point: `npx -y @blueprint/mcp`, or the .mcpb bundle in Claude Desktop.
//
// Configuration (environment):
//   BLUEPRINT_SHOP                      your-store.myshopify.com
//   BLUEPRINT_CLIENT_ID / _SECRET       a Dev Dashboard app in the store's organization, or
//   BLUEPRINT_ADMIN_TOKEN               an Admin API access token (shpat_…)
//   JUDGEME_API_TOKEN, OKENDO_STORE_ID, YOTPO_APP_KEY, STAMPED_API_KEY + STAMPED_STORE_URL   reviews (optional)
//   BLUEPRINT_MCP_HOME                  where the draft registry is kept (default ~/.blueprint-mcp)

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { adminExecutor, tokenProvider } from './admin.ts';
import { DraftRegistry } from './registry.ts';
import { createServer } from './server.ts';

const env = process.env;
const shop = (env.BLUEPRINT_SHOP ?? '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)) {
  console.error('Set BLUEPRINT_SHOP to your store\'s myshopify.com domain (e.g. your-store.myshopify.com).');
  process.exit(1);
}

const token = tokenProvider({ shop, clientId: env.BLUEPRINT_CLIENT_ID, clientSecret: env.BLUEPRINT_CLIENT_SECRET, accessToken: env.BLUEPRINT_ADMIN_TOKEN });
const server = createServer({
  admin: adminExecutor(shop, token),
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
