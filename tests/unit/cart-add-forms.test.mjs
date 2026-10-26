// Only the product form may have a /cart/add action. Shopify's analytics script treats every
// such form as the product being viewed and fires "Viewed Product Variant" for each one on load
// (found on a real store: about 230 ms of mobile blocking time on a collection page, and a view
// logged for every product card). Other add-to-cart forms post through their button's formaction.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const liquid = ['sections', 'blocks', 'snippets', 'layout'].flatMap((dir) =>
  readdirSync(join(root, dir))
    .filter((file) => file.endsWith('.liquid'))
    .map((file) => ({ path: `${dir}/${file}`, source: readFileSync(join(root, dir, file), 'utf8') })),
);

test('no form has a /cart/add action', () => {
  const offenders = liquid.filter(({ source }) => /<form\b[^>]*\baction="\{\{\s*routes\.cart_add_url/.test(source)).map(({ path }) => path);
  assert.deepEqual(offenders, []);
});

test("only the buy buttons use {% form 'product' %}", () => {
  const users = liquid.filter(({ source }) => /\{%-?\s*form\s+'product'/.test(source)).map(({ path }) => path);
  assert.deepEqual(users, ['blocks/product-buy-buttons.liquid']);
});

test('every formaction to /cart/add sits on a submit button', () => {
  for (const { path, source } of liquid) {
    for (const match of source.matchAll(/<(\w+)\b[^>]*formaction="\{\{\s*routes\.cart_add_url[^>]*>/g)) {
      assert.equal(match[1], 'button', `${path}: ${match[0].slice(0, 80)}`);
      assert.match(match[0], /type="submit"/, `${path}: ${match[0].slice(0, 80)}`);
    }
  }
});
