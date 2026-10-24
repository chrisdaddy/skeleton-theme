#!/usr/bin/env node
// Writes docs/SHOT_LIST.md: every photo the demo stores need, from the reference copy's `photo`
// descriptions (tools/demo/stores/*.json). Each one is a labelled placeholder until the real
// photograph is uploaded under the same file name (the store then shows it everywhere).
//
//   node tools/demo/shot-list.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { sizeFor } from './images.mjs';

const root = new URL('../../', import.meta.url);
const demo = JSON.parse(readFileSync(new URL('data/demo-content.json', root), 'utf8'));

const lines = [
  '# Shot list',
  '',
  'Every photo the demo stores use, generated from the reference copy by `node tools/demo/shot-list.mjs`. Until a photo exists the seed uploads a labelled placeholder with the same file name. To replace one, upload the photograph in **Content → Files** with exactly that file name, replacing the placeholder: products, sections and pre-landers pick it up without template changes.',
  '',
  'Product shots are 1200 × 1200 (square). Section photos are 1600 × 1067 (3:2) and are cropped by each section, so keep the subject centred.',
  '',
];
let total = 0;
for (const id of demo.storeOrder) {
  const config = JSON.parse(readFileSync(new URL(`tools/demo/stores/${id}.json`, root), 'utf8'));
  const usedBy = (file) => {
    const product = config.products.find((p) => p.files.some((f) => f.$file === file.key));
    return product ? `product \`${product.handle}\`` : 'section photo';
  };
  lines.push(`## ${config.brand} (${id}${config.required ? '' : ', optional store'})`, '', '| # | Shot | Used by | Size | File |', '|---|---|---|---|---|');
  config.files.forEach((file, i) => {
    const { width, height } = sizeFor(file);
    lines.push(`| ${i + 1} | ${file.label.replace(/\|/g, '\\|')} | ${usedBy(file)} | ${width} × ${height} | \`${file.filename}\` |`);
  });
  lines.push('');
  total += config.files.length;
}
writeFileSync(new URL('docs/SHOT_LIST.md', root), `${lines.join('\n')}\n`);
console.log(`docs/SHOT_LIST.md: ${total} shots across ${demo.storeOrder.length} stores`);
