#!/usr/bin/env node
// Platform checklist: the Shopify behaviours the theme relies on but the offline preview can
// only imitate (docs/PLAN.md, "still to verify on a store"). Runs against a demo store's
// "Blueprint demo" theme; tools/demo/store-check.mjs covers the shopper flows.
//
//   node tools/demo/platform-check.mjs <store> [--verbose]
//
// Needs the storefront password (BLUEPRINT_STORE_PASSWORD_<STORE>) and the store's Theme Access
// password (SHOPIFY_CLI_THEME_TOKEN_<STORE>). For sections the demo pages don't use (featured
// product, an unset countdown, complementary recommendations) it writes a temporary page
// template into the demo theme, renders it with ?view=, and deletes it afterwards. That's
// refused on a live theme: use a store whose demo theme is unpublished.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const result = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' } });
  process.exit(result.status ?? 1);
}
const { chromium } = await import(new URL('../preview/node_modules/playwright-core/index.mjs', import.meta.url));
const axeSource = readFileSync(new URL('../preview/node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const storeId = args.find((a) => !a.startsWith('--'));
const verbose = args.includes('--verbose');
const toml = readFileSync(`${root}/shopify.theme.toml`, 'utf8');
const shop = new RegExp(`\\[environments\\.${storeId}\\][^\\[]*?store\\s*=\\s*"([^"]+)"`).exec(toml)?.[1];
const themePassword = process.env[`SHOPIFY_CLI_THEME_TOKEN_${String(storeId).toUpperCase()}`];
const storefrontPassword = process.env[`BLUEPRINT_STORE_PASSWORD_${String(storeId).toUpperCase()}`] ?? process.env.BLUEPRINT_STORE_PASSWORD;
if (!shop || !themePassword) {
  console.error('Usage: node tools/demo/platform-check.mjs <store>   (needs SHOPIFY_CLI_THEME_TOKEN_<STORE>)');
  process.exit(2);
}
const base = `https://${shop}`;
const TEMPLATE = 'page.bp-platform-check';

const ta = async (query, variables = {}) => {
  const response = await fetch('https://theme-kit-access.shopifyapps.com/cli/admin/api/2026-07/graphql.json', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Shopify-Shop': shop, 'X-Shopify-Access-Token': themePassword },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors).slice(0, 300));
  return body.data;
};

const results = [];
const check = (area, name, ok, detail = '') => results.push({ area, name, ok: ok === null ? null : Boolean(ok), detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', proxy });

const { themes } = await ta('{ themes(first: 20, names: ["Blueprint demo"]) { nodes { id role } } }');
const theme = themes.nodes[0];
const themeId = theme.id.split('/').pop();
const url = (path, params = {}) => {
  const u = new URL(path, base);
  u.searchParams.set('preview_theme_id', themeId);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
};
async function context(javaScriptEnabled = true) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, javaScriptEnabled, viewport: { width: 1280, height: 900 } });
  if (storefrontPassword) {
    const page = await ctx.newPage();
    await page.goto(`${base}/password`);
    if (await page.locator('input[type="password"]').count()) {
      await page.fill('input[type="password"]', storefrontPassword);
      await Promise.all([page.waitForNavigation(), page.press('input[type="password"]', 'Enter')]);
    }
    await page.close();
  }
  return ctx;
}
const cartJs = (page) => page.evaluate(async () => (await fetch(`${window.Shopify.routes.root}cart.js`)).json());
const clear = (page) => page.evaluate(async () => fetch(`${window.Shopify.routes.root}cart/clear.js`, { method: 'POST' }));
const settle = (page, ms = 1500) => page.waitForTimeout(ms);

const ctx = await context();
const page = await ctx.newPage();
let product;
let wroteTemplate = false;
try {
  // ---------- Fonts (Phase 1) ----------
  const fontResponses = [];
  page.on('response', (r) => /\/fonts\/|\.woff2?(\?|$)/.test(r.url()) && fontResponses.push(r.status()));
  await page.goto(url('/'), { waitUntil: 'networkidle' });
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    const first = (el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
    return { heading: first(document.querySelector('h1, h2')), body: first(document.body), loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')) };
  });
  check('Phase 1', `fonts: the heading and body font handles load (${fonts.heading}, ${fonts.body})`, fonts.loaded.includes(fonts.heading) && fonts.loaded.includes(fonts.body) && fontResponses.every((s) => s < 400), { ...fonts, statuses: [...new Set(fontResponses)] });
  product = await page.evaluate(() => [...document.querySelectorAll('a[href*="/products/"]')].map((a) => new URL(a.href).pathname).find((p) => /^\/products\/[^/]+$/.test(p)));

  // ---------- Standard Actions (Phase 1) ----------
  const actions = await page.evaluate(() => ({ openCart: typeof window.Shopify?.actions?.openCart, updateCart: typeof window.Shopify?.actions?.updateCart }));
  if (actions.openCart === 'undefined' && actions.updateCart === 'undefined') {
    check('Phase 1', 'Standard Actions: Shopify.actions isn\'t on this storefront (nothing to hook yet)', null, actions);
  } else {
    await page.evaluate(() => window.Shopify.actions.openCart?.());
    const opened = await page.locator('dialog#CartDrawer[open]').waitFor({ timeout: 8000 }).then(() => true, () => false);
    check('Phase 1', 'Standard Actions: Shopify.actions.openCart() opens the theme\'s drawer', opened, actions);
    await page.keyboard.press('Escape');
  }

  // ---------- Pages from a temporary template: featured product, unset countdown, complementary ----------
  const handle = product.split('/').pop();
  const blocks = ['product-title', 'product-price', 'product-offer-tiers', 'product-purchase-options', 'product-buy-buttons'];
  const template = {
    sections: {
      featured: { type: 'featured-product', settings: { product: handle }, blocks: Object.fromEntries(blocks.map((type) => [type, { type }])), block_order: blocks },
      countdown: { type: 'countdown', settings: { mode: 'fixed' } },
      recs: { type: 'related-products', settings: { intent: 'complementary', product: handle } },
    },
    order: ['featured', 'countdown', 'recs'],
  };
  if (theme.role === 'MAIN') {
    check('Phase 4', 'temporary template: skipped, the demo theme is live on this store', null);
  } else {
    const { themeFilesUpsert } = await ta('mutation($id: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) { themeFilesUpsert(themeId: $id, files: $files) { upsertedThemeFiles { filename } userErrors { message } } }', { id: theme.id, files: [{ filename: `templates/${TEMPLATE}.json`, body: { type: 'TEXT', value: JSON.stringify(template) } }] });
    wroteTemplate = themeFilesUpsert.userErrors.length === 0;
    check('Phase 4', 'temporary template accepted by Shopify', wroteTemplate, themeFilesUpsert.userErrors);
  }
  if (wroteTemplate) {
    // A template written seconds ago can take a moment to render: retry before judging it.
    for (let attempt = 0; attempt < 4; attempt++) {
      await page.goto(url('/pages/about', { view: 'bp-platform-check' }), { waitUntil: 'networkidle' });
      if (await page.locator('[id$="__featured"] [data-bp-tier-input]').count()) break;
      await settle(page, 5000);
    }
    const shown = await page.evaluate(() => {
      const section = (key) => document.querySelector(`[id^="shopify-section-"][id$="__${key}"]`);
      return {
        title: section('featured')?.querySelector('h1, h2, .bp-product-title')?.textContent.trim(),
        tiers: section('featured')?.querySelectorAll('[data-bp-tier-input]').length ?? 0,
        countdownText: section('countdown')?.innerText.trim() ?? null,
        recsId: section('recs')?.id.replace('shopify-section-', ''),
      };
    });
    const productJs = await page.evaluate(async (h) => (await fetch(`/products/${h}.js`)).json(), handle);
    check('Phase 4', `featured product: closest.product resolves to the section's product ("${shown.title}")`, shown.title && productJs.title && shown.title.includes(productJs.title), shown);
    check('Phase 4', 'featured product: the buy-box blocks render its tiers', shown.tiers > 0, shown);
    await clear(page);
    if (shown.tiers > 0) {
      const tierLabel = page.locator('[id$="__featured"] label:has([data-bp-tier-input])').last();
      await tierLabel.click();
      const wanted = await page.locator('[id$="__featured"] [data-bp-tier-input]').last().getAttribute('value');
      await page.locator('[id$="__featured"] [data-bp-atc]').click();
      await settle(page, 3000);
      check('Phase 4', 'featured product: adds the chosen tier to the cart', (await cartJs(page)).items.some((i) => String(i.variant_id) === wanted), wanted);
    }
    check('Phase 4', 'countdown with no end date renders nothing on the storefront', shown.countdownText === '' || shown.countdownText === null, shown.countdownText);
    const recs = await page.evaluate(async ({ id, pid }) => {
      const response = await fetch(`${window.Shopify.routes.root}recommendations/products?section_id=${id}&product_id=${pid}&limit=4&intent=complementary`);
      return { status: response.status, hasSection: (await response.text()).includes(`shopify-section-${id}`) };
    }, { id: shown.recsId, pid: productJs.id });
    check('Phase 4', 'product_recommendations_url returns the section with intent=complementary', recs.status === 200 && recs.hasSection, recs);
  }

  // ---------- Quick add (Phase 4) ----------
  await clear(page);
  await page.goto(url('/collections/all'), { waitUntil: 'networkidle' });
  const quick = page.locator('[data-bp-quick-add]').first();
  if (await quick.count()) {
    await quick.click();
    const sheet = await page.locator('dialog[open] [data-bp-atc]').first().waitFor({ timeout: 10000 }).then(() => true, () => false);
    check('Phase 4', 'quick add: static content_for \'block\' blocks render through the Section Rendering API', sheet);
    await page.keyboard.press('Escape');
  } else check('Phase 4', 'quick add: no quick-add button on the collection page', false);

  // ---------- Filters (Phase 5) ----------
  await page.goto(url('/collections/all'), { waitUntil: 'networkidle' });
  const grid = await page.evaluate(() => document.querySelector('[data-bp-facets-results]')?.closest('[id^="shopify-section-"]')?.id.replace('shopify-section-', ''));
  const filtered = await page.evaluate(async (id) => {
    const u = new URL(location.href);
    u.searchParams.set('filter.v.price.gte', '10');
    u.searchParams.set('section_id', id);
    const r = await fetch(u);
    const html = await r.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const chip = [...doc.querySelectorAll('.bp-chip')].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href') }));
    return { status: r.status, section: html.includes(`shopify-section-${id}`), chip };
  }, grid);
  const priceChip = filtered.chip.find((c) => /\$10/.test(c.text));
  check('Phase 5', 'filters: ?section_id= returns the grid section with the filter applied', filtered.status === 200 && filtered.section, filtered);
  check('Phase 5', 'filters: price_range shows an active chip whose url_to_remove drops the filter', priceChip && !priceChip.href.includes('price.gte'), filtered.chip);
  await page.goto(url('/collections/all', { 'filter.v.availability': '1' }), { waitUntil: 'networkidle' });
  const availability = await page.evaluate(() => [...document.querySelectorAll('.bp-chip')].map((a) => a.getAttribute('href')));
  check('Phase 5', 'filters: a list filter (availability) shows a chip that removes it', availability.length > 0 && availability.every((h) => !h.includes('availability=1')), availability);

  // ---------- Pre-lander layout (Phase 5) ----------
  await page.goto(url('/pages/advertorial'), { waitUntil: 'networkidle' });
  const landing = await page.evaluate(() => ({ header: Boolean(document.querySelector('header.bp-header')), mainNav: Boolean(document.querySelector('.bp-header__nav')), cartDrawer: Boolean(document.querySelector('#CartDrawer')) }));
  check('Phase 5', 'pre-landers use the landing layout: its own minimal header (no main navigation), with the cart drawer', landing.header && !landing.mainNav && landing.cartDrawer, landing);

  // ---------- Cart endpoints (Phase 3) ----------
  await clear(page);
  await page.goto(url(product), { waitUntil: 'networkidle' });
  const drawerId = await page.locator('bp-cart').first().getAttribute('data-section-id');
  const variantId = await page.locator('[data-bp-tier-input]').first().getAttribute('value');
  const added = await page.evaluate(async ({ id, sections }) => (await fetch(`${window.Shopify.routes.root}cart/add.js`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: Number(id), quantity: 1 }], sections }) })).json(), { id: variantId, sections: drawerId });
  check('Phase 3', `/cart/add.js returns sections for the static section ID (${drawerId})`, typeof added.sections?.[drawerId] === 'string' && added.sections[drawerId].length > 100);
  const key = added.items?.[0]?.key;
  const changed = await page.evaluate(async ({ id, sections }) => (await fetch(`${window.Shopify.routes.root}cart/change.js`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, quantity: 1, sections }) })).json(), { id: key, sections: drawerId });
  check('Phase 3', '/cart/change.js returns sections too', typeof changed.sections?.[drawerId] === 'string' && changed.sections[drawerId].length > 100);
  await page.goto(`${base}/cart/change?id=${encodeURIComponent(key)}&quantity=2`, { waitUntil: 'load' });
  const afterGet = await cartJs(page);
  check('Phase 3', '/cart/change with a GET line key and quantity 2 redirects to the cart and sets it', new URL(page.url()).pathname.endsWith('/cart') && afterGet.items.find((i) => i.key === key)?.quantity === 2, { landed: new URL(page.url()).pathname, quantity: afterGet.items.find((i) => i.key === key)?.quantity });

  // ---------- Tier gift with parent_id (Phases 2 and 3) ----------
  await clear(page);
  await page.goto(url(product), { waitUntil: 'networkidle' });
  const giftTier = await page.$$eval('[data-bp-tier-input]', (inputs) => inputs.find((i) => i.dataset.giftId)?.dataset.bpTierInput);
  if (giftTier) {
    await page.locator(`label:has([data-bp-tier-input="${giftTier}"])`).click();
    await page.locator('[data-bp-atc]').first().click();
    await settle(page, 3500);
    let cart = await cartJs(page);
    const gift = cart.items.find((i) => i.properties?._bp_gift === 'tier');
    check('Phase 2', '/cart/add.js accepts parent_id: the tier gift is a child of its bundle line', gift?.parent_relationship?.parent_key, gift ? { parent_relationship: gift.parent_relationship } : 'no gift line');
    const parent = cart.items.find((i) => !i.properties?._bp_gift && i.key === gift?.parent_relationship?.parent_key);
    if (parent) {
      await page.evaluate(async (k) => fetch(`${window.Shopify.routes.root}cart/change.js`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k, quantity: 0 }) }), parent.key);
      cart = await cartJs(page);
      check('Phase 3', 'removing the bundle removes its parent_id gift line', !cart.items.some((i) => i.properties?._bp_gift === 'tier'), cart.items.map((i) => i.product_title));
    }
  } else check('Phase 2', 'parent_id gift lines: this store has no tier with a gift', null);

  // ---------- Disabled blocks (Phase 2) ----------
  await page.goto(url(product), { waitUntil: 'networkidle' });
  const disabled = await page.evaluate(() => ({ award: document.querySelectorAll('.bp-award').length, moneyback: document.querySelectorAll('.bp-moneyback').length }));
  check('Phase 2', 'blocks set "disabled": true in product.json stay hidden (award, money-back)', disabled.award === 0 && disabled.moneyback === 0, disabled);

  // ---------- Dynamic checkout (Phase 2) ----------
  const subTier = await page.$$eval('[data-bp-tier-input]', (inputs) => inputs.filter((i) => i.dataset.planId).at(-1)?.dataset.bpTierInput);
  const buyNow = page.locator('.shopify-payment-button button, shopify-buy-it-now-button button, [data-shopify="payment-button"] button').first();
  if (subTier && (await buyNow.count())) {
    await page.locator(`label:has([data-bp-tier-input="${subTier}"])`).click();
    await page.locator('label:has([data-bp-plan="sub"])').first().click();
    const synced = await page.evaluate(() => ({ id: document.querySelector('[data-bp-sync="id"]')?.value, plan: document.querySelector('[data-bp-sync="selling_plan"]')?.value, disabled: document.querySelector('[data-bp-sync="id"]')?.disabled }));
    const wanted = { id: await page.locator(`[data-bp-tier-input="${subTier}"]`).getAttribute('value'), plan: await page.locator(`[data-bp-tier-input="${subTier}"]`).getAttribute('data-plan-id'), gift: await page.locator(`[data-bp-tier-input="${subTier}"]`).getAttribute('data-gift-id') };
    check('Phase 2', 'dynamic checkout: the synced id and selling_plan inputs hold the chosen tier and plan', synced.id === wanted.id && synced.plan === wanted.plan && !synced.disabled, { synced, wanted });
    const posted = [];
    page.on('request', (r) => r.method() === 'POST' && posted.push({ url: r.url().replace(base, ''), body: r.postDataBuffer()?.toString('utf8') ?? '' }));
    await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => {}), buyNow.click()]);
    await settle(page, 2000);
    // Shopify's button creates the checkout cart through the Storefront API (cartCreate).
    const create = posted.find((p) => p.url.includes('cartCreate'));
    let lines = [];
    try {
      lines = JSON.parse(create.body).variables.input.lines ?? [];
    } catch {}
    const line = lines.find((l) => String(l.merchandiseId).endsWith(`/${wanted.id}`));
    check('Phase 2', 'dynamic checkout: "Buy it now" sends that variant and its selling plan', line && String(line.sellingPlanId).endsWith(`/${wanted.plan}`), { landed: page.url().replace(base, '').slice(0, 60), wanted, lines: create ? lines : posted.map((p) => p.url.slice(0, 80)) });
    if (wanted.gift) {
      const gift = lines.find((l) => String(l.merchandiseId).endsWith(`/${wanted.gift}`));
      check('Phase 2', 'dynamic checkout: "Buy it now" nests the tier\'s free gift under it', gift && JSON.stringify(gift.parent ?? {}).includes(`/${wanted.id}`), gift ?? lines);
    }
  } else check('Phase 2', 'dynamic checkout: no "Buy it now" button or no subscription tier', null);

  // ---------- Accessibility (axe, WCAG 2.2 AA) ----------
  for (const path of ['/', product, '/collections/all', '/pages/advertorial', '/cart']) {
    await page.goto(url(path), { waitUntil: 'networkidle' });
    await page.addScriptTag({ content: axeSource });
    const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.filter((v) => ['serious', 'critical'].includes(v.impact) && !v.nodes.every((n) => /shopify-|PBarNextFrame/.test(n.target.join(' ')))).map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ')}`));
    check('Accessibility', `axe ${path}: no serious or critical WCAG 2.2 AA violations`, violations.length === 0, violations);
  }
} finally {
  await clear(page).catch(() => {});
  await ctx.close();
  // Without JavaScript: the plan preselected server-side, and the last id posted wins.
  try {
    const plain = await context(false);
    const p = await plain.newPage();
    await p.goto(url(product), { waitUntil: 'load' });
    const tiers = await p.$$eval('[data-bp-tier-input]', (inputs) => inputs.map((i) => ({ index: i.dataset.bpTierInput, id: i.value, plan: i.dataset.planId })));
    const sub = tiers.find((t) => t.plan);
    if (sub) {
      await p.goto(url(product, { variant: sub.id, selling_plan: sub.plan }), { waitUntil: 'load' });
      const state = await p.evaluate(() => ({ sub: document.querySelector('[data-bp-plan="sub"]')?.checked, tier: document.querySelector('[data-bp-tier-input]:checked')?.value }));
      check('Phase 5', 'without JavaScript, ?variant=&selling_plan= preselects the tier and the plan in the HTML', state.sub && state.tier === sub.id, state);
    }
    const last = tiers.at(-1);
    await p.goto(url(product), { waitUntil: 'load' });
    await p.locator(`label:has([data-bp-tier-input="${last.index}"])`).click();
    await Promise.all([p.waitForNavigation({ timeout: 15000 }).catch(() => {}), p.locator('[data-bp-atc]').first().click()]);
    const cart = await (await p.request.get(`${base}/cart.js`)).json();
    check('Phase 2', 'without JavaScript, the tier radio is the id that posts (the last id wins)', cart.items.some((i) => String(i.variant_id) === last.id), { wanted: last.id, got: cart.items.map((i) => i.variant_id) });
    await p.request.post(`${base}/cart/clear.js`);

    // The bundle builder posts items[n][id] checkboxes: Shopify must add every checked one.
    await p.goto(url(product), { waitUntil: 'load' });
    const bundle = p.locator('.bp-bundle__form').first();
    if (await bundle.count()) {
      await bundle.locator('.bp-bundle-item__input:not([disabled])').evaluateAll((inputs) => inputs.forEach((i) => (i.checked = true)));
      const ids = await bundle.locator('.bp-bundle-item__input:checked').evaluateAll((inputs) => inputs.map((i) => i.value));
      await Promise.all([p.waitForNavigation({ timeout: 15000 }).catch(() => {}), bundle.locator('[data-bp-submit]').click()]);
      const added = await (await p.request.get(`${base}/cart.js`)).json();
      check('Phase 4', `without JavaScript, /cart/add takes the bundle's items[n][id] form post (${ids.length} products)`, ids.length > 1 && ids.every((id) => added.items.some((i) => String(i.variant_id) === id)), { wanted: ids, got: added.items.map((i) => i.variant_id) });
      await p.request.post(`${base}/cart/clear.js`);
    } else check('Phase 4', 'items[n][id] form posts: no bundle builder on this product page', null);
    await plain.close();
  } catch (error) {
    check('Phase 2', 'without JavaScript: checks crashed', false, error.message);
  }
  if (wroteTemplate) await ta('mutation($id: ID!, $files: [String!]!) { themeFilesDelete(themeId: $id, files: $files) { deletedThemeFiles { filename } userErrors { message } } }', { id: theme.id, files: [`templates/${TEMPLATE}.json`] });
  await browser.close();
}

const failed = results.filter((r) => r.ok === false);
const skipped = results.filter((r) => r.ok === null);
console.log(`${storeId} (${shop}, theme ${themeId}): ${results.length - failed.length - skipped.length}/${results.length - skipped.length} passed${skipped.length ? `, ${skipped.length} not applicable` : ''}`);
for (const r of results) {
  if (!verbose && r.ok) continue;
  console.log(`  ${r.ok === null ? '–' : r.ok ? '✓' : '✗'} [${r.area}] ${r.name}${r.ok !== true && r.detail ? `\n      ${r.detail.slice(0, 500)}` : ''}`);
}
process.exit(failed.length ? 1 : 0);
