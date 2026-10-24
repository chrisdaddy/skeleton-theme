#!/usr/bin/env node
// Templates and pre-landers checklist (docs/PLAN.md §9, Phase 5 acceptance), run against the
// offline preview in Chromium.
//
// - Every listing's pages (advertorial, listicle, comparison, about, contact, collection, and
//   the listing's own home and product templates), at 390 and 1440 px: no console errors,
//   no sideways scrolling, no axe violations, no layout shift.
// - Robots: pre-landers carry "noindex, follow" by default; the page's blueprint.robots
//   metafield can index one. The blueprint.header metafield swaps in the store's full header.
// - URL contract: CTA links are deep links (variant, selling_plan, tier, plan) that preselect
//   the tier and plan on the product page with and without JavaScript, and post that choice.
//   Campaign parameters (utm_*, click IDs) carry over when a CTA is clicked; others don't.
// - The offer section starts on its default tier and adds to cart (drawer with JS, a form
//   post without it). The sticky CTA shows after scrolling, hides over the offer, and can't be
//   reached by keyboard while hidden; without JS it sits at the end of the page.
// - Collection page: pills, filters, sorting, active chips, the empty state and history, with
//   JavaScript (Section Rendering, no reload) and without (links and a GET form).
//
//   node landing-checklist.mjs [--verbose]
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { PRESET_PRODUCTS, listingTemplate, pageDef, renderPage } from './render.mjs';
import { startServer } from './server.mjs';

const server = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const axeSource = readFileSync(new URL('./node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const verbose = process.argv.includes('--verbose');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
const PRESETS = ['Clinical', 'Editorial', 'Bold'];

async function open(path, { width = 1440, js = true, scroll = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: js, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  // Layout shifts from the first paint on (CLS without user input).
  await page.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shifts.push(entry.value);
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(`${server.base}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const loadShift = await page.evaluate(() => (window.__shifts || []).reduce((a, b) => a + b, 0));
  if (js && scroll) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500);
  }
  return { context, page, errors, loadShift };
}

async function axe(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target} — ${v.nodes[0]?.failureSummary?.split('\n')[1]?.trim()}`);
  });
}

const robots = (page) => page.evaluate(() => document.querySelector('meta[name="robots"]')?.content ?? null);

// ---------- Every page at both widths ----------
const PAGES = ['advertorial', 'listicle', 'comparison', 'about', 'contact'];
const LANDING = ['advertorial', 'listicle', 'comparison'];
for (const preset of PRESETS) {
  const paths = [
    ...PAGES.map((h) => [h, `/pages/${h}?preset=${preset}`]),
    ['collection', `/collections/all?preset=${preset}`],
    ['listing home', `/listing/${preset}/index`],
    ['listing product', `/listing/${preset}/product`],
  ];
  for (const [name, path] of paths) {
    for (const width of [390, 1440]) {
      const L = `${preset} ${name} @${width}`;
      const { context, page, errors, loadShift } = await open(path, { width });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      check(`${L}: no sideways scrolling`, scrollWidth <= width, scrollWidth);
      const empty = await page.evaluate(() => [...document.querySelectorAll('main .shopify-section')].filter((s) => !s.textContent.trim() && !s.querySelector('img, svg, video, hr')).map((s) => s.id));
      check(`${L}: every section renders`, empty.length === 0, empty);
      // On load nothing moves; reading down the page stays within the "good" CLS of 0.1.
      check(`${L}: no layout shift on load (${loadShift.toFixed(4)})`, loadShift < 0.01, loadShift);
      const cls = await page.evaluate(() => window.__shifts.reduce((a, b) => a + b, 0));
      check(`${L}: CLS while scrolling under 0.1 (${cls.toFixed(4)})`, cls < 0.1, cls);
      const violations = await axe(page);
      check(`${L}: axe finds no violations`, violations.length === 0, violations);
      check(`${L}: no console errors`, errors.length === 0, errors);
      if (width === 1440) {
        const meta = await robots(page);
        if (LANDING.includes(name)) check(`${L}: robots "noindex, follow"`, meta === 'noindex, follow', meta);
        else check(`${L}: no robots meta`, meta === null, meta);
        const h1 = await page.locator('h1').count();
        check(`${L}: exactly one h1`, h1 === 1, h1);
      }
      await context.close();
    }
    if (verbose) console.log(`checked ${preset} ${name}`);
  }
}

// ---------- Robots and header metafields ----------
{
  const { context, page } = await open('/pages/advertorial?preset=Clinical&robots=index', { scroll: false });
  check('advertorial with blueprint.robots = index: no robots meta', (await robots(page)) === null, await robots(page));
  await context.close();
}
{
  const { context, page } = await open('/pages/advertorial?preset=Clinical', { scroll: false });
  const nav = await page.locator('header nav a').count();
  check('advertorial: landing header (logo only, no store menu)', nav === 0 && (await page.locator('header .bp-header__logo').count()) === 1, nav);
  await context.close();
  const full = await open('/pages/advertorial?preset=Clinical&header=full', { scroll: false });
  const fullNav = await full.page.locator('header nav a').count();
  check('advertorial with blueprint.header = full: the store menu shows', fullNav > nav, { nav, fullNav });
  await full.context.close();
}

// ---------- URL contract ----------
// CTA links built by cta-url for each tier and plan, rendered in a sticky CTA that targets
// the product (the same snippet every CTA uses).
async function ctaHref(preset, tier, plan) {
  const product = PRESET_PRODUCTS[preset];
  const template = { layout: 'landing', sections: { cta: { type: 'sticky-cta', settings: { target: 'product', cta_label: 'Go', cta_product: product.handle, cta_tier: tier, cta_plan: plan } } }, order: ['cta'] };
  const html = await renderPage(preset, pageDef(preset, 'advertorial'), new URLSearchParams(), 'cta', { template });
  return /href="([^"]+)" data-bp-cta/.exec(html)?.[1].replaceAll('&amp;', '&');
}

async function pdpState(page) {
  return page.evaluate(() => {
    const tier = document.querySelector('[data-bp-tier-input]:checked');
    const plan = document.querySelector('[data-bp-plan]:checked');
    return { tier: tier?.dataset.bpTierInput ?? null, plan: plan?.dataset.bpPlan ?? null, url: location.search };
  });
}

for (const preset of PRESETS) {
  const product = PRESET_PRODUCTS[preset];
  const hasTiers = Boolean(product.metafields.blueprint?.tiers?.value?.length || product.options.length);
  const hasPlans = product.selling_plan_groups.length > 0;
  const cases = [
    [2, 'sub'],
    [3, 'once'],
    [1, 'default'],
  ].filter(([, plan]) => hasPlans || plan !== 'sub');
  for (const [tier, plan] of cases) {
    const L = `${preset} CTA tier ${tier} / ${plan}`;
    const href = await ctaHref(preset, tier, plan);
    const url = new URL(href, server.base);
    check(`${L}: links to the product`, url.pathname === product.url, href);
    // A tier sold as another product's variant (Ode's discovery set) can't be a ?variant=.
    const tierData = product.metafields.blueprint?.tiers?.value?.[tier - 1];
    const fixed = tierData?.variant?.value ?? null;
    const foreign = fixed && !product.variants.some((v) => v.id === fixed.id);
    const variant = product.variants.find((v) => String(v.id) === url.searchParams.get('variant'));
    if (foreign) check(`${L}: tier from another product leaves variant and selling_plan out`, !url.searchParams.has('variant') && !url.searchParams.has('selling_plan'), href);
    else check(`${L}: variant is one of the product's`, variant, href);
    check(`${L}: carries tier=${tier}`, url.searchParams.get('tier') === String(tier), href);
    if (plan === 'default') check(`${L}: no plan or selling_plan`, !url.searchParams.has('plan') && !url.searchParams.has('selling_plan'), href);
    else check(`${L}: carries plan=${plan}`, url.searchParams.get('plan') === plan, href);
    if (plan === 'sub' && !foreign) {
      const allocation = variant?.selling_plan_allocations.find((a) => String(a.selling_plan.id) === url.searchParams.get('selling_plan'));
      check(`${L}: selling_plan is one of the variant's plans`, allocation, href);
    }
    if (plan === 'once') check(`${L}: no selling_plan`, !url.searchParams.has('selling_plan'), href);
    if (!hasTiers) continue;
    const posts = foreign ? fixed : variant;

    for (const js of [false, true]) {
      const M = `${L} ${js ? 'with' : 'without'} JS`;
      server.resetCart();
      const { context, page, errors } = await open(url.pathname + url.search, { js, scroll: false });
      if (js) await page.waitForTimeout(400);
      const state = await pdpState(page);
      await page.click('main [data-bp-atc]');
      await page.waitForTimeout(500);
      const item = server.requests.flatMap((r) => r.items)[0];
      if (foreign && !js) {
        // Shopify can't read ?tier=, so the page opens on its default tier and posts that.
        const preselected = String((product.metafields.blueprint.tiers.value.findIndex((t) => t.preselected?.value ?? t.preselected) + 1) || 1);
        check(`${M}: opens on the default tier ${preselected}`, state.tier === preselected, state);
        check(`${M}: posts a variant`, item?.id, item);
        await context.close();
        continue;
      }
      check(`${M}: tier ${tier} is preselected`, state.tier === String(tier), state);
      if (plan !== 'default' && hasPlans) check(`${M}: ${plan} is preselected`, state.plan === plan, state);
      check(`${M}: posts the linked variant`, item && String(item.id) === String(posts?.id), item);
      if (plan === 'sub') check(`${M}: posts the linked selling plan`, item && String(item.selling_plan) === url.searchParams.get('selling_plan'), item);
      if (plan === 'once') check(`${M}: posts no selling plan`, item && !item.selling_plan, item);
      check(`${M}: no console errors`, errors.length === 0, errors);
      await context.close();
    }
  }
}

// Campaign parameters carry over on click; the deep link's own parameters stay.
for (const preset of PRESETS) {
  const L = `${preset} advertorial CTA click`;
  const { context, page } = await open(`/pages/advertorial?preset=${preset}&utm_source=meta&utm_campaign=spring&fbclid=abc123&gclid=g1&ref=other`, { scroll: false });
  const cta = page.locator('main a[data-bp-cta]').first();
  const before = new URL(await cta.getAttribute('href'), server.base);
  await Promise.all([page.waitForURL(/\/products\//), cta.click()]);
  const after = new URL(page.url());
  check(`${L}: utm_source and utm_campaign carried`, after.searchParams.get('utm_source') === 'meta' && after.searchParams.get('utm_campaign') === 'spring', after.search);
  check(`${L}: fbclid and gclid carried`, after.searchParams.get('fbclid') === 'abc123' && after.searchParams.get('gclid') === 'g1', after.search);
  check(`${L}: other parameters not carried`, !after.searchParams.has('ref') && !after.searchParams.has('preset'), after.search);
  check(`${L}: deep link kept`, [...before.searchParams].every(([k, v]) => after.searchParams.get(k) === v), { before: before.search, after: after.search });
  await page.waitForTimeout(400);
  const state = await pdpState(page);
  if (before.searchParams.has('tier')) check(`${L}: product page opens on tier ${before.searchParams.get('tier')}`, state.tier === before.searchParams.get('tier'), state);
  await context.close();
}

// ---------- Offer section ----------
for (const preset of PRESETS) {
  for (const js of [true, false]) {
    const L = `${preset} advertorial offer ${js ? 'with' : 'without'} JS`;
    server.resetCart();
    const { context, page, errors } = await open(`/pages/advertorial?preset=${preset}`, { js, scroll: false });
    const offer = page.locator('[data-bp-offer]');
    await offer.scrollIntoViewIfNeeded();
    if (js) await page.waitForTimeout(500);
    const tier = await offer.evaluate((el) => el.querySelector('[data-bp-tier-input]:checked')?.dataset.bpTierInput ?? null);
    const expected = String(listingTemplate(preset, 'page.advertorial').sections.offer.settings.default_tier);
    check(`${L}: starts on its default tier (${expected})`, tier === expected, tier);
    check(`${L}: has id Offer for the sticky CTA`, (await page.locator('#Offer').count()) === 1);
    await offer.locator('[data-bp-atc]').click();
    if (js) {
      await page.waitForSelector('dialog.bp-cart-drawer[open]', { timeout: 3000 }).catch(() => {});
      check(`${L}: cart drawer opens`, await page.locator('dialog.bp-cart-drawer[open]').count());
    } else {
      await page.waitForURL(/\/cart$/);
      check(`${L}: lands on the cart page`, new URL(page.url()).pathname === '/cart', page.url());
    }
    const item = server.requests.flatMap((r) => r.items)[0];
    const product = PRESET_PRODUCTS[preset];
    // The starting tier's variant: the product's own, or a set the tier sells (Ode's discovery set).
    const tierData = product.metafields.blueprint?.tiers?.value?.[Number(expected) - 1];
    const packValue = tierData?.pack_value?.value ?? tierData?.pack_value;
    const packVariant = packValue && product.variants.find((v) => v.options.includes(packValue) && v.options.every((o, i) => o === packValue || o === product.variants[0].options[i]));
    const allowed = [tierData?.variant?.value?.id ?? packVariant?.id].filter(Boolean);
    check(`${L}: posts the starting tier's variant`, item && allowed.some((id) => String(id) === String(item.id)), { item, allowed });
    check(`${L}: no console errors`, errors.length === 0, errors);
    await context.close();
  }
}

// ---------- Sticky CTA ----------
for (const preset of PRESETS) {
  for (const width of [390, 1440]) {
    const L = `${preset} sticky CTA @${width}`;
    const { context, page } = await open(`/pages/listicle?preset=${preset}`, { width, scroll: false });
    await page.waitForFunction(() => document.querySelector('bp-sticky-cta')?.classList.contains('is-enhanced'), null, { timeout: 5000 }).catch(() => {});
    const state = () =>
      page.evaluate(() => {
        const bar = document.querySelector('bp-sticky-cta');
        const rect = bar.getBoundingClientRect();
        return { visible: bar.hasAttribute('data-visible'), inert: bar.inert, position: getComputedStyle(bar).position, onScreen: rect.top < innerHeight && rect.bottom > 0 && getComputedStyle(bar).visibility !== 'hidden' };
      });
    const top = await state();
    check(`${L}: hidden and inert at the top`, !top.visible && top.inert && !top.onScreen, top);
    // Past show_after (20%) but before the offer.
    await page.evaluate(() => {
      const offer = document.querySelector('[data-bp-offer]');
      const max = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo(0, Math.min(offer.offsetTop - innerHeight - 50, max * 0.5));
    });
    await page.waitForTimeout(400);
    const middle = await state();
    check(`${L}: shows after scrolling`, middle.visible && !middle.inert && middle.onScreen && middle.position === 'fixed', middle);
    await page.locator('[data-bp-offer]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const over = await state();
    check(`${L}: hides over the offer`, !over.visible && over.inert, over);
    await context.close();
  }
  const { context, page } = await open(`/pages/listicle?preset=${preset}`, { js: false, scroll: false });
  const noJs = await page.evaluate(() => {
    const bar = document.querySelector('bp-sticky-cta');
    return { position: getComputedStyle(bar).position, href: bar.querySelector('a')?.getAttribute('href'), last: !bar.closest('.shopify-section').nextElementSibling };
  });
  check(`${preset} sticky CTA without JS: in the page flow, links to #Offer`, noJs.position !== 'fixed' && noJs.href === '#Offer', noJs);
  await context.close();
}

// ---------- Collection page ----------
for (const preset of PRESETS) {
  const base = `/collections/all?preset=${preset}`;
  // With JS: filtering and sorting swap the results in place.
  {
    const L = `${preset} collection with JS`;
    const { context, page, errors } = await open(base, { scroll: false });
    await page.waitForFunction(() => customElements.get('bp-facets'), null, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => (window.__noReload = true));
    const count = () => page.locator('.bp-product-grid > li').count();
    const all = await count();
    check(`${L}: shows products`, all > 1, all);
    const pills = await page.locator('.bp-pill-link').allInnerTexts();
    check(`${L}: pills (All plus types)`, pills.length >= 2 && /all/i.test(pills[0]), pills);
    const type = pills[1]?.trim();
    await page.locator('.bp-pill-link', { hasText: type }).first().click();
    await page.waitForFunction((n) => document.querySelectorAll('.bp-product-grid > li').length !== n || location.search.includes('product_type'), all, { timeout: 3000 }).catch(() => {});
    const filtered = await count();
    const url = new URL(page.url());
    check(`${L}: pill filters by type without a reload`, url.searchParams.get('filter.p.product_type') === type && (await page.evaluate(() => window.__noReload)) === true, url.search);
    check(`${L}: pill result count drops`, filtered < all && filtered > 0, { all, filtered });
    check(`${L}: pill marked current`, (await page.locator('.bp-pill-link[aria-current="page"]').innerText()).trim() === type);
    check(`${L}: active filter chip`, (await page.locator('.bp-chip').count()) === 1);
    check(`${L}: count announced`, (await page.locator('.bp-facets__count[role="status"]').innerText()).includes(String(filtered)));
    // Back restores everything.
    await page.goBack();
    await page.waitForFunction((n) => document.querySelectorAll('.bp-product-grid > li').length === n, all, { timeout: 3000 }).catch(() => {});
    check(`${L}: back restores all products`, (await count()) === all && !page.url().includes('product_type'), page.url());
    // Sorting.
    await page.selectOption('select[name="sort_by"]', 'price-ascending');
    await page.waitForFunction(() => location.search.includes('price-ascending'), null, { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(200);
    const prices = await page.locator('.bp-product-grid > li .bp-price').evaluateAll((els) => els.map((e) => Number(e.textContent.replace(/[^\d.]/g, ''))));
    check(`${L}: sorts by price, low to high`, prices.length === all && prices.every((p, i) => i === 0 || p >= prices[i - 1]), prices);
    check(`${L}: sort still without a reload`, (await page.evaluate(() => window.__noReload)) === true);
    // A filter checkbox in the panel.
    const panel = page.locator('[data-bp-facets-panel]');
    check(`${L}: filter panel starts closed`, !(await panel.evaluate((el) => el.open)));
    await panel.locator('summary').click();
    await page.locator('input[name="filter.v.availability"][value="1"]').check();
    await page.waitForFunction(() => location.search.includes('availability'), null, { timeout: 3000 }).catch(() => {});
    check(`${L}: checkbox filter applies`, page.url().includes('filter.v.availability=1') && page.url().includes('sort_by=price-ascending'), page.url());
    check(`${L}: panel stays open after filtering`, await page.locator('[data-bp-facets-panel]').evaluate((el) => el.open));
    // Empty state.
    await page.fill('input[name="filter.v.price.gte"]', '9999');
    await page.locator('[data-bp-facets-apply]').click();
    await page.waitForSelector('.bp-facets__empty', { timeout: 3000 }).catch(() => {});
    check(`${L}: empty state with a way out`, (await page.locator('.bp-facets__empty a').count()) === 1, page.url());
    check(`${L}: no console errors`, errors.length === 0, errors);
    const violations = await axe(page);
    check(`${L}: axe finds no violations after filtering`, violations.length === 0, violations);
    await context.close();
  }
  // Without JS: links and the GET form.
  {
    const L = `${preset} collection without JS`;
    const { context, page } = await open(base, { js: false, width: 390 });
    const all = await page.locator('.bp-product-grid > li').count();
    const type = (await page.locator('.bp-pill-link').nth(1).innerText()).trim();
    await Promise.all([page.waitForNavigation(), page.locator('.bp-pill-link', { hasText: type }).first().click()]);
    const filtered = await page.locator('.bp-product-grid > li').count();
    check(`${L}: pill link filters`, page.url().includes('filter.p.product_type') && filtered < all, { url: page.url(), all, filtered });
    await Promise.all([page.waitForNavigation(), page.locator('.bp-chip').first().click()]);
    check(`${L}: chip removes the filter`, !page.url().includes('product_type') && (await page.locator('.bp-product-grid > li').count()) === all, page.url());
    await page.locator('[data-bp-facets-panel] summary').click();
    await page.locator('input[name="filter.v.availability"][value="1"]').check();
    await page.selectOption('select[name="sort_by"]', 'price-descending');
    await Promise.all([page.waitForNavigation(), page.locator('[data-bp-facets-apply]').click()]);
    const url = new URL(page.url());
    check(`${L}: form applies filters and sort`, url.searchParams.get('filter.v.availability') === '1' && url.searchParams.get('sort_by') === 'price-descending', url.search);
    check(`${L}: sort select keeps its value`, (await page.locator('select[name="sort_by"]').inputValue()) === 'price-descending');
    await context.close();
  }
}

server.close();
await browser.close();

const failed = results.filter((r) => !r.ok);
for (const r of verbose ? results : failed) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.ok ? '' : ` — ${r.detail}`}`);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
