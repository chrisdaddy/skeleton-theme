// The `blueprint update` command, self-contained (no imports beyond the updater), so it runs
// from this repository (tools/blueprint.mjs) and from the AI-kit package (npx -y @blueprint/mcp update).
//
// Environment:
//   BLUEPRINT_SHOP                   your-store.myshopify.com
//   BLUEPRINT_LICENSE_KEY            from the Blueprint Portal
//   BLUEPRINT_THEME_PASSWORD         a Theme Access password (the free Theme Access app)
//   BLUEPRINT_PORTAL_URL             default https://portal.blueprinttheme.com
//
// Why a Theme Access password: Shopify refuses theme changes (themeCreate, themeFilesUpsert)
// from apps without a special exemption, even with write_themes. A Theme Access password
// can make them, through the endpoint Shopify CLI uses for it. It covers themes only, which
// is all the updater touches. An Admin API token from an exempt app (BLUEPRINT_ADMIN_TOKEN)
// also works.
import { createInterface } from 'node:readline/promises';
import { applyUpdate, OPERATIONS, planUpdate } from './updater.mjs';

const API_VERSION = '2026-07';
export const THEME_ACCESS_ENDPOINT = `https://theme-kit-access.shopifyapps.com/cli/admin/api/${API_VERSION}/graphql.json`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function portalClient(base = 'https://portal.blueprinttheme.com', fetchImpl = fetch) {
  const post = async (path, body) => {
    const response = await fetchImpl(`${base}/api/v1/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Portal: ${data.error ?? response.status}`);
    return data;
  };
  return {
    validate: (body) => post('licenses/validate', body),
    latest: (body) => post('releases/latest', body),
    manifest: (body) => post('releases/manifest', body),
  };
}

// Where theme operations go: a Theme Access password through Shopify's Theme Access endpoint,
// or an exempt app's Admin API token straight to the store.
export function themeAccess(env, shop) {
  if (env.BLUEPRINT_THEME_PASSWORD) return { url: THEME_ACCESS_ENDPOINT, headers: { 'X-Shopify-Shop': shop, 'X-Shopify-Access-Token': env.BLUEPRINT_THEME_PASSWORD } };
  if (env.BLUEPRINT_ADMIN_TOKEN) return { url: `https://${shop}/admin/api/${API_VERSION}/graphql.json`, headers: { 'X-Shopify-Access-Token': env.BLUEPRINT_ADMIN_TOKEN } };
  return null;
}

// Runs only the updater's allow-listed operations.
export function adminFor(access, fetchImpl = fetch) {
  return async (name, variables = {}) => {
    const query = OPERATIONS[name];
    if (!query) throw new Error(`Operation ${name} is not allowed`);
    for (let attempt = 0; ; attempt++) {
      const response = await fetchImpl(access.url, { method: 'POST', headers: { 'content-type': 'application/json', ...access.headers }, body: JSON.stringify({ query, variables }) });
      if ((response.status === 429 || response.status >= 500) && attempt < 4) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      const body = await response.json().catch(() => ({}));
      if (body.errors?.some((e) => e?.extensions?.code === 'THROTTLED') && attempt < 6) {
        await sleep(2000);
        continue;
      }
      if (response.status === 401 || response.status === 403) throw new Error(`Shopify refused the Theme Access password (${response.status}). Check BLUEPRINT_THEME_PASSWORD and BLUEPRINT_SHOP.`);
      if (!response.ok || body.errors) throw new Error(`Admin API error in ${name}: ${JSON.stringify(body.errors ?? response.status).slice(0, 300)}`);
      return body.data;
    }
  };
}

export async function main(args, env = process.env, { fetchImpl = fetch, log = console.log, ask } = {}) {
  const shop = String(env.BLUEPRINT_SHOP ?? '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const access = themeAccess(env, shop);
  if (!shop || !env.BLUEPRINT_LICENSE_KEY || !access) {
    log('Set BLUEPRINT_SHOP, BLUEPRINT_LICENSE_KEY and BLUEPRINT_THEME_PASSWORD (a Theme Access password). See the update guide.');
    return 2;
  }
  const admin = adminFor(access, fetchImpl);
  const portal = portalClient(env.BLUEPRINT_PORTAL_URL ?? 'https://portal.blueprinttheme.com', fetchImpl);
  const plan = await planUpdate({ admin, portal, key: env.BLUEPRINT_LICENSE_KEY, shop, log });
  if (plan.upToDate) {
    log(`Blueprint ${plan.from} is up to date (latest: ${plan.to}).`);
    return 0;
  }
  log(`\nUpdate Blueprint ${plan.from} → ${plan.to}`);
  log(`- Carries over ${Object.keys(plan.carried).length} files: your settings, templates, section groups and translations.`);
  for (const line of plan.migrations) log(`- Migration ${line}`);
  for (const line of plan.migrationLog) log(`    ${line}`);
  if (plan.editedCode.length) log(`\nCode you edited in the live theme is NOT carried over (the new version's code is used). Re-apply these edits if you still need them:\n${plan.editedCode.map((f) => `  ${f}`).join('\n')}`);
  if (plan.customCode.length) log(`\nFiles you added to the live theme are not copied:\n${plan.customCode.map((f) => `  ${f}`).join('\n')}`);
  if (args.includes('--dry-run')) return 0;
  if (!args.includes('--yes')) {
    const question = ask ?? (async (q) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await rl.question(q);
      rl.close();
      return answer;
    });
    if (!/^y(es)?$/i.test(String(await question('\nCreate the updated theme (unpublished)? [y/N] ')).trim())) return 0;
  }
  const result = await applyUpdate(plan, { admin, log });
  log(`\nDone: "${result.theme.name}" is ready and unpublished. Preview: https://${shop}/?preview_theme_id=${result.theme.id.split('/').pop()}`);
  log('Check it in the theme editor, then publish it in Online Store → Themes. Your current theme stays as the rollback.');
  return 0;
}
