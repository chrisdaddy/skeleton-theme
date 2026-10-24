// Admin GraphQL client for the demo seed.
//
// Auth: the client credentials grant for a Dev Dashboard app in the same Shopify organization
// as the dev stores (https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant).
// The app's client ID and secret come from the environment; tokens last 24 hours and are
// requested per run, never stored. An Admin API access token can be passed instead.

export const API_VERSION = '2026-07';

export async function clientCredentialsToken(shop, clientId, clientSecret, fetchImpl = fetch) {
  const response = await fetchImpl(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  const text = await response.text();
  if (!response.ok) {
    const hint = /shop_not_permitted/.test(text) ? ' The app and the store must be in the same organization in the Dev Dashboard.' : '';
    throw new Error(`Token request for ${shop} failed (${response.status}).${hint}`);
  }
  return JSON.parse(text).access_token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Returns gql(query, variables) → data. Retries throttling and 5xx with backoff; throws on
// GraphQL errors. userErrors are the caller's to check (see assertNoUserErrors).
export function adminClient({ shop, token, version = API_VERSION, fetchImpl = fetch, log = () => {} }) {
  const url = `https://${shop}/admin/api/${version}/graphql.json`;
  return async function gql(query, variables = {}) {
    for (let attempt = 0; ; attempt++) {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-shopify-access-token': token },
        body: JSON.stringify({ query, variables }),
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 5) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      const body = await response.json().catch(() => ({}));
      const throttled = body.errors?.some((e) => e.extensions?.code === 'THROTTLED');
      if (throttled && attempt < 8) {
        const status = body.extensions?.cost?.throttleStatus;
        const wait = status ? Math.ceil(((body.extensions.cost.requestedQueryCost ?? 100) - status.currentlyAvailable) / status.restoreRate) * 1000 : 2000;
        log(`  throttled, waiting ${Math.max(wait, 1000)} ms`);
        await sleep(Math.max(wait, 1000));
        continue;
      }
      if (!response.ok || body.errors) throw new Error(`Admin API ${response.status}: ${JSON.stringify(body.errors ?? body).slice(0, 500)}`);
      return body.data;
    }
  };
}

export function assertNoUserErrors(label, payload) {
  const errors = payload?.userErrors ?? [];
  if (errors.length) throw new Error(`${label}: ${errors.map((e) => `${(e.field || []).join('.')} ${e.message}`.trim()).join('; ')}`);
  return payload;
}
