// Gift and shipping protection rules for the cart (assets/bp-cart.js, docs/PLAN.md §8).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconcile } from '../../assets/bp-cart.js';

const PROTECTION = 900;
const SHAKER = 801;
const PACKS = 802;
const rewards = [
  { index: 1, threshold: 5000, gift: null },
  { index: 2, threshold: 13000, gift: SHAKER },
  { index: 3, threshold: 19000, gift: PACKS },
];
const line = (id, extra = {}) => ({ key: `${id}:k`, id, quantity: 1, gift: '', reward: 0, for: 0, discounted: false, ...extra });
const state = (basis, items, extra = {}) => ({ basis, merch: items.filter((i) => !i.gift && i.id !== PROTECTION).length, items, rewards, protection: PROTECTION, protectionDefault: false, ...extra });

test('adds every reward gift the cart has earned, and nothing else', () => {
  const plan = reconcile(state(14200, [line(1013)]));
  assert.deepEqual(plan.add, [{ id: SHAKER, quantity: 1, properties: { _bp_gift: 'reward', _bp_reward: '2' } }]);
  assert.deepEqual(plan.remove, []);
});

test('does not add a gift that is already in the cart', () => {
  const plan = reconcile(state(19900, [line(1014), line(SHAKER, { gift: 'reward', reward: 2 }), line(PACKS, { gift: 'reward', reward: 3 })]));
  assert.deepEqual(plan, { add: [], remove: [], protectionAdded: false });
});

test('removes reward gifts when the cart drops below their threshold', () => {
  const plan = reconcile(state(7900, [line(1012), line(SHAKER, { gift: 'reward', reward: 2 })]));
  assert.deepEqual(plan.remove, [`${SHAKER}:k`]);
  assert.deepEqual(plan.add, []);
});

test('respects a shopper who removed a reward gift', () => {
  const plan = reconcile(state(14200, [line(1013)]), { declined: [2] });
  assert.deepEqual(plan.add, []);
});

test('a reward the merchant turned off loses its gift line', () => {
  const plan = reconcile(state(14200, [line(1013), line(SHAKER, { gift: 'reward', reward: 2 })], { rewards: [] }));
  assert.deepEqual(plan.remove, [`${SHAKER}:k`]);
});

test('gifts never count as merchandise: a cart of only gifts earns nothing', () => {
  const plan = reconcile(state(0, [line(SHAKER, { gift: 'reward', reward: 2 })]));
  assert.deepEqual(plan.add, []);
  assert.deepEqual(plan.remove, [`${SHAKER}:k`]);
});

test('removes a tier gift whose bundle has left the cart', () => {
  const plan = reconcile(state(7900, [line(1012), line(777, { gift: 'tier', for: 1014 })]));
  assert.deepEqual(plan.remove, ['777:k']);
});

test('keeps a tier gift while its bundle is in the cart', () => {
  const plan = reconcile(state(19900, [line(1014), line(777, { gift: 'tier', for: 1014 }), line(SHAKER, { gift: 'reward', reward: 2 }), line(PACKS, { gift: 'reward', reward: 3 })]));
  assert.deepEqual(plan.remove, []);
});

test('protection is off unless the merchant turns the default on', () => {
  assert.deepEqual(reconcile(state(7900, [line(1012)])).add, []);
});

test('default-on protection is added once, and never after the shopper touched it', () => {
  const on = { protectionDefault: true };
  const first = reconcile(state(7900, [line(1012)], on));
  assert.deepEqual(first.add, [{ id: PROTECTION, quantity: 1 }]);
  assert.equal(first.protectionAdded, true);
  assert.deepEqual(reconcile(state(7900, [line(1012)], on), { protectionTouched: true }).add, []);
});

test('protection leaves a cart with no merchandise', () => {
  const plan = reconcile(state(0, [line(PROTECTION)], { protectionDefault: true }));
  assert.deepEqual(plan.remove, [`${PROTECTION}:k`]);
  assert.deepEqual(plan.add, []);
});

test('protection never counts towards rewards or as merchandise', () => {
  const plan = reconcile(state(4000, [line(PROTECTION)]));
  assert.deepEqual(plan.remove, [`${PROTECTION}:k`]);
});
