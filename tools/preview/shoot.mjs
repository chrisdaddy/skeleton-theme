#!/usr/bin/env node
// Screenshots every preset and page at phone and desktop widths through the preview server,
// plus key states (mobile menu, sticky add to cart, tier 3 on subscription), and reports
// layout shift and console errors.
//
//   node shoot.mjs [outDir]     defaults to out/shots
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PAGES, PRESET_PRODUCTS, PRESET_STORES } from './render.mjs';
import { startServer } from './server.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const shots = process.argv[2] ?? join(here, 'out', 'shots');
mkdirSync(shots, { recursive: true });

const server = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const report = [];

async function open(path, width) {
  const tab = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
  const errors = [];
  tab.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  tab.on('pageerror', (err) => errors.push(err.message));
  await tab.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await tab.goto(`${server.base}${path}`, { waitUntil: 'networkidle' });
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(300);
  return { tab, errors };
}

for (const preset of Object.keys(PRESET_STORES)) {
  const name = preset.toLowerCase();
  for (const page of PAGES) {
    for (const width of [390, 1440]) {
      server.resetCart();
      // The cart page shows a two-pack (the store's most popular tier).
      if (page.name === 'cart') server.cart.add([{ id: PRESET_PRODUCTS[preset].variants[1].id, quantity: 1 }]);
      const { tab, errors } = await open(`/${preset}/${page.name}.html`, width);
      const file = `${name}-${page.name}-${width}.png`;
      await tab.screenshot({ path: join(shots, file), fullPage: true });
      const cls = await tab.evaluate(() => window.__cls);

      if (page.name === 'home' && width === 390) {
        await tab.click('.bp-header__menu-toggle');
        await tab.waitForTimeout(400);
        await tab.screenshot({ path: join(shots, `${name}-menu-390.png`) });
      }
      if (page.name === 'product') {
        // Buy box close-up with tier 3 and subscribe checked.
        await tab.click('[for$="-3"].bp-tier').catch(() => {});
        await tab.locator('[data-bp-plan="sub"]').first().check({ force: true }).catch(() => {});
        await tab.waitForTimeout(200);
        // Unstick the header so it doesn't cover the close-up.
        const unstick = await tab.addStyleTag({ content: '.bp-section-header { position: static !important; }' });
        await tab.locator('.bp-product__info').screenshot({ path: join(shots, `${name}-buybox-tier3-sub-${width}.png`) });
        await unstick.evaluate((el) => el.remove());
        // Sticky add to cart after scrolling past the button.
        await tab.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
        await tab.waitForTimeout(600);
        await tab.screenshot({ path: join(shots, `${name}-sticky-${width}.png`) });
        // Cart drawer after adding tier 3 on subscription.
        await tab.click('[data-bp-atc]');
        await tab.waitForSelector('#CartDrawer[open]', { timeout: 5000 }).catch(() => errors.push('cart drawer did not open'));
        await tab.waitForTimeout(900);
        await tab.screenshot({ path: join(shots, `${name}-drawer-${width}.png`) });
      }
      report.push({ file, cls: Number(cls.toFixed(4)), errors });
      await tab.close();
    }
  }
}
await browser.close();
server.close();

for (const r of report) console.log(`${r.file.padEnd(34)} CLS ${r.cls}${r.errors.length ? `  ERRORS: ${r.errors.join(' | ')}` : ''}`);
if (report.some((r) => r.errors.length || r.cls > 0.02)) process.exitCode = 1;
