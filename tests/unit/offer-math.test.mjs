import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, offerFigures } from '../../tools/lib/offer-math.mjs';

// docs/PLAN.md §7.4 worked example: Verde, 30 servings per pouch, 20% subscription.
const verde = [
  // tier, plan, price, compare-at, quantity, total, per month, per serving, save %
  ['1 pouch', 'once', 7900, 9900, 1, '$79.00', null, '$2.63', 20],
  ['1 pouch', 'sub', 6320, 9900, 1, '$63.20', null, '$2.11', 36],
  ['2 pouches', 'once', 14200, 19800, 2, '$142.00', '$71.00', '$2.37', 28],
  ['2 pouches', 'sub', 11360, 19800, 2, '$113.60', '$56.80', '$1.89', 42],
  ['3 pouches', 'once', 19900, 29700, 3, '$199.00', '$66.33', '$2.21', 32],
  ['3 pouches', 'sub', 15920, 29700, 3, '$159.20', '$53.07', '$1.77', 46],
];

for (const [tier, plan, price, compareAt, quantity, total, perMonth, perServing, save] of verde) {
  test(`Verde ${tier} (${plan}) matches the plan's worked example`, () => {
    const f = offerFigures({ price, compareAt, quantity, servings: 30, days: 30, singlePrice: 7900 });
    assert.equal(formatMoney(f.total), total);
    assert.equal(f.perMonth === null ? null : formatMoney(f.perMonth), perMonth);
    assert.equal(formatMoney(f.perServing), perServing);
    assert.equal(f.savePct, save);
  });
}

test('rounds savings down, never up (33.0% → 32%)', () => {
  assert.equal(offerFigures({ price: 19900, compareAt: 29700 }).savePct, 32);
});

test('measures against buying singles when there is no compare-at price', () => {
  // 2 pouches at $142 vs 2 × $79 = $158: a real 10% saving, not the 28% a compare-at would claim.
  assert.equal(offerFigures({ price: 14200, quantity: 2, singlePrice: 7900 }).savePct, 10);
  assert.equal(offerFigures({ price: 14200, quantity: 2, singlePrice: 7900, compareAt: 19800, reference: 'singles' }).savePct, 10);
});

test('shows no saving when there is nothing honest to compare against', () => {
  const f = offerFigures({ price: 12000, singlePrice: 2800 });
  assert.equal(f.savePct, null);
  assert.equal(f.compare, null);
});

test('measures a subscription against the one-time price when nothing else applies', () => {
  const f = offerFigures({ price: 6320, oneTimePrice: 7900 });
  assert.equal(f.savePct, 20);
  assert.equal(f.planSavePct, 20);
});
