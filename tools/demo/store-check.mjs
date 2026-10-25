#!/usr/bin/env node
// Store checklist: the demo theme on a real dev store, where Shopify renders the Liquid, prices
// the cart and applies the automatic discounts. The offline checklists (tools/preview) can't
// check those.
//
//   node tools/demo/store-check.mjs <store…> [--theme=<id>] [--verbose]
//
// - Theme: the unpublished "Blueprint demo" theme (found through the Admin API), or --theme.
// - Storefront password: BLUEPRINT_STORE_PASSWORD_<STORE>, or BLUEPRINT_STORE_PASSWORD.
// - Admin credentials: as for the seed (BLUEPRINT_SEED_CLIENT_ID / _SECRET).
//
// Checks, per store:
// - every template answers 200 with no console errors and no failed theme requests;
// - the pre-landers are noindex;
// - each offer tier (one-time) and the subscription, added with JavaScript: the drawer opens,
//   and the cart holds that variant, quantity and selling plan, plus the tier's gift;
// - the drawer's total is Shopify's total_price;
// - every gift the theme adds is free, through the store's automatic discounts;
// - a deep link (?variant=…&selling_plan=…&tier=…&plan=sub) posts that variant and plan;
// - without JavaScript, the buy form adds to cart and lands on the cart page.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { adminClient, clientCredentialsToken } from './admin.mjs';

if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const result = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' } });
  process.exit(result.status ?? 1);
}
const { chromium } = await import(new URL('../preview/node_modules/playwright-core/index.mjs', import.meta.url));

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const stores = args.filter((a) => !a.startsWith('--'));
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const verbose = args.includes('--verbose');
if (!stores.length) {
  console.error('Usage: node tools/demo/store-check.mjs <store…> [--theme=<id>] [--verbose]');
  process.exit(2);
}

const toml = readFileSync(`${root}/shopify.theme.toml`, 'utf8');
const domainOf = (id) => new RegExp(`\\[environments\\.${id}\\][^\\[]*?store\\s*=\\s*"([^"]+)"`).exec(toml)?.[1];
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', proxy });
const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const text = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
let failures = 0;

async function themeId(shop) {
  if (option('theme')) return option('theme');
  const gql = adminClient({ shop, token: await clientCredentialsToken(shop, process.env.BLUEPRINT_SEED_CLIENT_ID, process.env.BLUEPRINT_SEED_CLIENT_SECRET) });
  const { themes } = await gql('{ themes(first: 20, names: ["Blueprint demo"]) { nodes { id } } }');
  return themes.nodes[0]?.id.split('/').pop();
}

for (const storeId of stores) {
  const shop = domainOf(storeId);
  const base = `https://${shop}`;
  const theme = await themeId(shop);
  const password = process.env[`BLUEPRINT_STORE_PASSWORD_${storeId.toUpperCase()}`] ?? process.env.BLUEPRINT_STORE_PASSWORD;
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  const url = (path, params = {}) => {
    const u = new URL(path, base);
    u.searchParams.set('preview_theme_id', theme);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u.toString();
  };

  async function context(javaScriptEnabled = true) {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, javaScriptEnabled });
    if (password) {
      const page = await ctx.newPage();
      await page.goto(`${base}/password`);
      if (await page.locator('input[type="password"]').count()) {
        await page.fill('input[type="password"]', password);
        await Promise.all([page.waitForNavigation(), page.press('input[type="password"]', 'Enter')]);
      }
      await page.close();
    }
    return ctx;
  }
  async function open(ctx, path, params) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    page.on('response', (r) => r.status() >= 400 && /\/cdn\/shop\/t\/|\/assets\//.test(r.url()) && errors.push(`${r.status()} ${r.url().slice(0, 160)}`));
    const response = await page.goto(url(path, params), { waitUntil: 'networkidle' });
    return { page, errors, status: response.status() };
  }
  const cartJs = (page) => page.evaluate(async () => (await fetch(`${window.Shopify.routes.root}cart.js`)).json());
  const clear = (page) => page.evaluate(async () => fetch(`${window.Shopify.routes.root}cart/clear.js`, { method: 'POST' }));

  const ctx = await context();

  // Pages.
  const probe = await open(ctx, '/');
  const pages = await probe.page.evaluate(async () => {
    const links = [...document.querySelectorAll('a[href*="/products/"]')].map((a) => new URL(a.href).pathname);
    return { product: links.find((p) => /^\/products\/[^/]+$/.test(p)) };
  });
  await probe.page.close();
  const paths = { home: '/', product: pages.product, collection: '/collections/all', advertorial: '/pages/advertorial', listicle: '/pages/listicle', comparison: '/pages/comparison', about: '/pages/about', cart: '/cart', search: '/search?q=a', missing: '/pages/does-not-exist' };
  for (const [name, path] of Object.entries(paths)) {
    if (!path) {
      check(`${name}: found a link to it on the home page`, false);
      continue;
    }
    const { page, errors, status } = await open(ctx, path);
    check(`${name}: ${status === 200 || (name === 'missing' && status === 404) ? 'answers' : 'fails'} (${status})`, name === 'missing' ? status === 404 : status === 200);
    // The 404 page logs its own status as a failed load; that one is expected.
    const real = name === 'missing' ? errors.filter((e) => !/status of 404/.test(e)) : errors;
    check(`${name}: no console errors or failed theme requests`, real.length === 0, real);
    check(`${name}: uses the Blueprint demo theme`, String(await page.evaluate(() => window.Shopify?.theme?.id)) === String(theme));
    if (['advertorial', 'listicle', 'comparison'].includes(name)) {
      const robots = await page.locator('meta[name="robots"]').getAttribute('content').catch(() => null);
      check(`${name}: noindex`, /noindex/.test(robots ?? ''), robots);
    }
    await page.close();
  }

  // Buying, with JavaScript.
  const { page } = await open(ctx, pages.product);
  const tiers = await page.$$eval('[data-bp-tier-input]', (inputs) => inputs.map((i) => ({ index: i.dataset.bpTierInput, variant: i.value, quantity: Number(i.dataset.quantity), gift: i.dataset.giftId ?? null, planId: i.dataset.planId || null, disabled: i.disabled })));
  check('product: offer tiers render', tiers.length > 0, tiers);
  const cases = [...tiers.filter((t) => !t.disabled).map((t) => ({ ...t, plan: 'once' })), ...tiers.filter((t) => !t.disabled && t.planId).slice(0, 1).map((t) => ({ ...t, plan: 'sub' }))];
  for (const c of cases) {
    const label = `tier ${c.index} ${c.plan === 'sub' ? 'subscribe' : 'one-time'}`;
    await clear(page);
    await page.goto(url(pages.product), { waitUntil: 'networkidle' });
    // The radios are visually hidden; shoppers click their labels.
    await page.locator(`label:has([data-bp-tier-input="${c.index}"])`).click();
    const planLabel = page.locator(`label:has([data-bp-plan="${c.plan}"])`);
    if (await planLabel.count()) await planLabel.first().click();
    check(`${label}: selected`, await page.locator(`[data-bp-tier-input="${c.index}"]`).isChecked());
    await page.locator('[data-bp-atc]').first().click();
    const opened = await page.locator('dialog#CartDrawer[open]').waitFor({ timeout: 10000 }).then(() => true, () => false);
    await page.waitForTimeout(1500);
    check(`${label}: the drawer opens`, opened);
    const cart = await cartJs(page);
    const line = cart.items.find((i) => String(i.variant_id) === c.variant && !i.properties?._bp_gift);
    check(`${label}: the cart holds the tier's variant`, line, cart.items.map((i) => [i.variant_id, i.quantity]));
    if (c.plan === 'sub') check(`${label}: with its selling plan`, line?.selling_plan_allocation, line?.selling_plan_allocation?.selling_plan?.name ?? 'none');
    else check(`${label}: without a selling plan`, line && !line.selling_plan_allocation);
    if (c.gift) {
      const gift = cart.items.find((i) => i.properties?._bp_gift === 'tier');
      check(`${label}: the tier's gift is added`, gift && String(gift.variant_id) === c.gift, cart.items.map((i) => [i.variant_id, i.properties]));
    }
    for (const gift of cart.items.filter((i) => i.properties?._bp_gift)) {
      const lines = cart.items.map((i) => ({ product: i.product_title, qty: i.quantity, price: i.final_line_price, gift: i.properties?._bp_gift ?? null, discounts: i.line_level_discount_allocations?.map((d) => `${d.discount_application?.title} −${d.amount}`) }));
      check(`${label}: gift "${gift.product_title}" is free (automatic discount)`, gift.final_line_price === 0, { lines, applied: cart.cart_level_discount_applications?.map((d) => d.title) });
    }
    const shownTotal = await page.locator('#CartDrawer .bp-cart-totals__total dd').textContent().catch(() => '');
    check(`${label}: the drawer total is Shopify's total_price (${money(cart.total_price)})`, text(shownTotal) === money(cart.total_price), [text(shownTotal), cart.total_price]);
  }

  // Deep link: subscribe to the first tier with a plan.
  const subTier = tiers.find((t) => t.planId);
  if (subTier) {
    await clear(page);
    await page.goto(url(pages.product, { variant: subTier.variant, selling_plan: subTier.planId, tier: subTier.index, plan: 'sub' }), { waitUntil: 'networkidle' });
    await page.locator('[data-bp-atc]').first().click();
    await page.locator('dialog#CartDrawer[open]').waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const cart = await cartJs(page);
    const line = cart.items.find((i) => String(i.variant_id) === subTier.variant);
    check(`deep link (tier ${subTier.index}, subscribe): posts that variant and plan`, line && String(line.selling_plan_allocation?.selling_plan?.id) === subTier.planId, cart.items.map((i) => [i.variant_id, i.selling_plan_allocation?.selling_plan?.id]));
  }
  await clear(page);
  await page.close();
  await ctx.close();

  // Buying without JavaScript.
  const noJs = await context(false);
  const plain = await noJs.newPage();
  await plain.goto(url(pages.product), { waitUntil: 'load' });
  const posted = await plain.$eval('form[action*="/cart/add"] [name="id"], [data-bp-tier-input]:checked', (el) => el.value).catch(() => null);
  await Promise.all([plain.waitForNavigation({ timeout: 15000 }).catch(() => {}), plain.locator('[data-bp-atc]').first().click()]);
  const landed = new URL(plain.url()).pathname;
  const noJsCart = await (await plain.request.get(`${base}/cart.js`)).json();
  check('without JavaScript: the form posts and lands on the cart page', landed.endsWith('/cart'), landed);
  check('without JavaScript: the cart holds the selected variant', noJsCart.items.some((i) => String(i.variant_id) === posted), [posted, noJsCart.items.map((i) => i.variant_id)]);
  await plain.request.post(`${base}/cart/clear.js`);
  await noJs.close();

  const failed = results.filter((r) => !r.ok);
  failures += failed.length;
  console.log(`\n${storeId} (${shop}, theme ${theme}): ${results.length - failed.length}/${results.length} passed`);
  for (const r of verbose ? results : failed) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.ok || !r.detail ? '' : `\n      ${r.detail.slice(0, 400)}`}`);
}
await browser.close();
process.exit(failures ? 1 : 0);
