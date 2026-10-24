// `blueprint update`: installs a new Blueprint version as an unpublished theme, with the
// merchant's settings, templates, section groups and translations carried over (docs/PLAN.md §13).
//
//  1. The licence key is checked with the Blueprint Portal for this shop, which returns the
//     latest release (a short-lived signed zip URL and its manifest) and the manifest of the
//     version the store runs.
//  2. The live theme's merchant files are read: config/settings_data.json, templates/*.json,
//     sections/*-group.json and locales/*.json (storefront translations).
//  3. Migrations between the two versions are applied (tools/lib/migrate.mjs).
//  4. Code files the merchant edited are found by comparing the live theme's checksums with
//     the running version's manifest. They are listed, not copied: the new version's code wins.
//  5. themeCreate makes an UNPUBLISHED theme from the zip; once Shopify has processed it, the
//     merchant files are written into it (at most 50 per call).
//  6. The merchant previews and publishes it. The old theme stays as the rollback.
//
// The live theme is only read. Nothing here can publish or delete a theme.
import { applyMigrations, migrationChain, parseThemeJson, stringifyThemeJson } from '../lib/migrate.mjs';
import { compareVersions } from '../lib/update-safety.mjs';

export const OPERATIONS = {
  Themes: `query Themes { themes(first: 50) { nodes { id name role processing } } }`,
  Theme: `query Theme($id: ID!) { theme(id: $id) { id name role processing processingFailed } }`,
  ThemeFileBodies: `query ThemeFileBodies($id: ID!, $filenames: [String!]!, $after: String) {
    theme(id: $id) {
      files(filenames: $filenames, first: 250, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { filename checksumMd5 body { ... on OnlineStoreThemeFileBodyText { content } } }
      }
    }
  }`,
  ThemeChecksums: `query ThemeChecksums($id: ID!, $after: String) {
    theme(id: $id) {
      files(first: 2500, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { filename checksumMd5 }
      }
    }
  }`,
  ThemeCreate: `mutation ThemeCreate($source: URL!, $name: String!) {
    themeCreate(source: $source, name: $name, role: UNPUBLISHED) { theme { id name role processing } userErrors { field message code } }
  }`,
  ThemeFilesUpsert: `mutation ThemeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
    themeFilesUpsert(themeId: $themeId, files: $files) { upsertedThemeFiles { filename } userErrors { filename code message } }
  }`,
};

export const MERCHANT_FILES = ['config/settings_data.json', 'templates/*.json', 'sections/*-group.json', 'locales/*.json'];
const isMerchantFile = (name) => name === 'config/settings_data.json' || /^templates\/[^/]+\.json$/.test(name) || /^sections\/[^/]+-group\.json$/.test(name) || (/^locales\/[^/]+\.json$/.test(name) && !name.endsWith('.schema.json'));

function errors(label, payload) {
  const list = payload?.userErrors ?? [];
  if (list.length) throw new Error(`${label}: ${list.map((e) => [e.filename, (e.field ?? []).join('.'), e.message].filter(Boolean).join(' ')).join('; ')}`);
}

async function paged(admin, op, variables, pick) {
  const out = [];
  let after = null;
  do {
    const data = await admin(op, { ...variables, after });
    const files = pick(data);
    if (!files) break;
    out.push(...files.nodes);
    after = files.pageInfo.hasNextPage ? files.pageInfo.endCursor : null;
  } while (after);
  return out;
}

// Deep merge for translations: the new release's keys, with the merchant's wording on top.
export function mergeLocale(release, merchant) {
  if (typeof release !== 'object' || release === null || Array.isArray(release)) return merchant ?? release;
  const out = { ...release };
  for (const [key, value] of Object.entries(merchant ?? {})) {
    out[key] = typeof value === 'object' && value !== null && !Array.isArray(value) ? mergeLocale(release[key] ?? {}, value) : value;
  }
  return out;
}

// The new theme's settings_data: the release's presets, with the merchant's current settings.
export function mergeSettingsData(releaseContent, merchantContent) {
  const release = parseThemeJson(releaseContent);
  const merchant = parseThemeJson(merchantContent);
  const current = merchant.json.current;
  release.json.current = typeof current === 'string' && !(release.json.presets && current in release.json.presets) ? release.json.current : current;
  return stringifyThemeJson(release.json, merchant.comment || release.comment);
}

export async function planUpdate({ admin, portal, key, shop, log = () => {} }) {
  const { themes } = await admin('Themes');
  const live = themes.nodes.find((t) => t.role === 'MAIN');
  if (!live) throw new Error('No published theme found.');

  const [schemaFile] = await paged(admin, 'ThemeFileBodies', { id: live.id, filenames: ['config/settings_schema.json'] }, (d) => d.theme?.files);
  const info = schemaFile ? JSON.parse(schemaFile.body.content).find((g) => g.name === 'theme_info') : null;
  if (info?.theme_name !== 'Blueprint') throw new Error(`The live theme "${live.name}" isn't Blueprint (theme_info says ${info?.theme_name ?? 'nothing'}).`);
  const from = info.theme_version;

  const licence = await portal.validate({ key, shop });
  if (!licence.valid) throw new Error(`Licence: ${licence.reason ?? 'not valid for this store'}`);
  const latest = await portal.latest({ key, shop });
  if (compareVersions(latest.version, from) <= 0) return { upToDate: true, live, from, to: latest.version };
  const running = await portal.manifest({ key, shop, version: from });

  log(`Live theme "${live.name}" runs Blueprint ${from}; latest is ${latest.version}.`);
  const bodies = await paged(admin, 'ThemeFileBodies', { id: live.id, filenames: MERCHANT_FILES }, (d) => d.theme?.files);
  const merchant = Object.fromEntries(bodies.filter((f) => isMerchantFile(f.filename) && f.body?.content !== undefined).map((f) => [f.filename, f.body.content]));

  const chain = migrationChain(latest.manifest.migrations ?? [], from, latest.version);
  const migrated = applyMigrations(merchant, chain);
  const carried = { ...merchant, ...migrated.files };

  // Code the merchant edited (or added) in the live theme.
  const checksums = await paged(admin, 'ThemeChecksums', { id: live.id }, (d) => d.theme?.files);
  const edited = [];
  const added = [];
  for (const file of checksums) {
    if (isMerchantFile(file.filename) || file.filename === 'config/settings_schema.json') continue;
    const original = running.files?.[file.filename];
    if (!original) added.push(file.filename);
    else if (file.checksumMd5 && original !== file.checksumMd5) edited.push(file.filename);
  }
  return { upToDate: false, live, from, to: latest.version, zipUrl: latest.zip_url, release: latest.manifest, merchant, carried, migrations: chain.map((m) => `${m.from} → ${m.to}: ${m.description ?? ''}`), migrationLog: migrated.log, editedCode: edited.sort(), customCode: added.sort() };
}

export async function applyUpdate(plan, { admin, log = () => {}, wait = (ms) => new Promise((r) => setTimeout(r, ms)), timeoutMs = 300_000 }) {
  const { themeCreate } = await admin('ThemeCreate', { source: plan.zipUrl, name: `Blueprint ${plan.to}` });
  errors('themeCreate', themeCreate);
  const theme = themeCreate.theme;
  log(`Created unpublished theme "${theme.name}"; waiting for Shopify to process it…`);
  const started = Date.now();
  for (;;) {
    const { theme: state } = await admin('Theme', { id: theme.id });
    if (state?.processingFailed) throw new Error('Shopify could not process the new theme zip.');
    if (state && !state.processing) break;
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for Shopify to process the theme.');
    await wait(3000);
  }
  if (!['UNPUBLISHED', 'DEVELOPMENT'].includes((await admin('Theme', { id: theme.id })).theme.role)) throw new Error('The new theme is not unpublished; stopping.');

  // The release's own copies of the merchant files, to merge settings_data and translations.
  const releaseFiles = Object.fromEntries((await paged(admin, 'ThemeFileBodies', { id: theme.id, filenames: MERCHANT_FILES }, (d) => d.theme?.files)).map((f) => [f.filename, f.body?.content ?? '']));
  const files = [];
  for (const [filename, content] of Object.entries(plan.carried)) {
    let value = content;
    if (filename === 'config/settings_data.json' && releaseFiles[filename]) value = mergeSettingsData(releaseFiles[filename], content);
    else if (filename.startsWith('locales/') && releaseFiles[filename]) value = stringifyThemeJson(mergeLocale(parseThemeJson(releaseFiles[filename]).json, parseThemeJson(content).json));
    if (value !== releaseFiles[filename]) files.push({ filename, body: { type: 'TEXT', value } });
  }
  for (let i = 0; i < files.length; i += 50) {
    const { themeFilesUpsert } = await admin('ThemeFilesUpsert', { themeId: theme.id, files: files.slice(i, i + 50) });
    errors('themeFilesUpsert', themeFilesUpsert);
  }
  return { theme, written: files.map((f) => f.filename) };
}
