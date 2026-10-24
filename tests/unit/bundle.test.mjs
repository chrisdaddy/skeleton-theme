// Bundle builder total (assets/bp-bundle.js): variant prices less the displayed percentage,
// in cents, with the saving rounded down (the total rounded up).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bundleTotal } from '../../assets/bp-bundle.js';

test('three $13 items at 20% off', () => {
  assert.deepEqual(bundleTotal([1300, 1300, 1300], 20), { before: 3900, after: 3120 });
});

test('a saving that would round up is rounded down', () => {
  // 15% of $36.99 is $5.5485: the shopper is told $31.45, never $31.44.
  assert.deepEqual(bundleTotal([3699], 15), { before: 3699, after: 3145 });
});

test('no discount below the minimum', () => {
  assert.deepEqual(bundleTotal([1300, 1200], 0), { before: 2500, after: 2500 });
});
