#!/usr/bin/env node
// Captures the sales site's demo-store screenshots from the offline preview
// (tools/preview), so the tour shows the real theme rather than a mock of it.
//
//   node tools/sales/capture.mjs            all stores and pages
//   node tools/sales/capture.mjs verde      one store (keeps the other entries in the manifest)
//
// Writes, under site/:
//   img/tour/<store>-<page>-d.webp   desktop (1440 wide, scaled to 1080), top crop
//   img/tour/<store>-<page>-m.webp   phone (390 wide), top crop
//   img/wall/<store>.webp            store wall card (top of the phone home page)
//   img/compare-blueprint.webp       Verde's product page in Blueprint (before/after slider)
//   img/compare-stock.webp           the same product as stock theme defaults (HTML below)
//   tour.json                        the manifest site/tour.js reads
//
// What the preview can render decides what the tour shows: Verde, Ode and Rawform (the
// three preset stores) have product, home, pre-lander, collection and cart drawer pages;
// the other seven stores have their home page only, because the preview has no product
// data for them. Nothing here writes to a Shopify store.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../preview/node_modules/playwright-core/index.mjs';
import { demoTemplate } from '../preview/demo-sections.mjs';
import { PRESET_PRODUCTS, PRESET_STORES, STORE_PRESET, STORE_PRODUCT, renderPage } from '../preview/render.mjs';
import { startServer } from '../preview/server.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const site = join(root, 'site');
const tourDir = join(site, 'img', 'tour');
mkdirSync(tourDir, { recursive: true });
mkdirSync(join(site, 'img', 'wall'), { recursive: true });

const demo = JSON.parse(readFileSync(join(root, 'data/demo-content.json'), 'utf8'));
const only = process.argv[2];

const DESKTOP = { width: 1440, height: 900, crop: 3200, out: 1080, quality: 0.72 };
const PHONE = { width: 390, height: 844, crop: 2600, out: 390, quality: 0.74 };
const COMPARE = { width: 1280, height: 760, out: 1040, quality: 0.8 };
const WALL = { width: 390, height: 560, quality: 0.7 };

const PAGE_TITLES = { product: 'Product template', home: 'Home template', advertorial: 'Advertorial template', listicle: 'Listicle template', collection: 'Collection template', cart: 'Cart drawer' };
const PAGE_PATHS = { home: '/', advertorial: '/pages/article', listicle: '/pages/reasons', collection: '/collections/all', cart: '/cart' };

const server = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const encoder = await browser.newPage();
await encoder.setContent('<!doctype html><title>encoder</title>');

// PNG screenshot → WebP via Chromium's canvas encoder, scaled to `width`.
async function toWebp(png, width, quality) {
  const dataUrl = await encoder.evaluate(
    async ({ b64, width, quality }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const scale = width / img.naturalWidth;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', quality);
    },
    { b64: png.toString('base64'), width, quality },
  );
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

// The top `height` pixels of a WebP, re-encoded (store wall cards).
async function cropWebp(webp, { width, height, quality }) {
  const dataUrl = await encoder.evaluate(
    async ({ b64, width, height, quality }) => {
      const img = new Image();
      img.src = `data:image/webp;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height, 0, 0, width, height);
      return canvas.toDataURL('image/webp', quality);
    },
    { b64: webp.toString('base64'), width, height, quality },
  );
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

// Labels for the section chips: template section IDs are "<demo type>_<n>", and "main" is the buy box.
const labelFor = (id) => (id === 'main' ? demo.sectionLabels.buybox : demo.sectionLabels[id.replace(/_\d+$/, '')]);

async function open(url, viewport, { html } = {}) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (html) await page.route(url, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.goto(url, { waitUntil: 'networkidle' });
  // Scroll through once so lazy media and reveal-on-scroll content are in their final state.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 25));
    }
    window.scrollTo(0, 0);
    await document.fonts.ready;
  });
  await page.waitForTimeout(350);
  return { page, errors };
}

async function shoot(page, viewport, { fullCrop = true } = {}) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const crop = fullCrop ? Math.min(height, viewport.crop) : viewport.height;
  const png = await page.screenshot({ fullPage: fullCrop, clip: { x: 0, y: 0, width: viewport.width, height: crop } });
  const sections = fullCrop
    ? await page.evaluate(
        (limit) =>
          [...document.querySelectorAll('main .shopify-section, #MainContent .shopify-section')]
            .map((el) => ({ id: el.id.replace('shopify-section-', ''), top: Math.round(el.getBoundingClientRect().top + window.scrollY) }))
            .filter((s) => s.top < limit - 240),
        crop,
      )
    : [];
  const webp = await toWebp(png, viewport.out, viewport.quality);
  const scale = viewport.out / viewport.width;
  return { webp, w: viewport.out, h: Math.round(crop * scale), cropHeight: crop, sections };
}

// A store's home page: its reference section stack, in its own demo colours (as seeded).
function homeHtml(storeId) {
  const store = demo.stores[storeId];
  const product = STORE_PRODUCT[storeId];
  // Countdowns use a fixed end, as the theme's do: here a few hours after the capture.
  const end = new Date(Date.now() + 9.5 * 3600000);
  const countdownEnd = `${end.toISOString().slice(0, 16).replace('T', ' ')} +0000`;
  const { template } = demoTemplate(store, { productHandle: product?.handle, include: 'home', themeRoot: root, countdownEnd });
  const page = { name: 'home', type: 'index', title: 'Home', template: 'index' };
  return renderPage(STORE_PRESET[storeId], page, new URLSearchParams('demo=1'), null, { store: storeId, template, product });
}

const presetFor = (storeId) => Object.keys(PRESET_STORES).find((p) => PRESET_STORES[p] === storeId);

async function capturePage(storeId, pageId, viewport) {
  const preset = presetFor(storeId);
  let opened;
  if (pageId === 'home') opened = await open(`${server.base}/capture/${storeId}`, viewport, { html: await homeHtml(storeId) });
  else if (pageId === 'product' || pageId === 'cart') opened = await open(`${server.base}/products/${PRESET_PRODUCTS[preset].handle}?demo=1`, viewport);
  else if (pageId === 'collection') opened = await open(`${server.base}/collections/all?preset=${preset}&demo=1`, viewport);
  else opened = await open(`${server.base}/pages/${pageId}?preset=${preset}&demo=1`, viewport);
  const { page, errors } = opened;
  let shot;
  if (pageId === 'cart') {
    server.resetCart();
    await page.click('[data-bp-atc]');
    await page.waitForSelector('#CartDrawer[open]', { timeout: 5000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(900);
    shot = await shoot(page, viewport, { fullCrop: false });
    server.resetCart();
  } else {
    shot = await shoot(page, viewport);
  }
  await page.close();
  if (errors.length) console.warn(`  ${storeId}/${pageId} ${viewport.width}: ${errors.join(' | ')}`);
  return shot;
}

function write(file, buffer) {
  writeFileSync(join(site, file), buffer);
  return file;
}

// ---------- Tour ----------

const manifestPath = join(site, 'tour.json');
const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { stores: [] };
const stores = [];
for (const id of demo.storeOrder) {
  if (only && only !== id) {
    const kept = previous.stores.find((s) => s.id === id);
    if (kept) stores.push(kept);
    continue;
  }
  const store = demo.stores[id];
  const preset = presetFor(id);
  const pageIds = preset ? ['product', 'home', 'advertorial', 'listicle', 'collection', 'cart'] : ['home'];
  const entry = {
    id,
    brand: store.brand,
    preset: demo.presets[id].name,
    swatch: demo.presets[id].swatch,
    vertical: store.vertical,
    vibe: store.vibe,
    domain: store.domain,
    pages: {},
  };
  for (const pageId of pageIds) {
    const page = { title: PAGE_TITLES[pageId], path: pageId === 'product' ? `/products/${PRESET_PRODUCTS[preset].handle}` : PAGE_PATHS[pageId] };
    for (const [key, viewport] of [['d', DESKTOP], ['m', PHONE]]) {
      const shot = await capturePage(id, pageId, viewport);
      const file = write(`img/tour/${id}-${pageId}-${key}.webp`, shot.webp);
      page[key] = { src: file, w: shot.w, h: shot.h, kb: Math.round(shot.webp.length / 1024) };
      // Section chips (desktop positions, as a fraction of the captured height).
      if (key === 'd' && (pageId === 'product' || pageId === 'home')) {
        page.sections = shot.sections
          .map((s) => ({ label: labelFor(s.id), at: Number((s.top / shot.cropHeight).toFixed(4)) }))
          .filter((s) => s.label);
      }
      console.log(`${file}  ${page[key].w}×${page[key].h}  ${page[key].kb} KB`);
      // The store wall's card: the top of the phone home page, small enough for ten at once.
      if (key === 'm' && pageId === 'home') write(`img/wall/${id}.webp`, await cropWebp(shot.webp, WALL));
    }
    entry.pages[pageId] = page;
  }
  stores.push(entry);
}
writeFileSync(manifestPath, `${JSON.stringify({ note: 'Generated by tools/sales/capture.mjs from the offline preview. Do not edit by hand.', pages: Object.keys(PAGE_TITLES), stores }, null, 1)}\n`);

// ---------- Before / after ----------

if (!only || only === 'compare') {
  const product = PRESET_PRODUCTS.Clinical;
  const variant = product.variants[0];
  const money = (cents) => `$${(cents / 100).toFixed(2)}`;
  const photo = product.media?.[0]?.alt ?? demo.stores.verde.product.photo;

  // Blueprint: the first viewport of Verde's product page.
  // The first variant, so both sides show the same price; the sticky bar is hidden (it only
  // appears once the shopper scrolls past the button).
  const { page: bp } = await open(`${server.base}/products/${product.handle}?variant=${variant.id}&demo=1`, COMPARE);
  await bp.addStyleTag({ content: 'bp-sticky-atc { display: none !important; }' });
  const bpShot = await bp.screenshot({ clip: { x: 0, y: 0, width: COMPARE.width, height: COMPARE.height } });
  await bp.close();
  write('img/compare-blueprint.webp', await toWebp(bpShot, COMPARE.out, COMPARE.quality));

  // Stock theme defaults: the same product, photo slot and first-variant price, laid out the way
  // an untouched free theme shows it. Written here from scratch; it imitates no particular theme.
  const stockHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Stock theme defaults</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font: 16px/1.6 Helvetica, Arial, sans-serif; color: #121212; background: #fff; }
  .bar { background: #121212; color: #fff; font-size: 13px; text-align: center; padding: 10px; letter-spacing: .06em; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 22px 64px; border-bottom: 1px solid #e6e6e6; }
  .logo { font-size: 26px; letter-spacing: .02em; }
  nav { display: flex; gap: 28px; font-size: 15px; color: #444; }
  main { display: grid; grid-template-columns: 1.2fr 1fr; gap: 64px; padding: 40px 64px; }
  .photo { aspect-ratio: 1; background: #d9d6d0; display: grid; place-items: center; text-align: center; color: #3a3a3a; font-size: 22px; padding: 48px; }
  .vendor { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #666; }
  h1 { font-weight: 400; font-size: 40px; line-height: 1.2; margin: 6px 0 12px; }
  .price { font-size: 18px; letter-spacing: .06em; }
  .tax { font-size: 13px; color: #666; margin: 4px 0 26px; }
  label { font-size: 13px; color: #666; display: block; margin-bottom: 8px; }
  .qty { display: inline-flex; border: 1px solid #121212; width: 140px; justify-content: space-between; padding: 12px 18px; margin-bottom: 22px; }
  .btn { display: block; width: 100%; text-align: center; padding: 15px; border: 1px solid #121212; margin-bottom: 10px; font-size: 15px; letter-spacing: .06em; }
  .shop { background: #5a31f4; color: #fff; border-color: #5a31f4; }
  .desc { font-size: 15px; color: #444; margin-top: 18px; }
</style></head><body>
<div class="bar">Welcome to our store</div>
<header><span class="logo">${demo.stores.verde.brand}</span><nav><span>Home</span><span>Catalog</span><span>Contact</span></nav><span>&#9906;&nbsp;&nbsp;&#128722;</span></header>
<main>
  <div class="photo"><span>${photo}<br><small style="font-size:15px;color:#555">Placeholder · photography to come</small></span></div>
  <div>
    <p class="vendor">${demo.stores.verde.brand}</p>
    <h1>${product.title}</h1>
    <p class="price">${money(variant.price)} USD</p>
    <p class="tax">Shipping calculated at checkout.</p>
    <label>Quantity</label>
    <div class="qty"><span>&minus;</span><span>1</span><span>+</span></div>
    <span class="btn">Add to cart</span>
    <span class="btn shop">Buy with Shop</span>
    <p class="desc">${demo.stores.verde.product.title}</p>
  </div>
</main></body></html>`;
  const { page: stock } = await open(`${server.base}/capture/stock`, COMPARE, { html: stockHtml });
  const stockShot = await stock.screenshot({ clip: { x: 0, y: 0, width: COMPARE.width, height: COMPARE.height } });
  await stock.close();
  write('img/compare-stock.webp', await toWebp(stockShot, COMPARE.out, COMPARE.quality));
  console.log('img/compare-blueprint.webp, img/compare-stock.webp');
}

await browser.close();
server.close();
