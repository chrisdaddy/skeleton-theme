#!/usr/bin/env node
// Buy box checklist (docs/PLAN.md §16), run against the offline preview in Chromium.
//
// For every product × tier × plan × JavaScript on/off it checks what the shopper sees
// against tools/lib/offer-math.mjs, and checks what the add-to-cart actually posts.
// Cart and checkout totals (§16 checks 10–11) need a real store; everything else runs here.
//
//   node checklist.mjs
import { chromium } from 'playwright-core';
import { formatMoney, offerFigures } from '../lib/offer-math.mjs';
import { PRESET_PRODUCTS } from './render.mjs';
import { productForRequest } from './mock-products.mjs';
import { startServer } from './server.mjs';

const server = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

// What a tier should show and post, computed from the mock data (not from the page).
function expectedTiers(product) {
  const view = productForRequest(product);
  const base = view.selected_or_first_available_variant;
  const packName = product.metafields.blueprint.pack_option?.value || 'Pack';
  const packIndex = product.options.indexOf(packName);
  const servings = product.metafields.blueprint.servings_per_unit?.value || 0;
  const days = product.metafields.blueprint.days_per_unit?.value || 30;
  const tiers = product.metafields.blueprint.tiers.value.map((tier) => {
    let variant = tier.variant?.value;
    if (!variant) {
      variant = product.variants.find((v) => v.options.every((o, i) => (i === packIndex ? o === tier.pack_value.value : o === base.options[i])));
    }
    const quantity = variant.metafields?.blueprint?.pack_quantity?.value || 1;
    const hint = tier.subscription_plan_hint?.value;
    const allocations = variant.selling_plan_allocations || [];
    const allocation = allocations.find((a) => hint && a.selling_plan.name.includes(hint)) || allocations[0] || null;
    return { tier, variant, quantity, allocation };
  });
  const single = tiers[0].variant.price / tiers[0].quantity;
  return tiers.map((t) => ({
    ...t,
    figures: (plan) => {
      const price = plan === 'sub' ? t.allocation.price : t.variant.price;
      return offerFigures({ price, oneTimePrice: t.variant.price, compareAt: t.variant.compare_at_price || 0, quantity: t.quantity, servings, days, singlePrice: single });
    },
  }));
}

// innerText skips display: none, so only the figures a shopper can see count.
const visibleText = (locator) => locator.evaluateAll((els) => els.map((el) => el.innerText.replace(/\s+/g, ' ').trim()).join(' | '));

async function runCombination(preset, product, index, t, plan, js) {
  const label = `${product.handle} · tier ${index} · ${plan} · JS ${js ? 'on' : 'off'}`;
  // Reduced motion so colour transitions have settled before styles are read.
  const context = await browser.newContext({ javaScriptEnabled: js, viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  server.resetCart();
  await page.goto(`${server.base}/products/${product.handle}`, { waitUntil: 'networkidle' });

  await page.click(`label[for="Tier-bundle-${index}"]`);
  if (t.allocation) await page.locator(`.bp-plan:has([data-bp-plan="${plan}"])`).click();
  await page.waitForTimeout(100);

  const card = page.locator(`label[for="Tier-bundle-${index}"]`);
  const set = card.locator(t.allocation ? `.bp-tier__price-set[data-plan="${plan}"]:visible` : '.bp-tier__price-set');
  const f = t.figures(plan);
  const shown = (await set.innerText()).replace(/\s+/g, ' ');

  // §16.2: per-month headline (multi-month tiers), total, per-serving, compare-at, saving.
  if (f.perMonth) check(`${label}: per-month headline ${formatMoney(f.perMonth)}/mo`, shown.includes(`${formatMoney(f.perMonth)}/mo`), shown);
  check(`${label}: total ${formatMoney(f.total)}`, shown.includes(formatMoney(f.total)), shown);
  if (f.perServing) check(`${label}: per serving ${formatMoney(f.perServing)}`, shown.includes(`${formatMoney(f.perServing)} /`), shown);
  if (f.compare) check(`${label}: compare-at ${formatMoney(f.compare)}`, shown.includes(formatMoney(f.compare)), shown);
  if (f.savePct) check(`${label}: saves ${f.savePct}% (rounded down)`, shown.includes(`Save ${f.savePct}%`), shown);
  if (!f.savePct) check(`${label}: no saving claimed`, !/Save \d/.test(shown), shown);

  // The figures shown are for the plan that will post.
  if (t.allocation && plan === 'sub') {
    const expected = String((js ? t.allocation : t.variant.selling_plan_allocations[0]).selling_plan.id);
    const shownPlans = await card.locator('.bp-tier__price-set[data-plan="sub"]').evaluateAll((els) => els.filter((el) => el.getClientRects().length).map((el) => el.dataset.sellingPlan));
    check(`${label}: shows figures for plan ${expected} only`, shownPlans.length === 1 && shownPlans[0] === expected, JSON.stringify(shownPlans));
  }

  // The other plan's figures stay hidden.
  if (t.allocation) {
    const other = plan === 'sub' ? 'once' : 'sub';
    check(`${label}: ${other} figures hidden`, (await card.locator(`.bp-tier__price-set[data-plan="${other}"]:visible`).count()) === 0);
  }

  // §16.5: selected state — accent border, tinted fill, filled radio.
  const style = await card.evaluate((el) => {
    const css = getComputedStyle(el);
    const root = getComputedStyle(el.closest('.bp-buybox'));
    const probe = (value) => {
      const p = document.createElement('i');
      p.style.color = value;
      document.body.append(p);
      const c = getComputedStyle(p).color;
      p.remove();
      return c;
    };
    return {
      border: css.borderTopColor,
      accent: probe(root.getPropertyValue('--bp-accent')),
      background: css.backgroundColor,
      soft: probe(root.getPropertyValue('--bp-accent-soft')),
      dot: getComputedStyle(el.querySelector('.bp-tier__radio'), '::after').backgroundColor,
    };
  });
  check(`${label}: selected card has accent border`, style.border === style.accent, JSON.stringify(style));
  check(`${label}: selected card has tinted fill`, style.background === style.soft, JSON.stringify(style));
  check(`${label}: selected radio is filled`, style.dot !== 'rgba(0, 0, 0, 0)', style.dot);

  // §16.12: the saving is never the biggest text.
  if (f.savePct) {
    const sizes = await set.evaluate((el) => ({
      headline: parseFloat(getComputedStyle(el.querySelector('.bp-tier__headline')).fontSize),
      save: parseFloat(getComputedStyle(el.querySelector('.bp-tier__save')).fontSize),
    }));
    check(`${label}: saving smaller than headline`, sizes.save < sizes.headline, JSON.stringify(sizes));
  }

  // §16.6: a gift tier shows the FREE GIFT badge with its value.
  if (t.tier.gift_variant?.value) {
    const badge = await card.locator('.bp-badge--gift').innerText();
    check(`${label}: free gift badge with value`, /free gift/i.test(badge) && badge.toLowerCase().includes(t.tier.gift_value_label.value.toLowerCase()), badge);
  }

  // The add-to-cart button shows this tier and plan's total (JS adds nothing to it; CSS picks the span).
  const atc = await visibleText(page.locator('[data-bp-atc]'));
  check(`${label}: button shows ${formatMoney(f.total)} and no other price`, atc.includes(formatMoney(f.total)) && (atc.match(/\$/g) || []).length === 1, atc);

  // §16.10 (posting half): what the form sends.
  await page.click('[data-bp-atc]');
  await page.waitForTimeout(js ? 400 : 300);
  const main = server.requests.find((r) => r.items.some((i) => String(i.id) === String(t.variant.id)));
  check(`${label}: posts variant ${t.variant.id}`, main, JSON.stringify(server.requests.map((r) => r.items)));
  if (main) {
    const item = main.items.find((i) => String(i.id) === String(t.variant.id));
    // With JS the tier's own plan posts; without it, the default plan (the first one).
    const postedAllocation = js ? t.allocation : t.variant.selling_plan_allocations[0];
    const expectedPlan = plan === 'sub' ? String(postedAllocation.selling_plan.id) : '';
    check(`${label}: posts selling plan "${expectedPlan || 'none'}"`, String(item.selling_plan ?? '') === expectedPlan, JSON.stringify(item));
    check(`${label}: posts quantity 1`, Number(item.quantity) === 1, JSON.stringify(item));
  }
  if (js && t.tier.gift_variant?.value) {
    const gift = server.requests.find((r) => r.items.some((i) => String(i.id) === String(t.tier.gift_variant.value.id)));
    check(`${label}: adds the free gift line`, gift && gift.items[0].properties?._bp_gift === '1', JSON.stringify(gift?.items));
  }
  if (!js) check(`${label}: lands on the cart page`, new URL(page.url()).pathname === '/cart', page.url());
  await context.close();
}

for (const [preset, product] of Object.entries(PRESET_PRODUCTS)) {
  const tiers = expectedTiers(product);
  for (const [i, t] of tiers.entries()) {
    for (const plan of t.allocation ? ['once', 'sub'] : ['once']) {
      for (const js of [true, false]) await runCombination(preset, product, i + 1, t, plan, js);
    }
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${server.base}/products/${product.handle}`, { waitUntil: 'networkidle' });

  // §16.3: the merchant's preselected tier starts checked.
  const preselected = tiers.findIndex((t) => t.tier.preselected?.value) + 1;
  check(`${product.handle}: preselected tier ${preselected} starts checked`, await page.isChecked(`#Tier-bundle-${preselected}`));

  // §16.7: under the button, in order: rating line, trust tiles, payment icons.
  const order = await page.evaluate(() => {
    const at = (sel) => document.querySelector(sel);
    const els = ['.bp-buy-buttons', '.bp-proof-line', '.bp-trust-tiles', '.bp-buybox .bp-payment-icons'].map(at);
    if (els.some((e) => !e)) return 'missing: ' + els.map((e, i) => (e ? '' : i)).join('');
    return els.every((el, i) => i === 0 || els[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) ? 'ok' : 'out of order';
  });
  check(`${product.handle}: button, rating line, trust tiles, payment icons in order`, order === 'ok', order);

  // §16.8: sticky add to cart appears once the button scrolls away, and hides when it's back.
  const sticky = page.locator('bp-sticky-atc');
  await page.locator('[data-bp-atc]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  check(`${product.handle}: sticky bar hidden while the button is visible`, (await sticky.getAttribute('data-visible')) === null);
  await page.evaluate(() => window.scrollTo(0, document.querySelector('[data-bp-atc]').getBoundingClientRect().bottom + window.scrollY + 400));
  await page.waitForTimeout(500);
  check(`${product.handle}: sticky bar shown after scrolling past the button`, (await sticky.getAttribute('data-visible')) !== null);

  // §16.13: keyboard reaches the tiers, and arrow keys move between them.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.goto(`${server.base}/products/${product.handle}`, { waitUntil: 'networkidle' });
  let reached = false;
  for (let i = 0; i < 60 && !reached; i += 1) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => document.activeElement?.matches('[data-bp-tier-input]'));
  }
  check(`${product.handle}: tiers reachable by keyboard`, reached);
  if (reached) {
    const before = await page.evaluate(() => document.activeElement.dataset.bpTierInput);
    await page.keyboard.press('ArrowDown');
    const after = await page.evaluate(() => document.querySelector('[data-bp-tier-input]:checked').dataset.bpTierInput);
    check(`${product.handle}: arrow key changes tier`, before !== after, `${before} → ${after}`);
  }

  // §16.14: deep link from a pre-lander selects the same state as a click.
  if (tiers.length >= 3) {
    const sub = tiers[2].allocation ? 'sub' : 'once';
    await page.goto(`${server.base}/products/${product.handle}?tier=3&plan=${sub}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    check(`${product.handle}: ?tier=3 checks tier 3`, await page.isChecked('#Tier-bundle-3'));
    if (tiers[2].allocation) check(`${product.handle}: ?plan=sub checks subscribe`, await page.isChecked('[data-bp-plan="sub"]'));
  }
  await context.close();
}

// Changing flavour keeps the chosen tier and plan, and posts the matching variant (Section Rendering API).
{
  const product = PRESET_PRODUCTS.Bold;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  server.resetCart();
  await page.goto(`${server.base}/products/${product.handle}`, { waitUntil: 'networkidle' });
  await page.click('label[for="Tier-bundle-3"]');
  await page.locator('.bp-plan:has([data-bp-plan="sub"])').click();
  await page.click('.bp-pill:has-text("Vanilla")');
  await page.waitForFunction(() => new URL(location.href).searchParams.has('variant'));
  await page.waitForTimeout(300);
  const vanilla3 = product.variants.find((v) => v.options[0] === 'Vanilla' && v.options[1] === product.variants[0].options[1] && v.options[2] === '3 tubs');
  check('rawform: flavour change keeps tier 3', await page.isChecked('#Tier-bundle-3'));
  check('rawform: flavour change keeps subscribe', await page.isChecked('[data-bp-plan="sub"]'));
  check('rawform: flavour change updates the URL', new URL(page.url()).searchParams.get('variant') === String(vanilla3.id), page.url());
  await page.click('[data-bp-atc]');
  await page.waitForTimeout(400);
  check('rawform: posts Vanilla · 3 tubs after the change', server.requests.some((r) => r.items.some((i) => String(i.id) === String(vanilla3.id))), JSON.stringify(server.requests.map((r) => r.items)));
  await context.close();
}

// Picking another delivery frequency re-renders the figures for that plan and posts it.
{
  const product = PRESET_PRODUCTS.Clinical;
  const [, , tier3] = expectedTiers(product);
  const chosen = tier3.variant.selling_plan_allocations.find((a) => a !== tier3.allocation);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  server.resetCart();
  await page.goto(`${server.base}/products/${product.handle}`, { waitUntil: 'networkidle' });
  await page.click('label[for="Tier-bundle-3"]');
  await page.locator('.bp-plan:has([data-bp-plan="sub"])').click();
  await page.selectOption('[data-bp-frequency] select', String(chosen.selling_plan.id));
  await page.waitForFunction(() => new URL(location.href).searchParams.has('selling_plan'));
  await page.waitForTimeout(300);
  const shownPlans = await page.locator('label[for="Tier-bundle-3"] .bp-tier__price-set[data-plan="sub"]').evaluateAll((els) => els.filter((el) => el.getClientRects().length).map((el) => el.dataset.sellingPlan));
  check('verde: frequency change keeps tier 3 and subscribe', (await page.isChecked('#Tier-bundle-3')) && (await page.isChecked('[data-bp-plan="sub"]')));
  check('verde: frequency change shows that plan\'s figures', shownPlans.join() === String(chosen.selling_plan.id), JSON.stringify(shownPlans));
  await page.click('[data-bp-atc]');
  await page.waitForTimeout(400);
  const item = server.requests.flatMap((r) => r.items).find((i) => String(i.id) === String(tier3.variant.id));
  check('verde: frequency change posts that plan', String(item?.selling_plan) === String(chosen.selling_plan.id), JSON.stringify(item));
  await context.close();
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
for (const r of failed) console.log(`✗ ${r.name}\n    ${r.detail.slice(0, 300)}`);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exitCode = failed.length ? 1 : 0;
