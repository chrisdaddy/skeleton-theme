#!/usr/bin/env node
// Fails when the theme uses a translation key that the default locale files don't define.
//   storefront: {{ 'key' | t }} → locales/en.default.json
//   schema:     "t:key"         → locales/en.default.schema.json
import { readdirSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const lookup = (tree, key) => key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), tree);

const storefront = JSON.parse(read('locales/en.default.json'));
const schema = JSON.parse(read('locales/en.default.schema.json'));

export function usedKeys() {
  const used = { storefront: new Set(), schema: new Set() };
  for (const dir of ['layout', 'sections', 'blocks', 'snippets', 'templates', 'config']) {
    for (const file of readdirSync(new URL(`${dir}/`, root))) {
      const text = read(`${dir}/${file}`);
      for (const m of text.matchAll(/'([a-z0-9_.]+)'\s*\|\s*t\b/g)) used.storefront.add(m[1]);
      for (const m of text.matchAll(/"t:([a-z0-9_.]+)"/g)) used.schema.add(m[1]);
    }
  }
  return used;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const used = usedKeys();
  const missing = [
    ...[...used.storefront].filter((k) => lookup(storefront, k) === undefined).map((k) => `storefront: ${k}`),
    ...[...used.schema].filter((k) => typeof lookup(schema, k) !== 'string').map((k) => `schema: ${k}`),
  ];
  if (missing.length) {
    console.error(`${missing.length} missing translation key(s):\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`Locales complete: ${used.storefront.size} storefront and ${used.schema.size} schema keys.`);
}
