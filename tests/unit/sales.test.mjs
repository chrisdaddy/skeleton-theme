// The sales store's products and the Portal agree on SKUs, and each licence product is digital.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PRODUCTS } from '../../portal/src/worker.js';

const store = JSON.parse(readFileSync(new URL('../../tools/sales/store.json', import.meta.url), 'utf8'));

test('every sales-store SKU mints keys in the Portal, and every Portal SKU is on sale', () => {
  const variants = store.products.flatMap((product) => product.variants);
  const skus = variants.map((variant) => variant.sku);
  assert.deepEqual([...skus].sort(), Object.keys(PRODUCTS).sort());
  for (const variant of variants) {
    assert.equal(variant.requiresShipping, false, `${variant.sku} is digital`);
    assert.equal(variant.tracked, false, `${variant.sku} never sells out`);
  }
});
