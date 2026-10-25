// Admin GraphQL access: tokens and an executor that only runs allow-listed operations.
//
// Two credentials, because Shopify refuses theme changes (themeDuplicate, themeFilesUpsert…)
// from apps without a special exemption, even with write_themes:
// - theme operations go through Shopify's Theme Access endpoint with a Theme Access password
//   (the free Theme Access app), the way Shopify CLI does;
// - everything else (products, metaobjects, pages) uses the merchant's Dev Dashboard app.

import { OPERATIONS, THEME_OPERATIONS, WRITE_OPERATIONS, type OperationName } from './operations.ts';

export const API_VERSION = '2026-07';
export const THEME_ACCESS_ENDPOINT = `https://theme-kit-access.shopifyapps.com/cli/admin/api/${API_VERSION}/graphql.json`;

export type Executor = (name: OperationName, variables?: Record<string, unknown>) => Promise<any>;
type Fetch = typeof fetch;

export interface Credentials {
  shop: string;
  // A Dev Dashboard app in the store's organization (client credentials grant)…
  clientId?: string;
  clientSecret?: string;
  // …or an Admin API access token (shpat_…).
  accessToken?: string;
}

// Client-credentials tokens last 24 hours; this one is refreshed a few minutes early.
export function tokenProvider(credentials: Credentials, fetchImpl: Fetch = fetch): () => Promise<string> {
  if (credentials.accessToken) {
    const token = credentials.accessToken;
    return async () => token;
  }
  if (!credentials.clientId || !credentials.clientSecret) return async () => {
    throw new Error('This needs the Blueprint app: set BLUEPRINT_CLIENT_ID and BLUEPRINT_CLIENT_SECRET (or BLUEPRINT_ADMIN_TOKEN).');
  };
  let token = '';
  let expires = 0;
  return async () => {
    if (token && Date.now() < expires) return token;
    const response = await fetchImpl(`https://${credentials.shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: credentials.clientId!, client_secret: credentials.clientSecret! }),
    });
    const text = await response.text();
    if (!response.ok) {
      const hint = /shop_not_permitted/.test(text) ? ' The app and the store must belong to the same organization in the Dev Dashboard.' : '';
      throw new Error(`Token request failed (${response.status}).${hint}`);
    }
    const body = JSON.parse(text) as { access_token: string; expires_in?: number };
    token = body.access_token;
    expires = Date.now() + Math.max(60, (body.expires_in ?? 86399) - 300) * 1000;
    return token;
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Theme operations use the Theme Access password when there is one. Without it, theme reads
// fall back to the app (read_themes is enough) and theme writes are refused with how to fix it.
export function adminExecutor(shop: string, token: () => Promise<string>, fetchImpl: Fetch = fetch, themePassword?: string): Executor {
  const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;
  return async (name, variables = {}) => {
    const query = OPERATIONS[name];
    if (!query) throw new Error(`Operation ${String(name)} is not allowed`);
    const viaThemeAccess = THEME_OPERATIONS.has(name) && Boolean(themePassword);
    if (THEME_OPERATIONS.has(name) && WRITE_OPERATIONS.has(name) && !themePassword) {
      throw new Error('Editing drafts needs a Theme Access password (BLUEPRINT_THEME_PASSWORD): Shopify only lets apps with a special exemption change themes. Install the free Theme Access app, create a password, and add it to the kit\'s settings (docs/ai-kit.md).');
    }
    for (let attempt = 0; ; attempt++) {
      const response = await fetchImpl(viaThemeAccess ? THEME_ACCESS_ENDPOINT : url, {
        method: 'POST',
        headers: viaThemeAccess
          ? { 'content-type': 'application/json', 'X-Shopify-Shop': shop, 'X-Shopify-Access-Token': themePassword! }
          : { 'content-type': 'application/json', 'x-shopify-access-token': await token() },
        body: JSON.stringify({ query, variables }),
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 4) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      const body = (await response.json().catch(() => ({}))) as { data?: any; errors?: any[] };
      if (body.errors?.some((e) => e?.extensions?.code === 'THROTTLED') && attempt < 6) {
        await sleep(2000);
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(viaThemeAccess ? `Shopify refused the Theme Access password (${response.status}): check BLUEPRINT_THEME_PASSWORD (${name}).` : `Admin API refused the request (${response.status}): check the app's access scopes (${name}).`);
      }
      if (!response.ok || body.errors) throw new Error(`Admin API error in ${name}: ${JSON.stringify(body.errors ?? response.status).slice(0, 400)}`);
      return body.data;
    }
  };
}

export function userErrors(label: string, payload: { userErrors?: { message: string; field?: string[] | null; filename?: string }[] } | null | undefined) {
  const errors = payload?.userErrors ?? [];
  if (errors.length) throw new Error(`${label}: ${errors.map((e) => [e.filename, (e.field ?? []).join('.'), e.message].filter(Boolean).join(' ')).join('; ')}`);
}
