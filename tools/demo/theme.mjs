#!/usr/bin/env node
// Builds the theme as one demo store shows it, and optionally pushes it there.
//
//   node tools/demo/theme.mjs <store> [--out=<dir>] [--push]      (default out: <tmp>/blueprint-demo/<store>)
//
// The build is the theme as released, plus what makes it this store (nothing here changes
// the theme's code):
// - templates from the store's reference copy, with section photos pointing at the
//   placeholders the seed uploaded (shopify://shop_images/…);
// - settings_data.json: the store's preset with its own colours, and the cart rewards,
//   gifts, protection and upsell collection that match the seeded discounts;
// - the announcement bar: a notice that products, prices and reviews are samples, then the
//   store's own messages.
// --push uploads it as an unpublished theme named "Blueprint demo" (tools/store.mjs, Theme
// Access password from the environment). Publishing stays a manual step in the admin.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildTemplates } from '../templates-from-demo.mjs';
import { storeConfig } from './build-stores.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const THEME_DIRS = ['assets', 'blocks', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];

export function buildDemoTheme(storeId, out) {
  const demo = JSON.parse(readFileSync(`${root}/data/demo-content.json`, 'utf8'));
  const store = demo.stores[storeId];
  const config = storeConfig(storeId);
  rmSync(out, { recursive: true, force: true });
  for (const dir of THEME_DIRS) cpSync(`${root}/${dir}`, `${out}/${dir}`, { recursive: true });

  for (const [name, data] of Object.entries(buildTemplates(storeId, { images: 'shop' }))) {
    writeFileSync(`${out}/templates/${name}.json`, `${JSON.stringify(data, null, 2)}\n`);
  }

  const settingsData = JSON.parse(readFileSync(`${out}/config/settings_data.json`, 'utf8'));
  const base = settingsData.presets[config.preset];
  settingsData.current = { ...base, ...Object.fromEntries(Object.entries(config.theme.settings).filter(([, v]) => v !== null)) };
  writeFileSync(`${out}/config/settings_data.json`, `${JSON.stringify(settingsData, null, 2)}\n`);

  const group = JSON.parse(readFileSync(`${out}/sections/header-group.json`, 'utf8'));
  const messages = [config.notice, ...store.bar.split(' · ')];
  group.sections.announcement.blocks = Object.fromEntries(messages.map((text, i) => [`message-${i + 1}`, { type: 'message', settings: { text } }]));
  group.sections.announcement.block_order = messages.map((_, i) => `message-${i + 1}`);
  writeFileSync(`${out}/sections/header-group.json`, `${JSON.stringify(group, null, 2)}\n`);

  // The reference's footer has no "about" copy: drop text blocks still on the theme's default
  // ("Tell customers what your brand stands for"), which is there for merchants to replace.
  const footer = JSON.parse(readFileSync(`${out}/sections/footer-group.json`, 'utf8'));
  for (const section of Object.values(footer.sections)) {
    const placeholders = Object.entries(section.blocks ?? {}).filter(([, b]) => b.type === 'text' && !b.settings?.text).map(([id]) => id);
    for (const id of placeholders) delete section.blocks[id];
    if (section.block_order) section.block_order = section.block_order.filter((id) => !placeholders.includes(id));
  }
  writeFileSync(`${out}/sections/footer-group.json`, `${JSON.stringify(footer, null, 2)}\n`);
  return { out, config };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const storeId = args.find((a) => !a.startsWith('--'));
  if (!storeId) {
    console.error('Usage: node tools/demo/theme.mjs <store> [--out=<dir>] [--push]');
    process.exit(2);
  }
  // Outside the repository, so Theme Check and the CLI never see a second copy of the theme.
  const out = args.find((a) => a.startsWith('--out='))?.slice(6) ?? `${tmpdir()}/blueprint-demo/${storeId}`;
  mkdirSync(out, { recursive: true });
  buildDemoTheme(storeId, out);
  console.log(`Built ${storeId} demo theme in ${out}`);
  if (args.includes('--push')) {
    const result = spawnSync(process.execPath, [`${root}/tools/store.mjs`, storeId, 'push', '--unpublished', '--theme', 'Blueprint demo', '--path', out], { stdio: 'inherit' });
    process.exit(result.status ?? 1);
  }
}
