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
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = join(here, '..', '..');
const out = join(here, '..', 'src', 'generated');
const check = process.argv.includes('--check');

const schemaLocale = JSON.parse(readFileSync(join(repo, 'locales/en.default.schema.json'), 'utf8'));
const label = (value) => {
  if (typeof value !== 'string' || !value.startsWith('t:')) return value;
  return value.slice(2).split('.').reduce((node, key) => node?.[key], schemaLocale) ?? value;
};

function schemaOf(file) {
  const source = readFileSync(file, 'utf8');
  const match = /\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/.exec(source);
  return match ? JSON.parse(match[1]) : null;
}

function settings(list = []) {
  return list
    .filter((s) => s.id)
    .map((s) => {
      const out = { id: s.id, type: s.type, label: label(s.label) };
      if (s.options) out.options = s.options.map((o) => o.value);
      for (const key of ['min', 'max', 'step', 'default']) if (key in s) out[key] = s[key];
      return out;
    });
}

function blocks(list = []) {
  return list.map((b) => {
    const out = { type: b.type };
    if (b.name) out.name = label(b.name);
    if (b.settings) out.settings = settings(b.settings);
    if (b.limit) out.limit = b.limit;
    return out;
  });
}

const sections = {};
for (const file of readdirSync(join(repo, 'sections')).filter((f) => f.endsWith('.liquid')).sort()) {
  const schema = schemaOf(join(repo, 'sections', file));
  if (!schema) continue;
  sections[file.replace('.liquid', '')] = {
    name: label(schema.name),
    settings: settings(schema.settings),
    blocks: blocks(schema.blocks),
    ...(schema.max_blocks ? { max_blocks: schema.max_blocks } : {}),
    ...(schema.presets ? { addable: true } : {}),
    ...(schema.limit ? { limit: schema.limit } : {}),
  };
}

const themeBlocks = {};
for (const file of readdirSync(join(repo, 'blocks')).filter((f) => f.endsWith('.liquid')).sort()) {
  const schema = schemaOf(join(repo, 'blocks', file));
  if (!schema) continue;
  themeBlocks[file.replace('.liquid', '')] = { name: label(schema.name), settings: settings(schema.settings), blocks: blocks(schema.blocks) };
}

const globalSettings = JSON.parse(readFileSync(join(repo, 'config/settings_schema.json'), 'utf8')).flatMap((group) => settings(group.settings));
const presets = Object.keys(JSON.parse(readFileSync(join(repo, 'config/settings_data.json'), 'utf8')).presets ?? {});

const { METAOBJECTS, METAFIELDS, STANDARD_METAFIELDS, NAMESPACE } = await import(join(repo, 'tools/demo/definitions.mjs'));

const files = {
  'theme-index.json': { sections, blocks: themeBlocks, settings: globalSettings, presets },
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
if (!check) console.log(`src/generated: ${Object.keys(sections).length} sections, ${Object.keys(themeBlocks).length} theme blocks, ${globalSettings.length} theme settings`);
