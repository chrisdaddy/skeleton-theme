#!/usr/bin/env node
// Copies what the server needs from the theme repository into src/generated/, so the npm
// package is self-contained:
//
// - theme-index.json: every section's and theme block's schema (setting IDs, types, options,
//   ranges, block types, max_blocks) and the global settings schema, with English labels.
//   The server validates every template edit against it.
// - definitions.json: the metafield and metaobject definitions (tools/demo/definitions.mjs).
//
//   node scripts/sync.mjs [--check]   --check fails if the generated files are stale
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSchemaIndex } from '../../tools/lib/schema-index.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = join(here, '..', '..');
const out = join(here, '..', 'src', 'generated');
const check = process.argv.includes('--check');

const index = buildSchemaIndex(repo);

const { METAOBJECTS, METAFIELDS, STANDARD_METAFIELDS, NAMESPACE } = await import(join(repo, 'tools/demo/definitions.mjs'));

const files = {
  'theme-index.json': index,
  'definitions.json': { namespace: NAMESPACE, metaobjects: METAOBJECTS, metafields: METAFIELDS, standard: STANDARD_METAFIELDS },
};

mkdirSync(out, { recursive: true });
let stale = false;
for (const [name, data] of Object.entries(files)) {
  const text = `${JSON.stringify(data, null, 1)}\n`;
  const path = join(out, name);
  if (check) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== text) {
      console.error(`src/generated/${name} is stale: run npm run sync`);
      stale = true;
    }
  } else {
    writeFileSync(path, text);
  }
}
if (check && stale) process.exit(1);
if (!check) console.log(`src/generated: ${Object.keys(index.sections).length} sections, ${Object.keys(index.blocks).length} theme blocks, ${index.settings.length} theme settings`);
