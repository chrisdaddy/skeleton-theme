// Reviews: provider order and response mapping (canned responses in the shape each app's API
// documents), CSV exports, cleaning, and the verbatim-quote check. Plus the prompt files.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadPrompts, parsePrompt, fillPrompt } from '../dist/prompts.js';
import { clean, displayName, fetchReviews, findQuoteSource, parseReviewsCsv } from '../dist/reviews.js';

const csvPath = fileURLToPath(new URL('./fixtures/verde-reviews.csv', import.meta.url));

function fakeFetch(routes) {
  const seen = [];
  const impl = async (url) => {
    seen.push(url);
    const route = routes.find(([pattern]) => pattern.test(url));
    if (!route) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(route[1]), { status: 200 });
  };
  return { impl, seen };
}

const base = { shop: 'verde.myshopify.com', productId: '42', handle: 'verde-daily', limit: 50 };

test('Judge.me first, mapped and filtered to published reviews', async () => {
  const { impl, seen } = fakeFetch([
    [/judge\.me\/api\/v1\/products\/-1/, { product: { id: 7 } }],
    [/judge\.me\/api\/v1\/reviews/, { reviews: [
      { id: 1, rating: 5, title: 'Great', body: '<p>Day 10 and the 3pm slump is just gone.</p>', reviewer: { name: 'Priya Shah' }, verified: 'buyer', created_at: '2026-08-11', published: true },
      { id: 2, rating: 1, title: 'Hidden', body: 'x', reviewer: { name: 'H' }, verified: 'nothing', hidden: true },
    ] }],
  ]);
  const result = await fetchReviews({ ...base, keys: { judgemeToken: 'tok', okendoStoreId: 'ok' }, fetchImpl: impl });
  assert.equal(result.source, 'judge.me');
  assert.equal(result.reviews.length, 1);
  assert.deepEqual({ ...result.reviews[0], date: undefined }, { id: 'judge.me:1', rating: 5, title: 'Great', body: 'Day 10 and the 3pm slump is just gone.', author: 'Priya S.', verified: true, date: undefined, source: 'judge.me' });
  assert.ok(seen.every((u) => u.startsWith('https://judge.me/')), 'Okendo not asked once Judge.me answered');
});

test('falls through to Okendo, Yotpo and Stamped in order', async () => {
  const okendo = fakeFetch([[/api\.okendo\.io\/v1\/stores\/store-1\/products\/shopify-42\/reviews/, { reviews: [{ reviewId: 'a', rating: 4, title: 't', body: 'Okendo body text here', reviewer: { displayName: 'Ana Lima', isVerified: true }, dateCreated: '2026-01-01' }] }]]);
  assert.equal((await fetchReviews({ ...base, keys: { judgemeToken: 'bad', okendoStoreId: 'store-1' }, fetchImpl: okendo.impl })).source, 'okendo');

  const yotpo = fakeFetch([[/api-cdn\.yotpo\.com\/v1\/widget\/key\/products\/42\/reviews\.json/, { response: { reviews: [{ id: 9, score: 5, title: 't', content: 'Yotpo body text here', user: { display_name: 'Bo' }, verified_buyer: false }] } }]]);
  const y = await fetchReviews({ ...base, keys: { yotpoAppKey: 'key' }, fetchImpl: yotpo.impl });
  assert.equal(y.source, 'yotpo');
  assert.equal(y.reviews[0].verified, false);

  const stamped = fakeFetch([[/stamped\.io\/api\/widget\/reviews/, { data: [{ id: 3, reviewRating: 5, reviewTitle: 't', reviewMessage: 'Stamped body text', author: 'Cy D', isVerified: true }] }]]);
  assert.equal((await fetchReviews({ ...base, keys: { stampedApiKey: 'k', stampedStoreUrl: 'verde.com' }, fetchImpl: stamped.impl })).source, 'stamped');

  const none = await fetchReviews({ ...base, keys: {}, fetchImpl: fakeFetch([]).impl });
  assert.equal(none.source, 'none');
  assert.deepEqual(none.reviews, []);
});

test('CSV exports: published reviews of the product only, with names shortened', () => {
  const reviews = parseReviewsCsv(readFileSync(csvPath, 'utf8'), 'verde-daily');
  assert.equal(reviews.length, 5);
  assert.deepEqual(reviews.map((r) => r.author), ['Marcus T.', 'Priya S.', 'Jen R.', 'Alex K.', 'Mallory E.']);
  assert.equal(reviews[3].verified, false);
  assert.ok(!reviews[4].body.includes('<script>'));
  // A Loox-style export (different headers).
  const loox = parseReviewsCsv('rating,full_name,review,date,handle\n5,"Sam Lee","Loved it, would buy again",2026-05-01,verde-daily\n', 'verde-daily');
  assert.equal(loox[0].author, 'Sam L.');
  assert.throws(() => parseReviewsCsv('a,b\n1,2\n'), /no review text column/);
});

test('cleaning strips markup, control and bidi characters', () => {
  assert.equal(clean('<b>Hi</b>‮there\u0007  friend &amp; co'), 'Hi there friend & co');
  assert.equal(displayName('  '), 'Customer');
  assert.equal(displayName('Cher'), 'Cher');
});

test('quotes must be verbatim excerpts of a fetched review', () => {
  const reviews = parseReviewsCsv(readFileSync(csvPath, 'utf8'), 'verde-daily');
  assert.equal(findQuoteSource('“Day 10 and the 3pm slump is just gone.”', reviews)?.author, 'Priya S.');
  assert.equal(findQuoteSource('day 10 and the 3pm   slump is just gone', reviews)?.author, 'Priya S.');
  assert.equal(findQuoteSource('Day 10 and the slump is completely gone.', reviews), undefined, 'reworded');
  assert.equal(findQuoteSource('Best product ever made.', reviews), undefined, 'invented');
  assert.equal(findQuoteSource('gone.', reviews), undefined, 'too short to attribute');
});

test('all 22 prompts parse, have unique names and fill their arguments', () => {
  const prompts = loadPrompts(fileURLToPath(new URL('../../prompts/', import.meta.url)));
  assert.equal(prompts.length, 22);
  assert.equal(new Set(prompts.map((p) => p.name)).size, 22);
  for (const p of prompts) {
    const placeholders = [...p.body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
    for (const name of placeholders) assert.ok(p.arguments.some((a) => a.name === name), `${p.name}: {{${name}}} has no argument`);
    const filled = fillPrompt(p, Object.fromEntries(p.arguments.map((a) => [a.name, 'X'])));
    assert.ok(!/\{\{/.test(filled), p.name);
  }
  const missing = fillPrompt(prompts[0], {});
  assert.match(missing, /ask the merchant/);
  assert.throws(() => parsePrompt('no front matter'), /front-matter/);
});
