// Blueprint Portal, run in Node against an SQLite stand-in for D1 (node:sqlite runs the real
// schema.sql) and an in-memory R2. Phase 8 acceptance (offline): a test purchase mints a key,
// binds it to a store, and a refund revokes it.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import worker, { newKey } from '../src/worker.js';

const WEBHOOK_SECRET = 'shpss_test_webhook_secret';

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const statement = (sql, params = []) => ({
    bind: (...values) => statement(sql, values),
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    run: async () => db.prepare(sql).run(...params),
    _run: () => db.prepare(sql).run(...params),
  });
  return {
    prepare: (sql) => statement(sql),
    batch: async (statements) => {
      db.exec('BEGIN');
      try {
        for (const s of statements) s._run();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    raw: db,
  };
}

function r2(objects = {}) {
  return {
    get: async (key) => (key in objects ? { body: objects[key], text: async () => String(objects[key]) } : null),
    put: async (key, value) => (objects[key] = value),
  };
}

function setup() {
  const env = {
    DB: d1(),
    RELEASES: r2({ 'releases/1.0.0/manifest.json': JSON.stringify({ version: '1.0.0', files: { 'layout/theme.liquid': 'abc' }, migrations: [] }), 'releases/1.0.0/blueprint-1.0.0.zip': 'ZIPBYTES' }),
    SHOPIFY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    SIGNING_SECRET: 'test-signing-secret-0123456789abcdef',
    RESEND_API_KEY: 're_test',
    PORTAL_URL: 'https://portal.test',
    EMAIL_FROM: 'Blueprint <portal@test>',
    DOCS_URL: 'https://docs.test',
    DISCORD_URL: 'https://discord.test',
  };
  env.DB.raw.prepare("INSERT INTO releases (version, date, notes) VALUES ('1.0.0', '2026-11-02', '- First release')").run();
  const call = (path, init = {}) => worker.fetch(new Request(`https://portal.test${path}`, init), env);
  const api = async (path, data) => {
    const response = await call(`/api/v1/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    return { status: response.status, ...(await response.json()) };
  };
  const webhook = async (topic, payload, secret = WEBHOOK_SECRET) => {
    const raw = JSON.stringify(payload);
    const hmac = createHmac('sha256', secret).update(raw).digest('base64');
    const response = await call(`/webhooks/${topic}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-shopify-hmac-sha256': hmac }, body: raw });
    return { status: response.status, ...(await response.json()) };
  };
  const keys = (orderId) => env.DB.raw.prepare('SELECT key, status, line_item_id FROM licenses WHERE order_id = ? ORDER BY created_at').all(String(orderId));
  return { env, call, api, webhook, keys };
}

const ORDER = {
  id: 5550001,
  name: '#1001',
  email: 'Founder@Brand.com',
  line_items: [
    { id: 11, sku: 'BP-THEME', quantity: 1 },
    { id: 12, sku: 'BP-LICENSE', quantity: 2 },
    { id: 13, sku: 'MERCH-TSHIRT', quantity: 1 },
  ],
};

test('acceptance: a purchase mints keys, a key binds to one store, and a refund revokes it', async () => {
  const { api, webhook, keys } = setup();

  const paid = await webhook('orders/paid', ORDER);
  assert.equal(paid.minted, 3);
  assert.equal((await webhook('orders/paid', ORDER)).duplicate, true, 'webhook retries mint nothing');
  const minted = keys(ORDER.id);
  assert.equal(minted.length, 3);
  assert.ok(minted.every((k) => /^BP-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/.test(k.key)));
  const themeKey = minted.find((k) => k.line_item_id === '11').key;

  // First use binds the key to the store; another store is refused until it is freed.
  assert.deepEqual(await api('licenses/validate', { key: themeKey.toLowerCase(), shop: 'https://Verde-Test.myshopify.com/admin' }), { status: 200, valid: true, key: themeKey, shop: 'verde-test.myshopify.com', product: 'theme' });
  const elsewhere = await api('licenses/validate', { key: themeKey, shop: 'other.myshopify.com' });
  assert.equal(elsewhere.valid, false);
  assert.match(elsewhere.reason, /active on another store/);
  assert.equal((await api('licenses/validate', { key: themeKey, shop: 'brand.com' })).valid, false);

  // The updater gets a signed download that works, and a tampered one that doesn't.
  const latest = await api('releases/latest', { key: themeKey, shop: 'verde-test.myshopify.com' });
  assert.equal(latest.version, '1.0.0');
  assert.equal(latest.manifest.files['layout/theme.liquid'], 'abc');
  const download = new URL(latest.zip_url);

  // A refund of the theme line revokes its key (and only that one).
  const refund = await webhook('refunds/create', { order_id: ORDER.id, refund_line_items: [{ line_item_id: 11, quantity: 1, line_item: { id: 11, sku: 'BP-THEME' } }] });
  assert.equal(refund.revoked, 1);
  const after = keys(ORDER.id);
  assert.equal(after.find((k) => k.key === themeKey).status, 'revoked');
  assert.equal(after.filter((k) => k.status === 'active').length, 2);
  const revoked = await api('licenses/validate', { key: themeKey, shop: 'verde-test.myshopify.com' });
  assert.equal(revoked.valid, false);
  assert.match(revoked.reason, /revoked/);
  assert.equal((await api('releases/latest', { key: themeKey, shop: 'verde-test.myshopify.com' })).status, 403);
  assert.ok(download.searchParams.get('sig'));
});

test('webhooks must carry Shopify\'s signature', async () => {
  const { webhook, keys } = setup();
  assert.equal((await webhook('orders/paid', ORDER, 'wrong-secret')).status, 401);
  assert.equal(keys(ORDER.id).length, 0);
});

test('agency packs mint five keys; cancellations revoke the whole order; partial refunds revoke unused keys first', async () => {
  const { api, webhook, keys } = setup();
  await webhook('orders/paid', { id: 9, name: '#1002', email: 'agency@studio.com', line_items: [{ id: 21, sku: 'BP-AGENCY', quantity: 1 }, { id: 22, sku: 'BP-LICENSE', quantity: 3 }] });
  assert.equal(keys(9).length, 8);
  const licenceKeys = keys(9).filter((k) => k.line_item_id === '22');
  await api('licenses/validate', { key: licenceKeys[0].key, shop: 'one.myshopify.com' });
  await webhook('refunds/create', { order_id: 9, refund_line_items: [{ line_item_id: 22, quantity: 2, line_item: { id: 22, sku: 'BP-LICENSE' } }] });
  const now = keys(9).filter((k) => k.line_item_id === '22');
  assert.equal(now.find((k) => k.key === licenceKeys[0].key).status, 'active', 'the key in use is revoked last');
  assert.equal(now.filter((k) => k.status === 'revoked').length, 2);
  assert.equal((await webhook('orders/cancelled', { id: 9 })).revoked, 6);
  assert.ok(keys(9).every((k) => k.status === 'revoked'));
});

test('a key can move to another store, at most three times in 30 days', async () => {
  const { api, webhook, keys } = setup();
  await webhook('orders/paid', ORDER);
  const key = keys(ORDER.id)[0].key;
  const shops = ['a.myshopify.com', 'b.myshopify.com', 'c.myshopify.com', 'd.myshopify.com', 'e.myshopify.com'];
  assert.equal((await api('licenses/validate', { key, shop: shops[0] })).valid, true);
  for (let i = 1; i <= 3; i++) {
    assert.equal((await api('licenses/deactivate', { key, shop: shops[i - 1] })).ok, true);
    assert.equal((await api('licenses/validate', { key, shop: shops[i] })).valid, true);
  }
  const fourth = await api('licenses/deactivate', { key, shop: shops[3] });
  assert.equal(fourth.ok, false);
  assert.match(fourth.reason, /at most 3 transfers/);
  assert.equal((await api('licenses/deactivate', { key, shop: 'not-bound.myshopify.com' })).ok, false);
});

test('signed downloads expire and cannot be altered', async () => {
  const { api, webhook, keys, call } = setup();
  await webhook('orders/paid', ORDER);
  const key = keys(ORDER.id)[0].key;
  const { zip_url } = await api('releases/latest', { key, shop: 'verde-test.myshopify.com' });
  const url = new URL(zip_url);
  const ok = await call(url.pathname + url.search);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), 'ZIPBYTES');
  const tampered = new URL(url);
  tampered.searchParams.set('exp', String(Number(url.searchParams.get('exp')) + 3600));
  assert.equal((await call(tampered.pathname + tampered.search)).status, 403);
  const expired = new URL(url);
  expired.searchParams.set('exp', '1000');
  assert.equal((await call(expired.pathname + expired.search)).status, 403);
  assert.equal((await call(url.pathname.replace('1.0.0', '9.9.9') + url.search)).status, 403);
  assert.equal((await api('releases/manifest', { key, shop: 'verde-test.myshopify.com', version: '1.0.0' })).version, '1.0.0');
});

test('buyers sign in with a one-time email link and see their keys', async (t) => {
  const { webhook, call, keys } = setup();
  await webhook('orders/paid', ORDER);
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body) });
    return new Response('{}', { status: 200 });
  };
  t.after(() => (globalThis.fetch = realFetch));

  const form = (path, data, headers = {}) => call(path, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(data).toString() });
  const unknown = await form('/auth/link', { email: 'nobody@example.com' });
  assert.match(await unknown.text(), /If we have a Blueprint purchase/);
  assert.equal(sent.length, 0, 'no email for addresses without a purchase');
  const known = await form('/auth/link', { email: 'founder@brand.com' });
  assert.match(await known.text(), /If we have a Blueprint purchase/, 'same answer either way');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.to, 'founder@brand.com');
  const link = new URL(/https:\/\/portal\.test\/auth\/callback\?token=[0-9a-f]+/.exec(sent[0].body.text)[0]);

  const signedIn = await call(link.pathname + link.search);
  assert.equal(signedIn.status, 303);
  const cookie = signedIn.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
  assert.equal((await call(link.pathname + link.search)).status, 200, 'second use shows the expired page');
  assert.match(await (await call(link.pathname + link.search)).text(), /expired/);

  const session = cookie.split(';')[0];
  const accountPage = await (await call('/account', { headers: { cookie: session } })).text();
  for (const k of keys(ORDER.id)) assert.ok(accountPage.includes(k.key));
  assert.match(accountPage, /Download Blueprint 1\.0\.0/);
  assert.equal((await call('/account')).status, 303, 'signed out → sign-in page');

  // Moving a key needs the form's token.
  const key = keys(ORDER.id)[0].key;
  await call('/api/v1/licenses/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, shop: 'verde-test.myshopify.com' }) });
  assert.equal((await form('/account/deactivate', { csrf: 'f'.repeat(64), key, shop: 'verde-test.myshopify.com' }, { cookie: session })).status, 403);
  const csrf = /name="csrf" value="([0-9a-f]{64})"/.exec(await (await call('/account', { headers: { cookie: session } })).text())[1];
  assert.equal((await form('/account/deactivate', { csrf, key, shop: 'verde-test.myshopify.com' }, { cookie: session })).status, 303);
});

test('keys are random and well-formed', () => {
  const set = new Set(Array.from({ length: 500 }, newKey));
  assert.equal(set.size, 500);
});
