#!/usr/bin/env node
// Writes tools/demo/stores/<id>.json for every demo store: the catalog the seed applies
// (tools/demo/catalog.mjs) plus the placeholder photos its section templates use.
//
//   node tools/demo/build-stores.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildTemplates, photoFilename, photos } from '../templates-from-demo.mjs';
import { buildCatalog } from './catalog.mjs';

const root = new URL('../../', import.meta.url);
const demo = JSON.parse(readFileSync(new URL('data/demo-content.json', root), 'utf8'));

export function storeConfig(storeId) {
  const catalog = buildCatalog(demo, storeId);
  photos.clear();
  buildTemplates(storeId, { images: 'shop' });
  for (const description of photos) {
    const filename = photoFilename(storeId, description);
    if (!catalog.files.some((f) => f.filename === filename)) catalog.files.push({ key: filename.replace(/\.png$/, ''), filename, label: description, alt: '' });
  }
  return catalog;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  mkdirSync(new URL('tools/demo/stores/', root), { recursive: true });
  for (const id of demo.storeOrder) {
    const config = storeConfig(id);
    writeFileSync(new URL(`tools/demo/stores/${id}.json`, root), `${JSON.stringify(config, null, 2)}\n`);
    console.log(`tools/demo/stores/${id}.json: ${config.products.length} products, ${config.metaobjects.length} metaobjects, ${config.files.length} images, ${config.discounts.length} discounts${config.required ? '' : ' (optional store)'}`);
  }
}
