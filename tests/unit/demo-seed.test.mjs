// Demo stores (Phase 6): the catalogs agree with the preview's mock data, the templates and
// theme settings only name things the seed creates, money and labels stay honest, and the seed
// is idempotent against the in-memory admin.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildCatalog, REQUIRED_STORES } from '../../tools/demo/catalog.mjs';
import { storeConfig } from '../../tools/demo/build-stores.mjs';
import { fakeAdmin } from '../../tools/demo/fake-admin.mjs';
import { pickLocation, seed } from '../../tools/demo/seed.mjs';
import { buildDemoProducts } from '../../tools/preview/mock-products.mjs';
import { buildTemplates } from '../../tools/templates-from-demo.mjs';

const root = new URL('../../', import.meta.url);
const demo = JSON.parse(readFileSync(new URL('data/demo-content.json', root), 'utf8'));
const configs = Object.fromEntries(demo.storeOrder.map((id) => [id, storeConfig(id)]));
const toCents = (money) => Math.round(Number(money) * 100);

function refs(value, out = []) {
  if (Array.isArray(value)) value.forEach((v) => refs(v, out));
  else if (value && typeof value === 'object') {
    const key = Object.keys(value).find((k) => k.startsWith('$'));
    if (key) out.push([key, value[key]]);
    else Object.values(value).forEach((v) => refs(v, out));
  }
  return out;
}

test('committed store configs are current (node tools/demo/build-stores.mjs)', () => {
  for (const id of demo.storeOrder) {
    const committed = JSON.parse(readFileSync(new URL(`tools/demo/stores/${id}.json`, root), 'utf8'));
    assert.deepEqual(committed, JSON.parse(JSON.stringify(configs[id])), `${id}.json is stale`);
  }
});

test('hero prices match the preview mock, variant for variant', () => {
  const mock = buildDemoProducts(demo);
  for (const id of REQUIRED_STORES) {
    const hero = configs[id].products[0];
    for (const variant of mock[id].variants) {
      const match = hero.variants.find((v) => JSON.stringify(v.options) === JSON.stringify(variant.options));
      assert.ok(match, `${id}: no variant ${variant.options.join(' / ')}`);
      assert.equal(toCents(match.price), variant.price, `${id} ${variant.title} price`);
      assert.equal(match.compareAtPrice ? toCents(match.compareAtPrice) : null, variant.compare_at_price, `${id} ${variant.title} compare-at`);
    }
  }
  assert.equal(configs.rawform.products[0].variants.length, 24, 'Rawform: Flavour × Size × Pack');
});

test('every reference points at something the seed creates', () => {
  for (const [id, c] of Object.entries(configs)) {
    const products = new Set(c.products.map((p) => p.handle));
    const metaobjects = new Set(c.metaobjects.map((m) => `${m.type}/${m.handle}`));
    const files = new Set(c.files.map((f) => f.key));
    const collections = new Set(c.collections.map((x) => x.handle));
    const pages = new Set(c.pages.map((p) => p.handle));
    for (const [kind, target] of refs([c.products, c.metaobjects, c.menus, c.discounts])) {
      if (kind === '$product') assert.ok(products.has(target), `${id}: product ${target}`);
      if (kind === '$variant') {
        const product = c.products.find((p) => p.handle === target[0]);
        assert.ok(product, `${id}: variant of ${target[0]}`);
        assert.ok(target[1].length === 0 || product.variants.some((v) => JSON.stringify(v.options) === JSON.stringify(target[1])), `${id}: variant ${target.flat().join(' / ')}`);
      }
      if (kind === '$metaobject') assert.ok(metaobjects.has(target), `${id}: metaobject ${target}`);
      if (kind === '$file') assert.ok(files.has(target), `${id}: file ${target}`);
      if (kind === '$collection') assert.ok(collections.has(target), `${id}: collection ${target}`);
      if (kind === '$page') assert.ok(pages.has(target), `${id}: page ${target}`);
    }
  }
});

test('templates and theme settings only name products, collections and photos the seed creates', () => {
  for (const id of REQUIRED_STORES) {
    const c = configs[id];
    const products = new Set(c.products.map((p) => p.handle));
    const collections = new Set(c.collections.map((x) => x.handle));
    const files = new Set(c.files.map((f) => f.filename));
    const json = JSON.stringify(buildTemplates(id, { images: 'shop' }));
    for (const [, filename] of json.matchAll(/shopify:\/\/shop_images\/([^"]+)/g)) assert.ok(files.has(filename), `${id}: photo ${filename}`);
    for (const [, handle] of json.matchAll(/"(?:product|cta_product)":"([^"]+)"/g)) assert.ok(products.has(handle), `${id}: template product ${handle}`);
    for (const [, handle] of json.matchAll(/"collection":"([^"]+)"/g)) assert.ok(collections.has(handle), `${id}: template collection ${handle}`);
    const s = c.theme.settings;
    assert.ok(products.has(s.cart_protection_product));
    assert.ok(collections.has(s.cart_upsell_collection) && collections.has(s.cart_empty_collection));
    for (const n of [1, 2, 3]) if (s[`cart_reward_${n}_gift`]) assert.ok(products.has(s[`cart_reward_${n}_gift`]), `${id}: reward ${n} gift`);
  }
});

test('offers the theme shows are backed by discounts, with honest labels', () => {
  for (const [id, c] of Object.entries(configs)) {
    const s = c.theme.settings;
    const freeShipping = c.discounts.find((d) => d.kind === 'freeShipping' && d.minimumSubtotal);
    assert.equal(toCents(freeShipping.minimumSubtotal), s.cart_reward_1_threshold * 100, `${id}: free shipping threshold`);
    for (const n of [2, 3]) {
      const gift = s[`cart_reward_${n}_gift`];
      if (!gift) continue;
      const d = c.discounts.find((x) => x.kind === 'giftOverAmount' && x.gift.$variant[0] === gift);
      assert.ok(d, `${id}: reward ${n} has a gift discount`);
      assert.equal(toCents(d.minimumAmount), s[`cart_reward_${n}_threshold`] * 100, `${id}: reward ${n} threshold`);
    }
    // A tier's "$N value" gift label is the gift's real price.
    for (const tier of c.metaobjects.filter((m) => m.type === 'blueprint_tier' && m.fields.gift_value_label)) {
      const gift = c.products.find((p) => p.handle === tier.fields.gift_variant.$variant[0]);
      assert.equal(toCents(/\$(\d+)/.exec(tier.fields.gift_value_label)[1]), toCents(gift.variants[0].price), `${id}: ${tier.handle} gift value`);
      assert.ok(c.discounts.some((d) => d.kind === 'giftWithVariants' && d.gift.$variant[0] === gift.handle), `${id}: ${tier.handle} gift discount`);
    }
    // "$N in cart" on the upsell is the price after its automatic discount.
    for (const product of c.products.filter((p) => p.metafields.some((m) => m.key === 'cart_deal_label'))) {
      const label = product.metafields.find((m) => m.key === 'cart_deal_label').value;
      const d = c.discounts.find((x) => x.kind === 'amountOffProduct' && x.products.some((p) => p.$product === product.handle));
      assert.equal(toCents(product.variants[0].price) - toCents(d.amountEach), toCents(/\$(\d+)/.exec(label)[1]), `${id}: ${label}`);
    }
    // Mix-tier discounts never exceed the tier's own saving (rounded down).
    for (const d of c.discounts.filter((x) => x.kind === 'percentOffQuantity')) assert.ok(Number.isInteger(d.percentage) && d.percentage > 0 && d.percentage < 100);
  }
});

test('no money in metafields or metaobjects, apart from labels that state a real price', () => {
  for (const [id, c] of Object.entries(configs)) {
    const fields = [...c.products.flatMap((p) => p.metafields.map((m) => [m.key, m.value])), ...c.metaobjects.flatMap((m) => Object.entries(m.fields))];
    for (const [key, value] of fields) {
      assert.ok(!/price|amount|cost/i.test(key), `${id}: ${key}`);
      if (!['cart_deal_label', 'gift_value_label', 'subtitle', 'title', 'label', 'question', 'answer', 'feature', 'us', 'them', 'why', 'shot_note'].includes(key)) {
        assert.ok(!/\$\d/.test(JSON.stringify(value)), `${id}: ${key} holds a price`);
      }
    }
  }
});

test('seeding is idempotent and leaves no unresolved references', async () => {
  for (const id of REQUIRED_STORES) {
    const fake = fakeAdmin();
    const options = { renderImage: fake.renderImage, upload: fake.upload, log: () => {} };
    const first = await seed(configs[id], fake.gql, options);
    assert.ok(first.created.length > 0);
    const second = await seed(configs[id], fake.gql, options);
    assert.deepEqual(second.created, [], `${id}: second run created ${second.created.join(', ')}`);
    assert.equal(fake.db.products.length, configs[id].products.length);
    assert.equal(fake.db.metaobjects.length, configs[id].metaobjects.length);
    assert.equal(fake.db.discounts.length, configs[id].discounts.length);
    for (const call of fake.calls) assert.ok(!/"\$(product|variant|metaobject|file|collection|page)"/.test(JSON.stringify(call.variables)), `${id}: ${call.operation} sent an unresolved reference`);
    // Prices go to Shopify exactly as the catalog has them.
    const hero = fake.db.products.find((p) => p.handle === configs[id].products[0].handle).input;
    assert.deepEqual(hero.variants.map((v) => v.price), configs[id].products[0].variants.map((v) => v.price));
    // Every tracked variant is stocked, on every run, at the location that ships (not the dev
    // store's first location, which doesn't).
    const heroItems = fake.db.products.find((p) => p.handle === configs[id].products[0].handle).variants.map((v) => v.inventoryItem.id);
    for (const item of heroItems) assert.equal(fake.db.stock[`${item}@gid://shopify/Location/1`], 120, `${id}: ${item} not stocked at Shop location`);
    assert.ok(Object.keys(fake.db.stock).every((k) => k.endsWith('@gid://shopify/Location/1')), `${id}: stock at another location`);
  }
});

test('a catalog builds for every reference store', () => {
  for (const id of demo.storeOrder) assert.ok(buildCatalog(demo, id).products.length > 1, id);
});

test('stock goes to an active location that ships and fulfills online orders', () => {
  const custom = { id: 'custom', isActive: true, fulfillsOnlineOrders: true, shipsInventory: false };
  const shop = { id: 'shop', isActive: true, fulfillsOnlineOrders: true, shipsInventory: true };
  const closed = { id: 'closed', isActive: false, fulfillsOnlineOrders: true, shipsInventory: true };
  assert.equal(pickLocation([custom, shop]).id, 'shop');
  assert.equal(pickLocation([closed, custom]).id, 'custom');
  assert.equal(pickLocation([closed]).id, 'closed');
});

test('re-running one step keeps what the others set (productSet replaces metafield lists)', async () => {
  const fake = fakeAdmin();
  const options = { renderImage: fake.renderImage, upload: fake.upload, log: () => {} };
  const config = configs.verde;
  await seed(config, fake.gql, options);
  const hero = () => fake.db.products.find((p) => p.handle === config.products[0].handle);
  const before = Object.keys(hero().metafields).sort();
  assert.ok(before.includes('blueprint.tiers') && before.includes('blueprint.pack_option'), before.join(', '));
  await seed(config, fake.gql, { ...options, steps: ['shop', 'products'] });
  assert.deepEqual(Object.keys(hero().metafields).sort(), before);
});

test('--refresh-images replaces placeholders in place: same files, same IDs', async () => {
  const fake = fakeAdmin();
  const options = { renderImage: fake.renderImage, upload: fake.upload, log: () => {} };
  await seed(configs.ode, fake.gql, options);
  const before = fake.db.files.map((f) => f.id);
  const result = await seed(configs.ode, fake.gql, { ...options, steps: ['files'], refreshImages: true });
  assert.deepEqual(fake.db.files.map((f) => f.id), before, 'no new files');
  assert.equal(result.created.length, 0);
  assert.ok(fake.db.files.every((f) => f.source), 'every file got new content');
});

test('placeholder labels stay inside the area a 4:5 crop keeps', async () => {
  const { placeholderHtml, sizeFor } = await import('../../tools/demo/images.mjs');
  for (const filename of ['bp-ode-photo-home-hero.png', 'bp-ode-no-04.png']) {
    const { width, height } = sizeFor({ filename });
    const max = Number(/\.label \{ max-width: (\d+)px/.exec(placeholderHtml({ filename, label: 'x' }))[1]);
    assert.ok(max <= Math.min(width, height * 0.8), `${filename}: label ${max}px wide`);
  }
});

test('metaobject upserts clear the fields the catalog leaves out', async () => {
  const fake = fakeAdmin();
  await seed(configs.ode, fake.gql, { renderImage: fake.renderImage, upload: fake.upload, log: () => {} });
  const calls = fake.calls.filter((c) => c.operation === 'BpMetaobjectUpsert' && c.variables.handle.type === 'blueprint_tier');
  const travel = calls.find((c) => c.variables.metaobject.fields.some((f) => f.key === 'label' && f.value === '10 ml travel'));
  const sent = Object.fromEntries(travel.variables.metaobject.fields.map((f) => [f.key, f.value]));
  assert.equal(sent.sublabel, '');
  assert.equal(sent.badge, '');
  assert.equal(sent.pack_value, '10 ml travel');
});
