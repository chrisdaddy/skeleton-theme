#!/usr/bin/env node
// Seeds a demo store from tools/demo/stores/<store>.json through the Admin GraphQL API.
//
//   node tools/seed-demo.mjs <store> [--dry-run] [--steps=products,metafields] [--skip=files] [--config=<file>]
//
// --config seeds another catalog in the same format, e.g. the sales store (tools/sales/store.json).
//
// <store> is a demo store ID (verde, ode, rawform, …) with an environment of the same name in
// shopify.theme.toml. Credentials, from the environment (never from files):
//   BLUEPRINT_SEED_CLIENT_ID and BLUEPRINT_SEED_CLIENT_SECRET   one Dev Dashboard app, installed
//       on every demo store in the same organization (client credentials grant), or
//   SHOPIFY_ADMIN_TOKEN_<STORE>                                  an Admin API access token.
// See docs/demo-stores.md for the app's access scopes.
//
// --dry-run seeds an in-memory stand-in instead (tools/demo/fake-admin.mjs) and lists what a
// first run would create. Re-running against a store only changes what differs.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { adminClient, clientCredentialsToken } from './demo/admin.mjs';
import { fakeAdmin } from './demo/fake-admin.mjs';
import { imageRenderer, stagedUpload } from './demo/images.mjs';
import { STEPS, seed } from './demo/seed.mjs';

// Node's fetch only uses HTTPS_PROXY when asked to; restart with it on.
if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const result = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' } });
  process.exit(result.status ?? 1);
}

const root = new URL('../', import.meta.url);
const args = process.argv.slice(2);
const storeId = args.find((a) => !a.startsWith('--'));
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]?.split(',');
const dryRun = args.includes('--dry-run');

let config;
try {
  config = JSON.parse(readFileSync(flag('config')?.[0] ?? new URL(`tools/demo/stores/${storeId}.json`, root), 'utf8'));
} catch {
  console.error('Usage: node tools/seed-demo.mjs <store> [--dry-run] [--steps=a,b] [--skip=a,b]   (stores: tools/demo/stores/*.json)');
  process.exit(2);
}
const steps = (flag('steps') ?? STEPS).filter((s) => !(flag('skip') ?? []).includes(s));
const unknown = steps.filter((s) => !STEPS.includes(s));
if (unknown.length) {
  console.error(`Unknown steps: ${unknown.join(', ')}. Steps: ${STEPS.join(', ')}`);
  process.exit(2);
}

const toml = readFileSync(new URL('shopify.theme.toml', root), 'utf8');
const shop = new RegExp(`\\[environments\\.${storeId}\\][^\\[]*?store\\s*=\\s*"([^"]+)"`).exec(toml)?.[1];
const demo = JSON.parse(readFileSync(new URL('data/demo-content.json', root), 'utf8'));
const preset = demo.presets[storeId];

let gql;
let upload;
let renderImage;
let render;
if (dryRun) {
  const fake = fakeAdmin({ shop: shop ?? `${storeId}.myshopify.com` });
  gql = fake.gql;
  upload = fake.upload;
  renderImage = fake.renderImage;
} else {
  if (!shop) {
    console.error(`No [environments.${storeId}] store in shopify.theme.toml.`);
    process.exit(2);
  }
  const adminToken = process.env[`SHOPIFY_ADMIN_TOKEN_${storeId.toUpperCase()}`];
  const { BLUEPRINT_SEED_CLIENT_ID: clientId, BLUEPRINT_SEED_CLIENT_SECRET: clientSecret } = process.env;
  if (!adminToken && !(clientId && clientSecret)) {
    console.error('Set BLUEPRINT_SEED_CLIENT_ID and BLUEPRINT_SEED_CLIENT_SECRET (or SHOPIFY_ADMIN_TOKEN_<STORE>) in the environment settings, then start a new session. See docs/demo-stores.md.');
    process.exit(2);
  }
  const token = adminToken ?? (await clientCredentialsToken(shop, clientId, clientSecret));
  gql = adminClient({ shop, token, log: console.log });
  upload = stagedUpload;
  renderImage = async (file) => {
    render ??= await imageRenderer({ preset, brand: config.brand });
    return render(file);
  };
}

console.log(`${dryRun ? 'Dry run: ' : ''}seeding ${config.brand} (${storeId}) → ${dryRun ? 'in-memory store' : shop}; steps: ${steps.join(', ')}`);
try {
  const state = await seed(config, gql, { steps, renderImage, upload, log: console.log });
  for (const line of state.created) console.log(`  + ${line}`);
  for (const line of state.updated) console.log(`  ~ ${line}`);
  console.log(`Done: ${state.created.length} created, ${state.updated.length} updated.`);
  if (!dryRun) console.log(`Next: node tools/demo/theme.mjs ${storeId} --push`);
} finally {
  await render?.close();
}
