#!/usr/bin/env node
// Phase 5 screenshots: each listing's pre-landers, about page and collection page, at phone
// and desktop widths, plus the sticky CTA and an applied collection filter.
//
//   node shoot-landing.mjs [outDir]     defaults to docs/screenshots/phase-5
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from './server.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.argv[2] ?? join(here, '..', '..', 'docs', 'screenshots', 'phase-5');
mkdirSync(out, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });

async function shoot(path, file, width, { full = true, before } = {}) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce' });
  await page.goto(`${server.base}${path}`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
    window.scrollTo(0, 0);
    await document.fonts.ready;
  });
  await page.waitForTimeout(400);
  if (before) await before(page);
  await page.screenshot({ path: join(out, file), fullPage: full, type: 'jpeg', quality: 70 });
  await page.close();
  console.log(file);
}

const LISTINGS = { Clinical: 'clinical', Editorial: 'editorial', Bold: 'bold' };
for (const [preset, name] of Object.entries(LISTINGS)) {
  await shoot(`/pages/advertorial?preset=${preset}`, `${name}-advertorial-1440.jpg`, 1440);
  await shoot(`/pages/advertorial?preset=${preset}`, `${name}-advertorial-390.jpg`, 390);
  await shoot(`/pages/listicle?preset=${preset}`, `${name}-listicle-390.jpg`, 390);
  await shoot(`/pages/comparison?preset=${preset}`, `${name}-comparison-1440.jpg`, 1440);
  await shoot(`/pages/about?preset=${preset}`, `${name}-about-1440.jpg`, 1440);
  await shoot(`/collections/all?preset=${preset}`, `${name}-collection-1440.jpg`, 1440);
}
// States: the sticky CTA mid-article, and a filtered collection with the panel open.
await shoot('/pages/listicle?preset=Clinical', 'clinical-sticky-cta-390.jpg', 390, {
  full: false,
  before: async (page) => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.35));
    await page.waitForTimeout(400);
  },
});
await shoot('/collections/all?preset=Bold&filter.v.availability=1&sort_by=price-ascending', 'bold-collection-filtered-390.jpg', 390, {
  before: async (page) => {
    await page.locator('[data-bp-facets-panel] summary').click();
    await page.waitForTimeout(200);
  },
});

await browser.close();
server.close();
