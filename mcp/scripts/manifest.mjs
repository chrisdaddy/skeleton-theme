#!/usr/bin/env node
// Writes manifest.json for the Claude Desktop bundle (.mcpb) from the built server: the tools
// it registers and the prompts it serves, plus the settings Claude Desktop asks the merchant for
// (the client secret and review keys are stored as sensitive values).
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { DraftRegistry } from '../dist/registry.js';
import { createServer, VERSION } from '../dist/server.js';

const server = createServer({ admin: async () => ({}), shop: 'manifest.myshopify.com', registry: new DraftRegistry('manifest', mkdtempSync(join(tmpdir(), 'bp-manifest-'))) });
const client = new Client({ name: 'manifest', version: VERSION });
const [a, b] = InMemoryTransport.createLinkedPair();
await Promise.all([server.connect(a), client.connect(b)]);
const { tools } = await client.listTools();
const { prompts } = await client.listPrompts();
const files = await Promise.all(prompts.map((p) => client.getPrompt({ name: p.name, arguments: Object.fromEntries((p.arguments ?? []).map((arg) => [arg.name, `\${arguments.${arg.name}}`])) })));
await client.close();

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const manifest = {
  manifest_version: '0.3',
  name: 'blueprint-mcp',
  display_name: 'Blueprint Theme AI kit',
  version: pkg.version,
  description: 'Edit draft copies of your Blueprint theme by asking: pre-landers from real reviews, settings and template changes, reviewed as diffs. Never touches the live theme.',
  author: { name: 'Blueprint Theme' },
  server: {
    type: 'node',
    entry_point: 'dist/index.js',
    mcp_config: {
      command: 'node',
      args: ['${__dirname}/dist/index.js'],
      env: {
        BLUEPRINT_SHOP: '${user_config.shop}',
        BLUEPRINT_CLIENT_ID: '${user_config.client_id}',
        BLUEPRINT_CLIENT_SECRET: '${user_config.client_secret}',
        JUDGEME_API_TOKEN: '${user_config.judgeme_api_token}',
      },
    },
  },
  tools: tools.map((t) => ({ name: t.name, description: t.description })),
  prompts: prompts.map((p, i) => ({ name: p.name, description: p.description, arguments: (p.arguments ?? []).map((arg) => arg.name), text: files[i].messages[0].content.text })),
  user_config: {
    shop: { type: 'string', title: 'Store domain', description: 'your-store.myshopify.com', required: true },
    client_id: { type: 'string', title: 'App client ID', description: 'From your Blueprint app in the Shopify Dev Dashboard', required: true },
    client_secret: { type: 'string', title: 'App client secret', description: 'From the same app (stored securely)', sensitive: true, required: true },
    judgeme_api_token: { type: 'string', title: 'Judge.me API token (optional)', description: 'Only if you use Judge.me for reviews', sensitive: true, required: false },
  },
  compatibility: { platforms: ['darwin', 'win32', 'linux'], runtimes: { node: '>=22.0.0' } },
  keywords: ['shopify', 'theme', 'blueprint'],
  license: 'Proprietary',
};
writeFileSync(new URL('../manifest.json', import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`manifest.json: ${manifest.tools.length} tools, ${manifest.prompts.length} prompts`);
