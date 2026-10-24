#!/usr/bin/env node
// Cart checklist (docs/PLAN.md §8 and the Phase 3 acceptance criteria), run against the
// offline preview in Chromium, for every demo product, with JavaScript on and off.
//
// Every figure the cart shows is compared with the mock cart's own fields (which follow
// Shopify's), and every interaction is checked for full reloads and request counts.
//
//   node cart-checklist.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { PRESET_PRODUCTS, PROTECTION, cartFixtures } from './render.mjs';
import { startServer } from './server.mjs';

const server = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const axeSource = readFileSync(new URL('./node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const results = [];
const verbose = process.argv.includes('--verbose');
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const text = (s) => (s || '').replace(/\s+/g, ' ').trim();
const serverCart = () => server.cart.json(server.session.preset);
const merchLines = (cart) => cart.items.filter((i) => !i.properties._bp_gift && i.id !== PROTECTION.variants[0].id);
const basisOf = (cart) => merchLines(cart).reduce((sum, i) => sum + i.final_line_price, 0);
const settle = (page, ms = 900) => page.waitForTimeout(ms);
const mutations = () => server.requests.filter((r) => /^\/cart\/(add|change|update)/.test(r.path));

async function open(context, path) {
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${server.base}${path}`, { waitUntil: 'networkidle' });
  let navigations = 0;
  page.on('framenavigated', (frame) => frame === page.mainFrame() && (navigations += 1));
  return { page, errors, navigations: () => navigations };
}

// What the drawer (or cart page) shows, against the server's cart.
async function checkFigures(label, page, scope) {
  const cart = serverCart();
  const region = page.locator(`${scope} [data-bp-cart-region]`);
  const shown = await region.evaluate((el) => ({
    subtotal: el.querySelector('.bp-cart-totals__row dd')?.textContent,
    total: el.querySelector('.bp-cart-totals__total dd')?.textContent,
    checkout: el.querySelector('[name="checkout"]')?.textContent,
    lines: [...el.querySelectorAll('[data-bp-line]')].map((li) => ({ key: li.dataset.bpLine, price: li.querySelector('.bp-cart-line__price > span:last-child')?.textContent, qty: li.querySelector('[data-bp-qty]')?.textContent })),
  }));
  check(`${label}: subtotal is Shopify's items_subtotal_price`, text(shown.subtotal) === money(cart.items_subtotal_price), [shown.subtotal, cart.items_subtotal_price]);
  check(`${label}: total is Shopify's total_price`, text(shown.total) === money(cart.total_price) && text(shown.checkout).includes(money(cart.total_price)), [shown.total, shown.checkout, cart.total_price]);
  const protectionKey = cart.items.find((i) => i.id === PROTECTION.variants[0].id)?.key;
  const expected = cart.items.filter((i) => i.key !== protectionKey);
  const linesOk = expected.length === shown.lines.length && expected.every((i) => shown.lines.some((l) => l.key === i.key && text(l.price) === money(i.final_line_price)));
  check(`${label}: every line shows its final_line_price`, linesOk, { shown: shown.lines, expected: expected.map((i) => [i.key, i.final_line_price]) });
  const sum = expected.reduce((s, i) => s + i.final_line_price, 0) + (protectionKey ? cart.items.find((i) => i.key === protectionKey).final_line_price : 0);
  check(`${label}: lines add up to the subtotal`, sum === cart.items_subtotal_price, [sum, cart.items_subtotal_price]);
}

// Reward gifts in the cart match the thresholds reached (JS keeps them in step).
function checkRewardGifts(label, preset, declined = []) {
  const cart = serverCart();
  const basis = basisOf(cart);
  cartFixtures(preset).rewards.forEach((reward, i) => {
    if (!reward.gift) return;
    const has = cart.items.some((l) => l.properties._bp_gift === 'reward' && l.properties._bp_reward === String(i + 1));
    const earned = basis >= reward.threshold * 100 && !declined.includes(i + 1);
    check(`${label}: reward ${i + 1} gift ${earned ? 'in' : 'not in'} the cart at ${money(basis)}`, has === earned, { basis, threshold: reward.threshold, has });
  });
}

async function axe(page, selector, label) {
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async (sel) => {
    const r = await window.axe.run(sel, { resultTypes: ['violations'] });
    return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target}`);
  }, selector);
  check(`${label}: axe finds no violations`, result.length === 0, result);
}

for (const [preset, product] of Object.entries(PRESET_PRODUCTS)) {
  const fixtures = cartFixtures(preset);
  const handle = product.handle;

  // ---------- With JavaScript: the drawer ----------
  {
    server.resetCart();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const { page, errors, navigations } = await open(context, `/products/${handle}`);
    const L = `${handle} · drawer`;

    await page.click('label[for="Tier-bundle-2"]');
    const atc = page.locator('[data-bp-atc]');
    await atc.click();
    const opened = await page.waitForSelector('#CartDrawer[open]', { timeout: 5000 }).catch(() => null);
    await settle(page);
    check(`${L}: add to cart opens the drawer`, opened);
    check(`${L}: no page reload`, navigations() === 0, navigations());
    let cart = serverCart();
    check(`${L}: heading counts the cart`, text(await page.textContent('#CartDrawer-Heading')) === `Your cart (${cart.item_count})`, await page.textContent('#CartDrawer-Heading'));
    check(`${L}: header count updated`, text(await page.locator('[data-bp-cart-count]').first().textContent()) === String(cart.item_count), cart.item_count);
    check(`${L}: header link label updated`, text(await page.locator('[data-bp-cart-label]').first().textContent()).endsWith(`${cart.item_count} ${cart.item_count === 1 ? 'item' : 'items'}`), await page.locator('[data-bp-cart-label]').first().textContent());
    check(`${L}: focus moves into the dialog`, await page.evaluate(() => Boolean(document.activeElement?.closest('#CartDrawer'))));
    check(`${L}: background is inert (modal)`, await page.evaluate(() => document.querySelector('#CartDrawer').matches(':modal')));
    await checkFigures(L, page, '#CartDrawer');
    checkRewardGifts(L, preset);
    await axe(page, '#CartDrawer', L);

    // Rewards message: the next reward and the real amount to go.
    const basis = basisOf(cart);
    const next = fixtures.rewards.find((r) => r.threshold * 100 > basis);
    const message = text(await page.textContent('#CartDrawer .bp-rewards__message'));
    check(`${L}: rewards message`, next ? message === `You're ${money(next.threshold * 100 - basis)} away from ${next.label}` : message.startsWith("You've unlocked"), message);

    // Stepper: three quick presses become one request.
    const mainKey = merchLines(cart)[0].key;
    const plus = page.locator(`#CartDrawer [data-bp-line="${mainKey}"] [data-bp-step]:not([data-bp-step^="-"])`);
    const before = mutations().length;
    await plus.click();
    await plus.click();
    await plus.click();
    check(`${L}: stepper shows the new quantity at once`, text(await page.textContent(`#CartDrawer [data-bp-line="${mainKey}"] [data-bp-qty]`)) === '4');
    await settle(page, 1200);
    const sent = mutations().slice(before);
    const changes = sent.filter((r) => r.path === '/cart/change.js');
    check(`${L}: three presses send one change request`, changes.length === 1 && Number(changes[0].raw.quantity) === 4, sent.map((r) => [r.path, r.raw.quantity]));
    check(`${L}: at most one follow-up gift request`, sent.length - changes.length <= 1, sent.map((r) => r.path));
    check(`${L}: server has quantity 4`, serverCart().items.find((i) => i.key === mainKey)?.quantity === 4);
    check(`${L}: focus stays on the + button`, await page.evaluate(() => document.activeElement?.dataset.bpFocus?.startsWith('more-')), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
    await checkFigures(`${L} after +3`, page, '#CartDrawer');
    checkRewardGifts(`${L} after +3`, preset);

    // Back down: gifts above the new total leave.
    const minus = page.locator(`#CartDrawer [data-bp-line="${mainKey}"] [data-bp-step^="-"]`);
    for (let i = 0; i < 3; i += 1) await minus.click();
    await settle(page, 1200);
    await checkFigures(`${L} after −3`, page, '#CartDrawer');
    checkRewardGifts(`${L} after −3`, preset);

    // Removing a reward gift declines it: not re-added, and a claim button offers it back.
    cart = serverCart();
    const rewardLine = cart.items.find((i) => i.properties._bp_gift === 'reward');
    if (rewardLine) {
      const index = Number(rewardLine.properties._bp_reward);
      await page.locator(`#CartDrawer [data-bp-line="${rewardLine.key}"] .bp-cart-line__remove`).click();
      await settle(page);
      await plus.click();
      await settle(page, 1200);
      await minus.click();
      await settle(page, 1200);
      checkRewardGifts(`${L} after declining reward ${index}`, preset, [index]);
      const claim = page.locator('#CartDrawer .bp-cart-gift-claim button');
      check(`${L}: declined gift can be claimed back`, (await claim.count()) === 1, await claim.count());
      if (await claim.count()) {
        await claim.click();
        await settle(page);
        checkRewardGifts(`${L} after claiming`, preset);
      }
    }

    // Shipping protection: off by default, the switch adds and removes it, never re-added.
    const protectionId = PROTECTION.variants[0].id;
    const sw = page.locator('#CartDrawer .bp-switch');
    check(`${L}: protection off by default`, (await sw.getAttribute('aria-checked')) === 'false' && !serverCart().items.some((i) => i.id === protectionId));
    await sw.click();
    await settle(page);
    check(`${L}: switch adds protection`, serverCart().items.some((i) => i.id === protectionId) && (await page.locator('#CartDrawer .bp-switch').getAttribute('aria-checked')) === 'true');
    check(`${L}: focus stays on the switch`, await page.evaluate(() => document.activeElement?.dataset.bpFocus === 'protection'));
    await checkFigures(`${L} with protection`, page, '#CartDrawer');
    checkRewardGifts(`${L} with protection (not counted)`, preset);
    await page.locator('#CartDrawer .bp-switch').click();
    await settle(page);
    check(`${L}: switch removes protection`, !serverCart().items.some((i) => i.id === protectionId));

    // Upsell: one product, not already in the cart; adding it swaps in another.
    const upsellForm = page.locator('#CartDrawer [data-bp-upsell]');
    check(`${L}: exactly one upsell`, (await upsellForm.count()) === 1, await upsellForm.count());
    const upsellId = Number(await upsellForm.getAttribute('data-bp-upsell'));
    check(`${L}: upsell is the product's blueprint.upsell`, upsellId === product.metafields.blueprint.upsell.value.variants[0].id, upsellId);
    await upsellForm.locator('button').click();
    await settle(page);
    check(`${L}: upsell added`, serverCart().items.some((i) => i.id === upsellId));
    const nextUpsell = await page.locator('#CartDrawer [data-bp-upsell]').getAttribute('data-bp-upsell').catch(() => null);
    check(`${L}: upsell never offers what's in the cart`, !serverCart().items.some((i) => String(i.id) === nextUpsell), nextUpsell);
    await checkFigures(`${L} with upsell`, page, '#CartDrawer');

    // A failed request shows an alert and re-renders what the cart really holds.
    server.faults.next = { status: 422, message: 'Only 2 left' };
    await page.locator(`#CartDrawer [data-bp-line="${mainKey}"] [data-bp-step]:not([data-bp-step^="-"])`).click();
    await settle(page, 1200);
    const alert = page.locator('#CartDrawer [data-bp-cart-error]');
    check(`${L}: error shown in role=alert`, (await alert.isVisible()) && (await alert.getAttribute('role')) === 'alert', await alert.textContent());
    check(`${L}: cart re-rendered after the error`, text(await page.textContent(`#CartDrawer [data-bp-line="${mainKey}"] [data-bp-qty]`)) === String(serverCart().items.find((i) => i.key === mainKey).quantity));

    // Live region announces updates.
    check(`${L}: polite live region announced`, (await page.textContent('#CartDrawer [data-bp-cart-status]')).startsWith('Cart updated'), await page.textContent('#CartDrawer [data-bp-cart-status]'));

    // Escape closes and focus returns to the add-to-cart button that opened it.
    await page.keyboard.press('Escape');
    await settle(page, 300);
    check(`${L}: Escape closes`, !(await page.evaluate(() => document.querySelector('#CartDrawer').open)));
    check(`${L}: focus returns to the opener`, await page.evaluate(() => document.activeElement?.matches('[data-bp-atc]')), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 60)));

    // The header cart link opens it too, without a reload or layout shift.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => list.getEntries().forEach((e) => (window.__cls += e.value))).observe({ type: 'layout-shift' });
    });
    await page.click('[data-bp-cart-link]');
    await page.waitForSelector('#CartDrawer[open]', { timeout: 3000 }).catch(() => null);
    await settle(page, 500);
    check(`${L}: cart link opens the drawer`, await page.evaluate(() => document.querySelector('#CartDrawer').open));
    check(`${L}: opening causes no layout shift`, (await page.evaluate(() => window.__cls)) === 0, await page.evaluate(() => window.__cls));
    await page.click('#CartDrawer [data-bp-cart-close]');
    await settle(page, 300);
    check(`${L}: close button closes`, !(await page.evaluate(() => document.querySelector('#CartDrawer').open)));
    check(`${L}: focus returns to the cart link`, await page.evaluate(() => document.activeElement?.matches('[data-bp-cart-link]')));

    // Another script changes the cart (Standard Actions updateCart, an app): the drawer follows.
    server.cart.add([{ id: fixtures.collection.products[0].variants[0].id, quantity: 1 }]);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('bp:cart:changed', { detail: { source: 'standard-action' } })));
    await settle(page);
    await page.click('[data-bp-cart-link]');
    await settle(page, 500);
    await checkFigures(`${L} after an outside change`, page, '#CartDrawer');

    // Emptying the cart: gifts and protection go too, and best sellers show.
    for (let guard = 0; guard < 10; guard += 1) {
      const remove = page.locator('#CartDrawer .bp-cart-line__remove').first();
      if (!(await remove.count())) break;
      await remove.click();
      await settle(page);
    }
    check(`${L}: empty cart is empty on the server`, serverCart().item_count === 0, serverCart().items.map((i) => i.title));
    check(`${L}: empty state shows best sellers`, (await page.locator('#CartDrawer .bp-cart-empty__products li').count()) > 0);
    check(`${L}: header count cleared`, text(await page.locator('[data-bp-cart-count]').first().textContent()) === '');
    check(`${L}: whole run without a reload`, navigations() === 0, navigations());
    // (The 422 is the failure injected above; the browser logs every failed request.)
    const unexpected = errors.filter((e) => !/status of 422/.test(e));
    check(`${L}: no console errors`, unexpected.length === 0, unexpected);
    await context.close();
  }

  // ---------- With JavaScript: the cart page ----------
  {
    server.resetCart();
    server.cart.add([{ id: product.variants[0].id, quantity: 1 }]);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, errors, navigations } = await open(context, `/${preset}/product.html`);
    await page.goto(`${server.base}/cart`, { waitUntil: 'networkidle' });
    const L = `${handle} · cart page`;
    check(`${L}: no drawer on the cart page`, (await page.locator('bp-cart-drawer').count()) === 0);
    const key = serverCart().items[0].key;
    await page.locator(`[data-bp-line="${key}"] [data-bp-step]:not([data-bp-step^="-"])`).click();
    await settle(page, 1200);
    check(`${L}: stepper works in place`, serverCart().items.find((i) => i.key === key)?.quantity === 2 && navigations() === 1, navigations());
    await checkFigures(L, page, 'main');
    await axe(page, 'main', L);
    check(`${L}: no console errors`, errors.length === 0, errors);
    await context.close();
  }

  // ---------- Without JavaScript: the cart page does everything ----------
  {
    server.resetCart();
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const L = `${handle} · no JS`;
    await page.goto(`${server.base}/products/${handle}`);
    await page.click('label[for="Tier-bundle-3"]');
    await page.click('[data-bp-atc]');
    await page.waitForLoadState('load');
    check(`${L}: add lands on the cart page`, new URL(page.url()).pathname === '/cart', page.url());
    await checkFigures(L, page, 'main');

    // A tier gift isn't posted without JS: the cart offers it.
    const tier3 = product.metafields.blueprint.tiers.value[2];
    const claims = page.locator('main .bp-cart-gift-claim');
    if (tier3.gift_variant?.value) {
      const tierClaim = page.locator(`main .bp-cart-gift-claim:has(input[value="tier"])`);
      check(`${L}: tier gift claim offered`, (await tierClaim.count()) === 1, await tierClaim.count());
      if (await tierClaim.count()) {
        await tierClaim.locator('button').click();
        await page.waitForLoadState('load');
      }
      const gift = serverCart().items.find((i) => i.properties._bp_gift === 'tier');
      check(`${L}: tier gift claimed, linked to its bundle, free`, gift && gift.final_line_price === 0 && serverCart().items.some((i) => String(i.id) === gift.properties._bp_gift_for), gift);
    }
    // Earned reward gifts are offered too.
    const basis = basisOf(serverCart());
    const earned = fixtures.rewards.map((r, i) => ({ ...r, index: i + 1 })).filter((r) => r.gift && basis >= r.threshold * 100);
    for (const reward of earned) {
      const claim = page.locator(`main .bp-cart-gift-claim:has(input[name="properties[_bp_reward]"][value="${reward.index}"])`);
      check(`${L}: reward ${reward.index} gift offered`, (await claim.count()) === 1);
      if (!(await claim.count())) continue;
      await claim.locator('button').click();
      await page.waitForLoadState('load');
    }
    checkRewardGifts(`${L} after claiming`, preset);
    check(`${L}: nothing left to claim`, (await claims.count()) === 0, await claims.count());

    const key = merchLines(serverCart())[0].key;
    await page.locator(`[data-bp-line="${key}"] [data-bp-step]:not([data-bp-step^="-"])`).click();
    await page.waitForLoadState('load');
    check(`${L}: + works`, serverCart().items.find((i) => i.key === key)?.quantity === 2 && new URL(page.url()).pathname === '/cart');
    await page.locator('main .bp-switch').click();
    await page.waitForLoadState('load');
    check(`${L}: protection switch works`, serverCart().items.some((i) => i.id === PROTECTION.variants[0].id));
    await checkFigures(`${L} with everything`, page, 'main');
    await page.locator('main [data-bp-upsell] button').click();
    await page.waitForLoadState('load');
    check(`${L}: upsell add works`, serverCart().items.some((i) => i.id === product.metafields.blueprint.upsell.value.variants[0].id));
    const total = serverCart().total_price;
    await page.click('main [name="checkout"]');
    await page.waitForLoadState('load');
    check(`${L}: checkout carries the cart total`, new URL(page.url()).pathname === '/checkout' && Number(await page.textContent('#total')) === total, [page.url(), total]);
    await page.goto(`${server.base}/cart`);
    await page.locator(`[data-bp-line="${key}"] .bp-cart-line__remove`).click();
    await page.waitForLoadState('load');
    check(`${L}: remove works`, !serverCart().items.some((i) => i.key === key));
    await context.close();
  }
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
if (verbose) for (const r of results.filter((x) => x.ok)) console.log(`✓ ${r.name}`);
for (const r of failed) console.log(`✗ ${r.name}\n    ${r.detail.slice(0, 400)}`);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exitCode = failed.length ? 1 : 0;
