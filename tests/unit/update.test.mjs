// Phase 8 acceptance (offline): updating a customised store from 1.0.0 to 1.0.1 preserves its
// settings and templates. Plus the release tooling: zips, manifests, update-safety and
// migrations.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyMigrations, migrationChain, validateMigration } from '../../tools/lib/migrate.mjs';
import { buildSchemaIndex } from '../../tools/lib/schema-index.mjs';
import { compareVersions, updateSafetyProblems } from '../../tools/lib/update-safety.mjs';
import { createZip, readZip } from '../../tools/lib/zip.mjs';
import { buildRelease, checkRelease, THEME_DIRS, themeFiles } from '../../tools/release.mjs';
import { applyUpdate, mergeLocale, planUpdate } from '../../tools/update/updater.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const md5 = (text) => createHash('md5').update(text).digest('hex');
const repoFiles = () => Object.fromEntries(themeFiles(root).map((name) => [name, readFileSync(join(root, name), 'utf8')]));

// A synthetic 1.0.1: a new main-product setting (on for existing stores via migration), a new
// translation, a new template and a new theme setting.
function release101() {
  const files = repoFiles();
  files['config/settings_schema.json'] = files['config/settings_schema.json'].replace('"theme_version": "1.0.0"', '"theme_version": "1.0.1"');
  files['sections/main-product.liquid'] = files['sections/main-product.liquid'].replace('"settings": [', '"settings": [\n    { "type": "checkbox", "id": "show_trust_line", "label": "Trust line", "default": false },');
  const locale = JSON.parse(files['locales/en.default.json']);
  locale.products.trust_line = 'Ships in 24 hours';
  files['locales/en.default.json'] = `${JSON.stringify(locale, null, 2)}\n`;
  files['templates/page.faq.json'] = `${JSON.stringify({ sections: { main: { type: 'main-page', settings: {} } }, order: ['main'] }, null, 2)}\n`;
  const migration = {
    from: '1.0.0',
    to: '1.0.1',
    description: 'Trust line under the buy button, on for existing stores',
    operations: [
      { op: 'section_setting_default', section: 'main-product', setting: 'show_trust_line', value: true },
      { op: 'theme_setting_default', setting: 'cart_secure_text', value: 'Secure checkout' },
    ],
  };
  return { files, migration };
}

const manifestOf = (version, files, migrations = []) => ({ version, files: Object.fromEntries(Object.entries(files).map(([n, c]) => [n, md5(c)])), migrations });

function fakeStore(liveFiles, zips) {
  const themes = [{ id: 'gid://shopify/OnlineStoreTheme/1', name: 'Blueprint', role: 'MAIN', processing: false, files: liveFiles }];
  const calls = [];
  let next = 2;
  const theme = (id) => themes.find((t) => t.id === id);
  const match = (patterns, name) => patterns.some((p) => new RegExp(`^${p.replace(/[.]/g, '\\.').replace(/\*/g, '[^/]*')}$`).test(name));
  const handlers = {
    Themes: () => ({ themes: { nodes: themes.map(({ files, ...t }) => t) } }),
    Theme: ({ id }) => {
      const t = theme(id);
      const out = t ? { id: t.id, name: t.name, role: t.role, processing: t.processing, processingFailed: false } : null;
      if (t?.processing) t.processing = false; // processed by the next poll
      return { theme: out };
    },
    ThemeFileBodies: ({ id, filenames }) => ({ theme: { files: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: Object.entries(theme(id).files).filter(([n]) => match(filenames, n)).map(([filename, content]) => ({ filename, checksumMd5: md5(content), body: { content } })) } } }),
    ThemeChecksums: ({ id }) => ({ theme: { files: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: Object.entries(theme(id).files).map(([filename, content]) => ({ filename, checksumMd5: md5(content) })) } } }),
    ThemeCreate: ({ source, name }) => {
      const files = Object.fromEntries([...readZip(zips[source])].map(([n, b]) => [n, b.toString('utf8')]));
      const t = { id: `gid://shopify/OnlineStoreTheme/${next++}`, name, role: 'UNPUBLISHED', processing: true, files };
      themes.push(t);
      return { themeCreate: { theme: { id: t.id, name, role: t.role, processing: true }, userErrors: [] } };
    },
    ThemeFilesUpsert: ({ themeId, files }) => {
      for (const f of files) theme(themeId).files[f.filename] = f.body.value;
      return { themeFilesUpsert: { upsertedThemeFiles: files.map((f) => ({ filename: f.filename })), userErrors: [] } };
    },
  };
  const admin = async (name, variables = {}) => {
    calls.push({ name, variables });
    return structuredClone(handlers[name](variables));
  };
  return { admin, themes, calls, theme };
}

test('acceptance: updating a customised store from 1.0.0 to 1.0.1 preserves its settings and templates', async () => {
  const v100 = repoFiles();
  const { files: v101, migration } = release101();

  // The merchant's customised live theme (1.0.0).
  const live = structuredClone(v100);
  const settings = JSON.parse(live['config/settings_data.json']);
  settings.current = { ...settings.presets.Clinical, accent_color: '#7A1F5C', cart_reward_1_threshold: 65 };
  delete settings.current.cart_secure_text;
  live['config/settings_data.json'] = `/* edited in the theme editor */\n${JSON.stringify(settings, null, 2)}\n`;
  const product = JSON.parse(live['templates/product.json']);
  const firstBlock = product.sections.main.block_order[0];
  product.sections.main.blocks[firstBlock].settings = { ...product.sections.main.blocks[firstBlock].settings, merchant_marker: 'kept' };
  product.sections.main.settings.show_trust_line = false; // the merchant already chose: the migration must not override
  live['templates/product.json'] = JSON.stringify(product, null, 2);
  live['templates/page.custom.json'] = JSON.stringify({ sections: { main: { type: 'main-page', settings: { padding_top: 8 } } }, order: ['main'] });
  const locale = JSON.parse(live['locales/en.default.json']);
  locale.products.add_to_cart = 'Get mine';
  live['locales/en.default.json'] = JSON.stringify(locale, null, 2);
  live['snippets/icon.liquid'] += '\n{%- comment -%} merchant edit {%- endcomment -%}';
  live['snippets/merchant-badge.liquid'] = '<span>Hand-made</span>';
  const liveBefore = structuredClone(live);

  const zipUrl = 'https://portal.example/download/blueprint-1.0.1.zip?sig=abc';
  const store = fakeStore(live, { [zipUrl]: createZip(Object.entries(v101).map(([name, data]) => ({ name, data }))) });
  const portal = {
    validate: async ({ key, shop }) => ({ valid: key === 'BP-TEST-KEY' && shop === 'verde.myshopify.com' }),
    latest: async () => ({ version: '1.0.1', zip_url: zipUrl, manifest: manifestOf('1.0.1', v101, [migration]) }),
    manifest: async ({ version }) => (version === '1.0.0' ? manifestOf('1.0.0', v100) : null),
  };

  await assert.rejects(() => planUpdate({ admin: store.admin, portal, key: 'WRONG', shop: 'verde.myshopify.com' }), /Licence/);
  const plan = await planUpdate({ admin: store.admin, portal, key: 'BP-TEST-KEY', shop: 'verde.myshopify.com' });
  assert.equal(plan.from, '1.0.0');
  assert.equal(plan.to, '1.0.1');
  assert.deepEqual(plan.editedCode, ['snippets/icon.liquid']);
  assert.deepEqual(plan.customCode, ['snippets/merchant-badge.liquid']);

  const result = await applyUpdate(plan, { admin: store.admin, wait: async () => {} });
  const updated = store.theme(result.theme.id);
  assert.equal(updated.role, 'UNPUBLISHED');
  assert.equal(result.theme.name, 'Blueprint 1.0.1');

  // Theme settings: the merchant's, migrated; presets from the new version.
  const newSettings = JSON.parse(updated.files['config/settings_data.json'].replace(/^\/\*[\s\S]*?\*\/\s*/, ''));
  assert.equal(newSettings.current.accent_color, '#7A1F5C');
  assert.equal(newSettings.current.cart_reward_1_threshold, 65);
  assert.equal(newSettings.current.cart_secure_text, 'Secure checkout', 'migration filled the new value');
  assert.deepEqual(Object.keys(newSettings.presets), Object.keys(JSON.parse(v101['config/settings_data.json']).presets));

  // Templates: the merchant's, with migrations applied only where they had no value.
  const newProduct = JSON.parse(updated.files['templates/product.json']);
  assert.equal(newProduct.sections.main.blocks[firstBlock].settings.merchant_marker, 'kept');
  assert.equal(newProduct.sections.main.settings.show_trust_line, false, "the merchant's choice wins");
  assert.ok(updated.files['templates/page.custom.json'], "the merchant's own template is carried over");
  assert.ok(updated.files['templates/page.faq.json'], "the new version's template is there");
  for (const name of Object.keys(v100).filter((n) => /^(templates\/.+|sections\/.+-group)\.json$/.test(n) && n !== 'templates/product.json')) {
    assert.deepEqual(JSON.parse(updated.files[name]), JSON.parse(live[name]), `${name} carried over unchanged`);
  }

  // Translations: the merchant's wording and the new keys.
  const newLocale = JSON.parse(updated.files['locales/en.default.json']);
  assert.equal(newLocale.products.add_to_cart, 'Get mine');
  assert.equal(newLocale.products.trust_line, 'Ships in 24 hours');

  // Code comes from the new version; the live theme was only read.
  assert.equal(updated.files['snippets/icon.liquid'], v101['snippets/icon.liquid']);
  assert.equal(updated.files['sections/main-product.liquid'], v101['sections/main-product.liquid']);
  assert.deepEqual(store.theme('gid://shopify/OnlineStoreTheme/1').files, liveBefore);
  assert.equal(store.theme('gid://shopify/OnlineStoreTheme/1').role, 'MAIN');
  assert.ok(store.calls.filter((c) => c.name === 'ThemeFilesUpsert').every((c) => c.variables.themeId === result.theme.id));

  // Up to date afterwards (once the merchant publishes 1.0.1).
  store.theme('gid://shopify/OnlineStoreTheme/1').role = 'UNPUBLISHED';
  updated.role = 'MAIN';
  assert.equal((await planUpdate({ admin: store.admin, portal, key: 'BP-TEST-KEY', shop: 'verde.myshopify.com' })).upToDate, true);
});

test('migrations are idempotent, ordered and validated', () => {
  const { migration } = release101();
  const files = { 'templates/product.json': readFileSync(join(root, 'templates/product.json'), 'utf8'), 'config/settings_data.json': readFileSync(join(root, 'config/settings_data.json'), 'utf8') };
  const once = applyMigrations(files, [migration]);
  assert.ok(once.log.length >= 2);
  const twice = applyMigrations({ ...files, ...once.files }, [migration]);
  assert.deepEqual(twice.files, {});
  const chain = migrationChain([{ from: '1.0.1', to: '1.0.2', operations: [] }, migration, { from: '1.1.0', to: '1.2.0', operations: [] }], '1.0.0', '1.0.2');
  assert.deepEqual(chain.map((m) => m.to), ['1.0.1', '1.0.2']);
  assert.deepEqual(validateMigration(migration), []);
  assert.ok(validateMigration({ from: '1.0.1', to: '1.0.0', operations: [{ op: 'rename_setting' }] }).length >= 2);
  // add_block / add_section only when missing.
  const added = applyMigrations(files, [{ from: '1.0.0', to: '1.0.1', operations: [{ op: 'add_section', file: 'templates/product.json', section_id: 'faq_new', section: { type: 'faq', settings: {} }, after: 'main' }] }]);
  const json = JSON.parse(added.files['templates/product.json']);
  assert.equal(json.order[json.order.indexOf('main') + 1], 'faq_new');
  assert.deepEqual(applyMigrations({ ...files, ...added.files }, [{ from: '1.0.0', to: '1.0.1', operations: [{ op: 'add_section', file: 'templates/product.json', section_id: 'faq_new', section: { type: 'faq' } }] }]).files, {});
  assert.deepEqual(mergeLocale({ a: { b: 'new', c: 'release' } }, { a: { b: 'merchant' }, x: 'custom' }), { a: { b: 'merchant', c: 'release' }, x: 'custom' });
});

test('update safety: removals, type changes, lowered limits and tightened ranges are caught', () => {
  const baseline = buildSchemaIndex(root);
  assert.deepEqual(updateSafetyProblems(baseline, baseline), []);
  const changed = structuredClone(baseline);
  delete changed.sections.faq;
  changed.sections.hero.settings = changed.sections.hero.settings.filter((s) => s.id !== 'heading');
  const range = changed.sections.listicle.settings.find((s) => s.type === 'range');
  range.max -= 1;
  const select = changed.sections.listicle.settings.find((s) => s.type === 'select');
  select.options = select.options.slice(1);
  changed.sections['article-body'].max_blocks = 10;
  changed.settings.find((s) => s.id === 'accent_color').type = 'text';
  delete changed.blocks['product-price'];
  const problems = updateSafetyProblems(baseline, changed).join('\n');
  for (const expected of ['sections/faq.liquid was removed', 'setting "heading" was removed', `max lowered`, 'lost option', 'max_blocks lowered 40 → 10', 'accent_color" changed type', 'blocks/product-price.liquid was removed']) assert.match(problems, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  // Additions are fine.
  const added = structuredClone(baseline);
  added.sections.hero.settings.push({ id: 'new_one', type: 'checkbox' });
  added.sections.extra = { name: 'Extra', settings: [], blocks: [] };
  assert.deepEqual(updateSafetyProblems(baseline, added), []);
  assert.ok(compareVersions('1.0.10', '1.0.9') > 0 && compareVersions('1.0.0', '1.0.0-rc.1') > 0);
});

test('release: version stamps checked, zip holds only the theme, manifest records checksums', () => {
  assert.deepEqual(checkRelease(root).problems, []);
  const dir = mkdtempSync(join(tmpdir(), 'bp-release-'));
  for (const folder of [...THEME_DIRS, 'migrations']) cpSync(join(root, folder), join(dir, folder), { recursive: true });
  for (const file of ['package.json', 'CHANGELOG.md']) cpSync(join(root, file), join(dir, file));
  writeFileSync(join(dir, 'CHANGELOG.md'), readFileSync(join(dir, 'CHANGELOG.md'), 'utf8').replace('## [1.0.0] - Unreleased', '## [1.0.0] - 2026-11-02'));
  const built = buildRelease(dir);
  const zip = readZip(readFileSync(built.zipPath));
  assert.ok([...zip.keys()].every((n) => THEME_DIRS.some((d) => n.startsWith(`${d}/`))), 'theme folders only');
  assert.equal(zip.get('layout/theme.liquid').toString(), readFileSync(join(root, 'layout/theme.liquid'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(dir, 'release/1.0.0/manifest.json'), 'utf8'));
  assert.equal(manifest.files['layout/theme.liquid'], md5(readFileSync(join(root, 'layout/theme.liquid'))));
  assert.equal(manifest.date, '2026-11-02');

  // The next version must be update-safe against this one, and stamped consistently.
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ ...pkg, version: '1.0.1' }));
  assert.match(checkRelease(dir).problems.join('\n'), /theme_version is 1\.0\.0[\s\S]*no "## \[1\.0\.1\]"/);
  const schema = readFileSync(join(dir, 'config/settings_schema.json'), 'utf8').replace('"theme_version": "1.0.0"', '"theme_version": "1.0.1"');
  writeFileSync(join(dir, 'config/settings_schema.json'), schema);
  writeFileSync(join(dir, 'CHANGELOG.md'), `## [1.0.1] - 2026-12-01\n\n${readFileSync(join(dir, 'CHANGELOG.md'), 'utf8')}`);
  assert.deepEqual(checkRelease(dir).problems, []);
  const hero = join(dir, 'sections/hero.liquid');
  writeFileSync(hero, readFileSync(hero, 'utf8').replace('"id": "eyebrow"', '"id": "kicker"'));
  assert.match(checkRelease(dir).problems.join('\n'), /not update-safe vs 1\.0\.0: sections\/hero\.liquid: setting "eyebrow" was removed/);
});

test('the CLI runs the whole update over HTTP: Theme Access (allow-listed operations) and Portal', async () => {
  const { main } = await import('../../tools/update/cli.mjs');
  const { files: v101, migration } = release101();
  const v100 = repoFiles();
  const zipUrl = 'https://portal.test/download/1.0.1?k=x&exp=9999999999&sig=y';
  const store = fakeStore(structuredClone(v100), { [zipUrl]: createZip(Object.entries(v101).map(([name, data]) => ({ name, data }))) });
  const sent = [];
  const fetchImpl = async (url, init) => {
    sent.push(String(url));
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
    if (url === 'https://theme-kit-access.shopifyapps.com/cli/admin/api/2026-07/graphql.json') {
      const { query, variables } = JSON.parse(init.body);
      assert.equal(init.headers['X-Shopify-Access-Token'], 'shptka_test');
      assert.equal(init.headers['X-Shopify-Shop'], 'verde.myshopify.com');
      const name = /(?:query|mutation)\s+(\w+)/.exec(query)[1];
      return reply({ data: await store.admin(name, variables) });
    }
    if (url === 'https://portal.test/api/v1/licenses/validate') return reply({ valid: true });
    if (url === 'https://portal.test/api/v1/releases/latest') return reply({ version: '1.0.1', zip_url: zipUrl, manifest: manifestOf('1.0.1', v101, [migration]) });
    if (url === 'https://portal.test/api/v1/releases/manifest') return reply(manifestOf('1.0.0', v100));
    return reply({ error: 'unexpected' }, 404);
  };
  const env = { BLUEPRINT_SHOP: 'verde.myshopify.com', BLUEPRINT_LICENSE_KEY: 'BP-TEST', BLUEPRINT_THEME_PASSWORD: 'shptka_test', BLUEPRINT_PORTAL_URL: 'https://portal.test' };
  const lines = [];
  assert.equal(await main([], { ...env, BLUEPRINT_THEME_PASSWORD: '' }, { fetchImpl, log: (l) => lines.push(l) }), 2, 'no password, no update');
  assert.match(lines.pop(), /BLUEPRINT_THEME_PASSWORD/);
  assert.equal(await main(['--dry-run'], env, { fetchImpl, log: (l) => lines.push(l) }), 0);
  assert.equal(store.themes.length, 1, 'dry run creates nothing');
  assert.match(lines.join('\n'), /Update Blueprint 1\.0\.0 → 1\.0\.1/);
  assert.equal(await main([], env, { fetchImpl, log: (l) => lines.push(l), ask: async () => 'n' }), 0);
  assert.equal(store.themes.length, 1, 'declined');
  assert.equal(await main(['--yes'], env, { fetchImpl, log: (l) => lines.push(l) }), 0);
  assert.equal(store.themes.length, 2);
  assert.equal(store.themes[1].role, 'UNPUBLISHED');
  assert.match(lines.at(-2), /"Blueprint 1\.0\.1" is ready and unpublished/);
  assert.ok(sent.every((u) => u.startsWith('https://theme-kit-access.shopifyapps.com/') || u.startsWith('https://portal.test/')));
});
