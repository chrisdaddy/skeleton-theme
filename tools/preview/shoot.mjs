#!/usr/bin/env node
// Screenshots the rendered preview at phone and desktop widths, for every preset and page.
// Also captures the mobile menu open, and records console errors and layout shift.
//
//   node shoot.mjs [outDir]     defaults to out/shots
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PAGES, PRESET_STORES } from './render.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const site = join(here, 'out');
const shots = process.argv[2] ?? join(site, 'shots');
mkdirSync(shots, { recursive: true });

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = createServer((req, res) => {
  const path = normalize(join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  try {
    if (!path.startsWith(site) || !statSync(path).isFile()) throw new Error('not found');
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(readFileSync(path));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const report = [];
for (const preset of Object.keys(PRESET_STORES)) {
  for (const page of PAGES) {
    for (const width of [390, 1440]) {
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
      await tab.goto(`${base}/${preset}/${page.name}.html`, { waitUntil: 'networkidle' });
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(300);
      const file = `${preset.toLowerCase()}-${page.name}-${width}.png`;
      await tab.screenshot({ path: join(shots, file), fullPage: true });
      const cls = await tab.evaluate(() => window.__cls);
      if (page.name === 'home' && width === 390) {
        await tab.click('.bp-header__menu-toggle');
        await tab.waitForTimeout(400);
        await tab.screenshot({ path: join(shots, `${preset.toLowerCase()}-menu-390.png`) });
      }
      report.push({ file, cls: Number(cls.toFixed(4)), errors });
      await tab.close();
    }
  }
}
await browser.close();
server.close();

for (const r of report) console.log(`${r.file.padEnd(34)} CLS ${r.cls}${r.errors.length ? `  ERRORS: ${r.errors.join(' | ')}` : ''}`);
if (report.some((r) => r.errors.length)) process.exitCode = 1;
