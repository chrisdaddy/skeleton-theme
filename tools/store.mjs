#!/usr/bin/env node
// Runs Shopify CLI theme commands against a development store from shopify.theme.toml,
// with that store's Theme Access password from its own environment variable:
//
//   SHOPIFY_CLI_THEME_TOKEN_VERDE, SHOPIFY_CLI_THEME_TOKEN_ODE, SHOPIFY_CLI_THEME_TOKEN_RAWFORM
//
//   node tools/store.mjs <verde|ode|rawform> <theme command…>
//   node tools/store.mjs verde list
//   node tools/store.mjs verde push --unpublished --theme "Blueprint dev"
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [store, ...command] = process.argv.slice(2);
const stores = ['verde', 'ode', 'rawform'];
if (!stores.includes(store) || command.length === 0) {
  console.error(`Usage: node tools/store.mjs <${stores.join('|')}> <theme command…>`);
  process.exit(2);
}
const variable = `SHOPIFY_CLI_THEME_TOKEN_${store.toUpperCase()}`;
const password = process.env[variable];
if (!password) {
  console.error(`${variable} isn't set. Add the store's Theme Access password to the environment settings, then start a new session.`);
  process.exit(2);
}
// The store's domain from shopify.theme.toml, passed with --store: Shopify CLI looks for the
// toml in --path, which for builds (tools/demo/theme.mjs) is a folder outside the repository.
const toml = readFileSync(new URL('../shopify.theme.toml', import.meta.url), 'utf8');
const domain = toml.match(new RegExp(`\\[environments\\.${store}\\][^\\[]*?store\\s*=\\s*"([^"]+)"`))?.[1];
if (!domain) {
  console.error(`No [environments.${store}] store in shopify.theme.toml.`);
  process.exit(2);
}
const result = spawnSync('shopify', ['theme', ...command, '--store', domain], {
  stdio: 'inherit',
  env: {
    ...process.env,
    SHOPIFY_CLI_THEME_TOKEN: password,
    // Behind an HTTPS proxy, Shopify CLI needs its own variable to use it.
    ...(process.env.HTTPS_PROXY && !process.env.SHOPIFY_HTTPS_PROXY ? { SHOPIFY_HTTPS_PROXY: process.env.HTTPS_PROXY } : {}),
  },
});
process.exit(result.status ?? 1);
