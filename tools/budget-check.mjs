#!/usr/bin/env node
// Checks the theme's own asset weight against the performance budget (docs/PLAN.md §11).
//
// "Every page" assets are the ones layout-head.liquid loads. "Lazy" assets are modules
// that elements request with data-bp-module and load on visibility or interaction.
// Sizes are Brotli-compressed, which is what Shopify's CDN serves to modern browsers.
import { readFileSync, readdirSync } from 'node:fs';
import { brotliCompressSync, constants } from 'node:zlib';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const brotli = (text) => brotliCompressSync(Buffer.from(text), { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;

export const BUDGET = {
  everyPageJs: 8 * 1024, // Phase 1 target; the PDP total cap is 20 KB.
  everyPageCss: 15 * 1024,
  lazyChunk: 12 * 1024,
};

const assetRefs = (text) => [...text.matchAll(/'([\w.-]+\.(?:js|css))'\s*\|\s*asset_url/g)].map((m) => m[1]);

export function measure() {
  const everyPage = [...new Set(assetRefs(read('snippets/layout-head.liquid')))];
  const lazy = new Set();
  for (const dir of ['sections', 'blocks', 'snippets']) {
    let files = [];
    try {
      files = readdirSync(new URL(`${dir}/`, root));
    } catch {
      continue;
    }
    for (const file of files) {
      const text = read(`${dir}/${file}`);
      for (const m of text.matchAll(/data-bp-module="\{\{\s*'([\w.-]+\.js)'\s*\|\s*asset_url\s*\}\}"/g)) lazy.add(m[1]);
    }
  }
  const size = (file) => brotli(read(`assets/${file}`));
  return {
    everyPage: everyPage.map((file) => ({ file, bytes: size(file) })),
    lazy: [...lazy].map((file) => ({ file, bytes: size(file) })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { everyPage, lazy } = measure();
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  const sum = (list, ext) => list.filter((a) => a.file.endsWith(ext)).reduce((t, a) => t + a.bytes, 0);
  const problems = [];
  const js = sum(everyPage, '.js');
  const css = sum(everyPage, '.css');
  console.log('Every page:');
  for (const a of everyPage) console.log(`  ${a.file.padEnd(28)} ${kb(a.bytes)}`);
  console.log(`  JS ${kb(js)} of ${kb(BUDGET.everyPageJs)}, CSS ${kb(css)} of ${kb(BUDGET.everyPageCss)}`);
  if (js > BUDGET.everyPageJs) problems.push(`every-page JS ${kb(js)} exceeds ${kb(BUDGET.everyPageJs)}`);
  if (css > BUDGET.everyPageCss) problems.push(`every-page CSS ${kb(css)} exceeds ${kb(BUDGET.everyPageCss)}`);
  console.log('Lazy modules:');
  for (const a of lazy) {
    console.log(`  ${a.file.padEnd(28)} ${kb(a.bytes)}`);
    if (a.bytes > BUDGET.lazyChunk) problems.push(`${a.file} ${kb(a.bytes)} exceeds ${kb(BUDGET.lazyChunk)}`);
  }
  if (problems.length) {
    console.error(`\nOver budget:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log('Budget check passed.');
}
