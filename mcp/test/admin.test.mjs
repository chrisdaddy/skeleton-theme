// Which credential each Admin operation uses: theme operations go through Shopify's Theme
// Access endpoint with the Theme Access password (apps without Shopify's exemption can't
// change themes, verified on a dev store); everything else uses the app's token.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminExecutor, THEME_ACCESS_ENDPOINT, tokenProvider } from '../dist/admin.js';

function recorder() {
  const sent = [];
  const fetchImpl = async (url, init) => {
    sent.push({ url: String(url), headers: init.headers, name: /(?:query|mutation)\s+(\w+)/.exec(JSON.parse(init.body).query)[1] });
    return new Response(JSON.stringify({ data: {} }), { status: 200 });
  };
  return { sent, fetchImpl };
}

test('theme operations use the Theme Access password; the rest use the app', async () => {
  const { sent, fetchImpl } = recorder();
  let tokenCalls = 0;
  const admin = adminExecutor('verde.myshopify.com', async () => (tokenCalls++, 'app-token'), fetchImpl, 'shptka_secret');
  await admin('ThemeDuplicate', { id: 'gid://shopify/OnlineStoreTheme/1', name: 'Draft' });
  await admin('ThemeFilesUpsert', { themeId: 'gid://shopify/OnlineStoreTheme/2', files: [] });
  await admin('Themes');
  assert.equal(tokenCalls, 0, 'no app token needed for theme work');
  for (const call of sent) {
    assert.equal(call.url, THEME_ACCESS_ENDPOINT);
    assert.equal(call.headers['X-Shopify-Shop'], 'verde.myshopify.com');
    assert.equal(call.headers['X-Shopify-Access-Token'], 'shptka_secret');
  }
  await admin('Products', { first: 1 });
  await admin('PageCreate', { page: {} });
  assert.deepEqual(sent.slice(3).map((c) => [c.url, c.headers['x-shopify-access-token']]), [
    ['https://verde.myshopify.com/admin/api/2026-07/graphql.json', 'app-token'],
    ['https://verde.myshopify.com/admin/api/2026-07/graphql.json', 'app-token'],
  ]);
});

test('without a Theme Access password, theme reads use the app and theme writes explain what to do', async () => {
  const { sent, fetchImpl } = recorder();
  const admin = adminExecutor('verde.myshopify.com', async () => 'app-token', fetchImpl);
  await admin('Themes');
  assert.equal(sent[0].url, 'https://verde.myshopify.com/admin/api/2026-07/graphql.json');
  await assert.rejects(() => admin('ThemeDuplicate', { id: 'x', name: 'y' }), /BLUEPRINT_THEME_PASSWORD.*Theme Access app/s);
  await assert.rejects(() => admin('ThemeFilesUpsert', { themeId: 'x', files: [] }), /Theme Access password/);
  assert.equal(sent.length, 1, 'nothing was sent for the refused writes');
});

test('without app credentials, only non-theme operations fail, and they say why', async () => {
  const { fetchImpl } = recorder();
  const admin = adminExecutor('verde.myshopify.com', tokenProvider({ shop: 'verde.myshopify.com' }), fetchImpl, 'shptka_secret');
  await admin('ThemeFiles', { id: 'x', filenames: [] });
  await assert.rejects(() => admin('Products', { first: 1 }), /BLUEPRINT_CLIENT_ID/);
});
