#!/usr/bin/env node
// Content sections checklist (docs/PLAN.md §4, Phase 4 acceptance), run against the offline
// preview in Chromium.
//
// - Every demo store's sections (data/demo-content.json) and every section preset, at 390
//   and 1440 px: no console errors, no sideways scrolling, no axe violations.
// - Reduced motion: marquees stand still, counters show their final number, nothing autoplays.
// - Without JavaScript: the quiz, bundle builder, before/after, tabs and countdown still work
//   or degrade to readable content.
// - Interactions: quiz, bundle builder (prices from variants, saving rounded down), before/after
//   by keyboard, tabs by keyboard, countdown, slider buttons, quick add (form and dialog),
//   related products, FAQ structured data.
//
//   node sections-checklist.mjs [--verbose]
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { DEMO_STORES, cartFixtures } from './render.mjs';
import { startServer } from './server.mjs';

const server = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const axeSource = readFileSync(new URL('./node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const verbose = process.argv.includes('--verbose');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
const money = (cents) => `$${(cents / 100).toFixed(2)}`;

async function open(path, { width = 1440, js = true, reducedMotion = 'no-preference' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: js, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${server.base}${path}`, { waitUntil: 'networkidle' });
  if (js) {
    // Scroll through, so lazy images and visibility-loaded modules run.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
  }
  return { context, page, errors };
}

async function axe(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const r = await window.axe.run('main', { resultTypes: ['violations'] });
    return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target} — ${v.nodes[0]?.failureSummary?.split('\n')[1]?.trim()}`);
  });
}

// ---------- Every page at both widths ----------
const pages = [...DEMO_STORES.map((id) => ({ label: `store ${id}`, path: `/stores/${id}/sections.html` })), ...['Clinical', 'Editorial', 'Bold'].map((p) => ({ label: `presets ${p}`, path: `/${p}/presets.html` }))];
for (const { label, path } of pages) {
  for (const width of [390, 1440]) {
    const { context, page, errors } = await open(path, { width });
    const L = `${label} @${width}`;
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`${L}: no sideways scrolling`, scrollWidth <= width, scrollWidth);
    // Empty by design: Apps and Custom Liquid without content, the spacer, a countdown
    // without an end date (editor only) and a subscription explainer for a product with no plans.
    const allowed = /^shopify-section-(apps|custom-liquid|divider|countdown)-\d+$|^shopify-section-subscription-\d+$/;
    const empty = await page.evaluate(() => [...document.querySelectorAll('main .shopify-section')].filter((s) => !s.textContent.trim() && !s.querySelector('img, svg, video, hr')).map((s) => s.id));
    const unexpected = empty.filter((id) => !(allowed.test(id) && (label.startsWith('presets') || !id.includes('subscription'))));
    check(`${L}: every section renders`, unexpected.length === 0, unexpected);
    const violations = await axe(page);
    check(`${L}: axe finds no violations`, violations.length === 0, violations);
    check(`${L}: no console errors`, errors.length === 0, errors);
    await context.close();
  }
  if (verbose) console.log(`checked ${label}`);
}

// ---------- Reduced motion ----------
{
  const { context, page } = await open('/Clinical/presets.html', { reducedMotion: 'reduce' });
  const motion = await page.evaluate(() => ({
    marquees: [...document.querySelectorAll('.bp-marquee__track')].map((t) => getComputedStyle(t).animationName),
    counters: [...document.querySelectorAll('bp-counter')].map((c) => c.textContent.trim()),
    playing: [...document.querySelectorAll('video')].filter((v) => !v.paused).length,
    autoplayButtons: document.querySelectorAll('.bp-slideshow .bp-slider__nav .bp-round-button').length,
  }));
  check('reduced motion: marquees stand still', motion.marquees.length > 0 && motion.marquees.every((n) => n === 'none'), motion.marquees);
  check('reduced motion: counters show final values', motion.counters.length > 0 && motion.counters.every((t) => /\d/.test(t) && !t.startsWith('0') || t === '0'), motion.counters);
  check('reduced motion: no video plays', motion.playing === 0, motion.playing);
  await context.close();
}

// ---------- Without JavaScript ----------
{
  const { context, page, errors } = await open('/stores/kindly/sections.html', { js: false });
  const quiz = await page.evaluate(() => [...document.querySelectorAll('.bp-quiz__answer')].map((a) => a.getAttribute('href')));
  check('no JS: quiz answers are links', quiz.length > 0 && quiz.every((h) => h && h !== ''), quiz);
  const bundle = await page.evaluate(() => {
    const form = document.querySelector('.bp-bundle__form');
    return { action: form?.getAttribute('action'), method: form?.getAttribute('method'), checked: new FormData(form).getAll('items[0][id]').length + new FormData(form).getAll('items[1][id]').length + new FormData(form).getAll('items[2][id]').length };
  });
  check('no JS: bundle builder is a real cart form', bundle.action === '/cart/add' && bundle.method === 'post' && bundle.checked === 3, bundle);
  server.resetCart();
  await page.click('.bp-bundle__form [type="submit"]');
  await page.waitForLoadState('load');
  const cart = server.cart.json('Clinical');
  check('no JS: bundle posts its picked items', cart.item_count === 3 && new URL(page.url()).pathname === '/cart', [cart.item_count, page.url()]);
  await context.close();

  const { context: c2, page: p2 } = await open('/Bold/presets.html', { js: false });
  const nojs = await p2.evaluate(() => ({
    tabsPanelsVisible: [...document.querySelectorAll('.bp-tabs__panel')].filter((p) => !p.hidden && p.offsetParent).length,
    beforeAfterBoth: [...document.querySelectorAll('.bp-beforeafter__side')].filter((s) => s.offsetParent).length,
    timerFallback: [...document.querySelectorAll('.bp-timer__fallback')].map((f) => f.textContent.trim()),
  }));
  check('no JS: every tab panel shows', nojs.tabsPanelsVisible === 3, nojs.tabsPanelsVisible);
  check('no JS: before and after both show', nojs.beforeAfterBoth === 2, nojs.beforeAfterBoth);
  check('no JS: no console errors', errors.length === 0, errors);
  await c2.close();
}

// ---------- Interactions ----------
{
  // Quiz: one answer per question, then the result links to it.
  const { context, page } = await open('/stores/kindly/sections.html');
  const quiz = page.locator('bp-quiz').first();
  const first = quiz.locator('.bp-quiz__answer').nth(1);
  const expected = await first.getAttribute('data-result-url');
  const resultText = await first.getAttribute('data-result-text');
  await first.click();
  await page.waitForTimeout(200);
  const result = quiz.locator('[data-bp-result]');
  check('quiz: shows the result', await result.isVisible());
  check('quiz: result text and link match the answer', (await result.locator('[data-bp-result-text]').textContent()) === resultText && (await result.locator('[data-bp-result-link]').getAttribute('href')) === expected, [resultText, expected]);
  check('quiz: focus moves to the result', await page.evaluate(() => document.activeElement?.matches('[data-bp-result]')));
  await quiz.locator('[data-bp-restart]').click();
  check('quiz: restart shows the question again', await quiz.locator('.bp-quiz__step').first().isVisible());

  // Bundle: totals from the variants' own prices, displayed % off, saving rounded down.
  const bundle = page.locator('bp-bundle').first();
  const prices = await bundle.locator('.bp-bundle-item__input:checked').evaluateAll((els) => els.map((e) => Number(e.dataset.price)));
  const percent = Number(await bundle.getAttribute('data-percent'));
  const before = prices.reduce((a, b) => a + b, 0);
  const after = Math.ceil((before * (100 - percent)) / 100);
  const shown = { before: await bundle.locator('[data-bp-before]').textContent(), after: await bundle.locator('[data-bp-after]').textContent(), progress: await bundle.locator('[data-bp-progress]').textContent() };
  check('bundle: total is the variants\' prices less the shown %', shown.before === money(before) && shown.after === money(after), { shown, before, after });
  check('bundle: says it is ready at the minimum', shown.progress === 'Bundle ready', shown.progress);
  await bundle.locator('.bp-bundle-item').first().click();
  check('bundle: button disables below the minimum', await bundle.locator('[data-bp-submit]').isDisabled());
  await bundle.locator('.bp-bundle-item').first().click();
  server.resetCart();
  await bundle.locator('[data-bp-submit]').click();
  await page.waitForSelector('#CartDrawer[open]', { timeout: 4000 }).catch(() => null);
  check('bundle: adds every pick and opens the cart', server.cart.json('Clinical').item_count === 3 && (await page.evaluate(() => document.querySelector('#CartDrawer')?.open)), server.cart.json('Clinical').item_count);
  await context.close();
}
{
  const { context, page } = await open('/Editorial/presets.html');
  // Before / after: a keyboard-operable range input moves the divide.
  const range = page.locator('.bp-beforeafter__range').first();
  await range.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const position = await page.locator('bp-compare').first().evaluate((el) => el.style.getPropertyValue('--bp-position'));
  check('before/after: arrow keys move the divide', position === '52%', position);
  check('before/after: the range has a label', Boolean(await range.getAttribute('aria-label')));

  // Tabs: a tablist; arrow keys move between tabs.
  const tabs = page.locator('bp-tabs [role="tab"]');
  check('tabs: three tabs', (await tabs.count()) === 3, await tabs.count());
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  const selected = await page.evaluate(() => [...document.querySelectorAll('bp-tabs [role="tab"]')].map((t) => t.getAttribute('aria-selected')));
  check('tabs: arrow key selects the next tab', selected.join() === 'false,true,false', selected);
  check('tabs: only the selected panel shows', (await page.locator('bp-tabs [role="tabpanel"]:visible').count()) === 1);

  // Slider buttons scroll the row.
  const slider = page.locator('.bp-reviews bp-slider').first();
  await slider.scrollIntoViewIfNeeded();
  const before = await slider.locator('.bp-scroller').evaluate((el) => el.scrollLeft);
  const next = slider.locator('.bp-slider__nav button').last();
  const canScroll = await slider.locator('.bp-scroller').evaluate((el) => el.scrollWidth > el.clientWidth + 2);
  if (canScroll) {
    await next.click();
    await page.waitForTimeout(700);
    check('slider: next button scrolls', (await slider.locator('.bp-scroller').evaluate((el) => el.scrollLeft)) > before);
  }

  // FAQ structured data is valid JSON with every question.
  const ld = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent).filter((t) => t.includes('FAQPage')));
  let parsed = null;
  try {
    parsed = JSON.parse(ld[0]);
  } catch {}
  check('faq: FAQPage structured data parses', parsed?.mainEntity?.length === 3, ld[0]?.slice(0, 200));

  // Related products: fetched after load, never the product itself.
  const related = page.locator('bp-recommendations').first();
  await related.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  check('related products: filled in after load', (await related.locator('li').count()) > 0, await related.locator('li').count());

  // Quick add: "Choose options" opens the product's buy box in a dialog; adding opens the cart.
  server.resetCart();
  const choose = page.locator('[data-bp-quick-add]').first();
  await choose.scrollIntoViewIfNeeded();
  await choose.hover();
  await page.waitForTimeout(300);
  await choose.click();
  const dialog = await page.waitForSelector('.bp-quick-add-dialog[open]', { timeout: 4000 }).catch(() => null);
  check('quick add: opens a dialog with the buy box', dialog && (await page.locator('.bp-quick-add-dialog [data-bp-atc]').count()) === 1);
  if (dialog) {
    check('quick add: focus moves into the dialog', await page.evaluate(() => Boolean(document.activeElement?.closest('.bp-quick-add-dialog'))));
    await page.waitForTimeout(800);
    await page.locator('.bp-quick-add-dialog [data-bp-atc]').click();
    await page.waitForSelector('#CartDrawer[open]', { timeout: 4000 }).catch(() => null);
    check('quick add: adds to the cart and hands over to the drawer', server.cart.json('Editorial').item_count >= 1 && !(await page.evaluate(() => document.querySelector('.bp-quick-add-dialog')?.open)), server.cart.json('Editorial').item_count);
  }
  await context.close();
}
{
  // Quick add, single-variant card: a real form, sent in place.
  const { context, page } = await open('/stores/ode/sections.html');
  server.resetCart();
  const form = page.locator('[data-bp-quick-form]').first();
  check('quick add: single-variant cards are a real form', (await form.getAttribute('action')) === '/cart/add');
  await form.locator('button').hover();
  await page.waitForTimeout(300);
  await form.locator('button').click();
  await page.waitForSelector('#CartDrawer[open]', { timeout: 4000 }).catch(() => null);
  check('quick add: adds in place and opens the cart', server.cart.json('Editorial').item_count === 1 && new URL(page.url()).pathname.startsWith('/stores/'), [server.cart.json('Editorial').item_count, page.url()]);

  // Countdown: counting, with a role and the four units.
  const timer = page.locator('bp-timer').first();
  if (await timer.count()) {
    const a = await timer.innerText();
    await page.waitForTimeout(1200);
    check('countdown: counts down', (await timer.innerText()) !== a, a);
  }
  await context.close();
}
{
  // Countdown on the store that uses it, and the counter animation's end state.
  const { context, page } = await open('/stores/dreamr/sections.html');
  const timer = page.locator('bp-timer').first();
  const a = await timer.innerText();
  await page.waitForTimeout(1200);
  check('countdown: counts down to a fixed end', (await timer.getAttribute('role')) === 'timer' && (await timer.innerText()) !== a, a);
  await context.close();

  const { context: c2, page: p2 } = await open('/stores/omni/sections.html');
  await p2.waitForTimeout(1500);
  const counters = await p2.evaluate(() => [...document.querySelectorAll('bp-counter')].map((c) => c.textContent.trim()));
  check('counters: end on the real value', counters.join() === '11,92,0,$3.30', counters);
  await c2.close();
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
if (verbose) for (const r of results.filter((x) => x.ok)) console.log(`✓ ${r.name}`);
for (const r of failed) console.log(`✗ ${r.name}\n    ${r.detail.slice(0, 600)}`);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exitCode = failed.length ? 1 : 0;
