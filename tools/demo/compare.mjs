#!/usr/bin/env node
// Side-by-side screenshots: the reference demo (reference/Blueprint Theme v4.dc.html) next to
// Blueprint, per store, page and width. Phase 6 acceptance: "the 3 stores match the reference
// at 390/1440".
//
//   node tools/demo/compare.mjs <store…> [--target=preview|store] [--pages=home,product]
//        [--widths=390,1440] [--theme=<theme id>] [--out=<dir>]
//
// --target=preview (default) renders Blueprint offline with the store's colours
// (tools/preview, ?demo=1); only verde, ode and rawform have preview data.
// --target=store opens the seeded dev store (shopify.theme.toml), optionally an unpublished
// theme (--theme=<id>), entering the storefront password from BLUEPRINT_STORE_PASSWORD.
//
// The reference draws each store inside a framed, scrolling "browser"; that frame is expanded
// to its full height before capture. Images are written as <store>-<page>-<width>.jpg:
// reference on the left, Blueprint on the right.
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { heroHandle } from './catalog.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { chromium } = await import(new URL('../preview/node_modules/playwright-core/index.mjs', import.meta.url));
const demo = JSON.parse(readFileSync(join(root, 'data/demo-content.json'), 'utf8'));
const args = process.argv.slice(2);
const option = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const stores = args.filter((a) => !a.startsWith('--'));
const target = option('target', 'preview');
const pages = option('pages', 'home,product,advertorial,listicle,collection').split(',');
const widths = option('widths', '390,1440').split(',').map(Number);
const out = option('out', join(root, 'docs/screenshots/phase-6'));
const MAX_HEIGHT = 9000;
const PRESET_FOR = { verde: 'Clinical', ode: 'Editorial', rawform: 'Bold' };
// Fixed bars (the reference site's own nav, Blueprint's sticky add to cart) would land
// mid-image in a full-length capture. `keep` is an element whose own bars stay.
const hideFixed = (page, keep = null) =>
  page.evaluate((keepEl) => {
    for (const el of document.querySelectorAll('body *')) {
      const position = getComputedStyle(el).position;
      // Around the reference's frame, its floating bars are sticky or absolutely placed too.
      const around = keepEl && !keepEl.contains(el) && !el.contains(keepEl);
      if (position === 'fixed' || (around && (position === 'sticky' || position === 'absolute'))) el.style.setProperty('display', 'none', 'important');
    }
  }, keep);
const TAB = { home: 'Home', product: 'Product', advertorial: 'Advertorial', listicle: 'Listicle', collection: 'Collection' };

if (!stores.length) {
  console.error('Usage: node tools/demo/compare.mjs <store…> [--target=preview|store] [--pages=…] [--widths=390,1440]');
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });

async function reference(storeId, page, width) {
  const tab = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  await tab.goto(`file://${join(root, 'reference/Blueprint Theme v4.dc.html').replace(/ /g, '%20')}`, { waitUntil: 'load' });
  await tab.waitForTimeout(800);
  const brand = demo.stores[storeId].brand;
  await tab.locator('button', { hasText: new RegExp(`^${brand}$`, 'i') }).first().click();
  await tab.locator('button', { hasText: new RegExp(`^${TAB[page]}$`) }).first().click();
  await tab.waitForTimeout(600);
  // The demo frame: the widest scrolling element in the demo section. Expand it and its frame.
  const handle = await tab.evaluateHandle((brandName) => {
    const pill = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().toLowerCase() === brandName.toLowerCase());
    const section = pill.closest('section');
    const scrollers = [...section.querySelectorAll('*')].filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 10);
    const frame = scrollers.sort((a, b) => b.clientWidth - a.clientWidth)[0];
    let el = frame;
    while (el && el !== section) {
      el.style.height = 'auto';
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';
      el = el.parentElement;
    }
    return frame;
  }, brand);
  // The reference shows its floating "Buy" bar once scrolled: let it appear, then hide it.
  await handle.evaluate((frame) => window.scrollTo(0, frame.getBoundingClientRect().bottom + window.scrollY));
  await tab.waitForTimeout(600);
  await hideFixed(tab, handle);
  const shot = await handle.asElement().screenshot({ type: 'png' });
  await tab.close();
  return shot;
}

async function blueprint(storeId, page, width, context) {
  const tab = await context.newPage();
  await tab.setViewportSize({ width, height: 900 });
  const preset = PRESET_FOR[storeId];
  const paths =
    target === 'store'
      ? { home: '/', product: `/products/${heroHandle(demo.stores[storeId])}`, advertorial: '/pages/advertorial', listicle: '/pages/listicle', collection: '/collections/all' }
      : { home: `/listing/${preset}/index?demo=1`, product: `/listing/${preset}/product?demo=1`, advertorial: `/pages/advertorial?preset=${preset}&demo=1`, listicle: `/pages/listicle?preset=${preset}&demo=1`, collection: `/collections/all?preset=${preset}&demo=1` };
  const url = new URL(paths[page], context.base);
  if (option('theme')) url.searchParams.set('preview_theme_id', option('theme'));
  await tab.goto(url.href, { waitUntil: 'networkidle' });
  await tab.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
    window.scrollTo(0, 0);
    await document.fonts.ready;
  });
  await tab.waitForTimeout(400);
  await hideFixed(tab);
  const shot = await tab.screenshot({ fullPage: true, type: 'png' });
  await tab.close();
  return shot;
}

async function sideBySide(left, right, file, label, width) {
  // Phone captures stay at their natural size; desktop ones share a 1600 px canvas.
  const canvas = width < 700 ? 2 * width + 48 : 1600;
  const tab = await browser.newPage({ viewport: { width: canvas, height: 900 } });
  const src = (png) => `data:image/png;base64,${png.toString('base64')}`;
  await tab.setContent(`<!doctype html><style>
    body { margin: 0; font: 600 13px/1.4 'Liberation Sans', Arial, sans-serif; background: #E5E5E5; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px; align-items: start; }
    figure { margin: 0; background: #fff; min-width: 0; } figcaption { padding: 8px 12px; background: #111; color: #fff; }
    img { display: block; width: 100%; height: auto; }
  </style><div class="row"><figure><figcaption>Reference · ${label}</figcaption><img src="${src(left)}"></figure><figure><figcaption>Blueprint (${target}) · ${label}</figcaption><img src="${src(right)}"></figure></div>`);
  await tab.waitForTimeout(200);
  const height = Math.min(MAX_HEIGHT, await tab.evaluate(() => document.body.scrollHeight));
  await tab.screenshot({ path: file, type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width: canvas, height } });
  await tab.close();
}

let context;
let server;
if (target === 'store') {
  context = await browser.newContext();
} else {
  const { startServer } = await import('../preview/server.mjs');
  server = await startServer();
  context = await browser.newContext();
}

for (const storeId of stores) {
  if (target === 'preview' && !PRESET_FOR[storeId]) {
    console.log(`${storeId}: no preview data (use --target=store once it is seeded)`);
    continue;
  }
  if (target === 'store') {
    const toml = readFileSync(join(root, 'shopify.theme.toml'), 'utf8');
    const shop = new RegExp(`\\[environments\\.${storeId}\\][^\\[]*?store\\s*=\\s*"([^"]+)"`).exec(toml)?.[1];
    context.base = `https://${shop}`;
    if (process.env.BLUEPRINT_STORE_PASSWORD) {
      const tab = await context.newPage();
      await tab.goto(`${context.base}/password`);
      if (await tab.locator('input[type="password"]').count()) {
        await tab.fill('input[type="password"]', process.env.BLUEPRINT_STORE_PASSWORD);
        await Promise.all([tab.waitForNavigation(), tab.locator('input[type="password"]').press('Enter')]);
      }
      await tab.close();
    }
  } else {
    context.base = server.base;
  }
  for (const page of pages) {
    for (const width of widths) {
      const file = join(out, `${storeId}-${page}-${width}.jpg`);
      await sideBySide(await reference(storeId, page, width), await blueprint(storeId, page, width, context), file, `${demo.stores[storeId].brand} ${TAB[page]} @${width}`, width);
      console.log(file.replace(`${root}/`, ''));
    }
  }
}
await browser.close();
server?.close();
