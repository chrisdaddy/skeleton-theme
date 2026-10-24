// The AI kit's safety rails, tested on the compiled server (npm test builds first).
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { adminExecutor } from '../dist/admin.js';
import { OPERATIONS, WRITE_OPERATIONS } from '../dist/operations.js';
import { assertAllowedFile, Planner, RailError } from '../dist/rails.js';
import { DraftRegistry } from '../dist/registry.js';
import { validateFile } from '../dist/validate.js';
import { fakeShopify } from './fake-shopify.mjs';

const pkg = fileURLToPath(new URL('../', import.meta.url));
const repo = join(pkg, '..');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

test('the server cannot publish or delete a theme: neither mutation exists in the source or the build', () => {
  for (const file of [...walk(join(pkg, 'src')), ...walk(join(pkg, 'dist'))]) {
    const text = readFileSync(file, 'utf8');
    assert.ok(!/\btheme(Publish|Delete)\b/.test(text), `${file.replace(pkg, '')} mentions a forbidden mutation`);
  }
});

test('only allow-listed operations run', async () => {
  const sent = [];
  const fetchImpl = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ data: { ok: true } }), { status: 200 });
  };
  const run = adminExecutor('x.myshopify.com', async () => 'token', fetchImpl);
  await run('Themes');
  assert.equal(sent[0].query, OPERATIONS.Themes);
  await assert.rejects(() => run('themePublish'), /not allowed/);
  await assert.rejects(() => run('ThemeCreate'), /not allowed/);
  assert.equal(sent.length, 1);
  for (const name of WRITE_OPERATIONS) assert.ok(OPERATIONS[name], name);
});

test('every operation is valid against the published Admin schema (when cached)', async (t) => {
  const cache = join(repo, 'tools/demo/.cache/admin-2026-07.json');
  if (!existsSync(cache)) return t.skip('no cached schema: run `node tools/demo/validate-operations.mjs` once (needs network)');
  const { buildClientSchema, parse, validate } = await import('graphql');
  const schema = buildClientSchema(JSON.parse(readFileSync(cache, 'utf8')).data);
  for (const [name, doc] of Object.entries(OPERATIONS)) {
    const errors = validate(schema, parse(doc));
    assert.deepEqual(errors.map((e) => e.message), [], name);
  }
});

test('only templates, section groups and settings_data.json are editable', () => {
  for (const ok of ['templates/product.json', 'templates/page.listicle-spring.json', 'sections/header-group.json', 'config/settings_data.json']) assert.doesNotThrow(() => assertAllowedFile(ok), ok);
  for (const bad of ['layout/theme.liquid', 'templates/gift_card.liquid', 'snippets/x.liquid', 'assets/base.css', 'config/settings_schema.json', 'sections/hero.liquid', 'templates/../layout/theme.liquid', 'locales/en.default.json']) {
    assert.throws(() => assertAllowedFile(bad), RailError, bad);
  }
});

test("every template, group and settings file Blueprint ships passes the validator", () => {
  const files = [
    ...readdirSync(join(repo, 'templates')).filter((f) => f.endsWith('.json')).map((f) => [`templates/${f}`, join(repo, 'templates', f)]),
    ...readdirSync(join(repo, 'sections')).filter((f) => f.endsWith('.json')).map((f) => [`sections/${f}`, join(repo, 'sections', f)]),
    ['config/settings_data.json', join(repo, 'config/settings_data.json')],
    ...['clinical', 'editorial', 'bold'].flatMap((l) => readdirSync(join(repo, 'listings', l, 'templates')).map((f) => [`templates/${f}`, join(repo, 'listings', l, 'templates', f)])),
  ];
  for (const [name, path] of files) assert.deepEqual(validateFile(name, readFileSync(path, 'utf8')), [], name);
});

test('the validator catches what the theme editor would reject', () => {
  const product = JSON.parse(readFileSync(join(repo, 'templates/product.json'), 'utf8'));
  const errors = (mutate) => {
    const copy = structuredClone(product);
    mutate(copy);
    return validateFile('templates/product.json', JSON.stringify(copy)).join('\n');
  };
  assert.match(errors((t) => (t.sections.main.type = 'no-such-section')), /no such Blueprint section/);
  assert.match(errors((t) => (t.sections.main.settings.made_up = 1)), /unknown setting "made_up"/);
  assert.match(errors((t) => t.order.push('ghost')), /missing section "ghost"/);
  const block = Object.keys(product.sections.main.blocks)[0];
  assert.match(errors((t) => (t.sections.main.blocks[block].type = 'not-a-block')), /block type not allowed/);
  assert.match(errors((t) => (t.sections.main.blocks[block].settings = { nonsense: true })), /unknown setting "nonsense"/);
  const settings = JSON.parse(readFileSync(join(repo, 'config/settings_data.json'), 'utf8'));
  settings.current = { ...settings.presets.Clinical, corners: 'wobbly', section_spacing: 9999, accent_color: 'green' };
  const bad = validateFile('config/settings_data.json', JSON.stringify(settings)).join('\n');
  assert.match(bad, /corners/);
  assert.match(bad, /section_spacing/);
  assert.match(bad, /accent_color/);
  assert.match(validateFile('templates/index.json', '{ not json').join(''), /not valid JSON/);
});

function setup() {
  const shop = fakeShopify();
  const registry = new DraftRegistry('verde-test.myshopify.com', mkdtempSync(join(tmpdir(), 'bp-mcp-')));
  const planner = new Planner(shop.admin, registry);
  const draftId = 'gid://shopify/OnlineStoreTheme/77';
  shop.store.themes.push({ id: draftId, name: 'Blueprint AI draft', role: 'UNPUBLISHED', processing: false, files: { ...shop.store.themes[0].files } });
  registry.add({ themeId: draftId, name: 'Blueprint AI draft', baseThemeId: shop.store.themes[0].id, createdAt: new Date().toISOString(), snapshots: {} });
  const index = JSON.parse(shop.store.themes[0].files['templates/index.json']);
  return { shop, registry, planner, draftId, index };
}

test('the live theme, and themes the server did not create, are never written', async () => {
  const { shop, registry, planner, index } = setup();
  const live = shop.store.themes[0];
  const change = [{ filename: 'templates/index.json', content: JSON.stringify(index) }];
  await assert.rejects(() => planner.plan(live.id, change), /isn't a Blueprint AI draft/);
  // Even if the live theme somehow got into the registry, its role is re-checked.
  registry.add({ themeId: live.id, name: 'x', baseThemeId: live.id, createdAt: '', snapshots: {} });
  await assert.rejects(() => planner.plan(live.id, change), /is MAIN, not a draft/);
  shop.store.themes.push({ id: 'gid://shopify/OnlineStoreTheme/99', name: 'Someone else', role: 'UNPUBLISHED', processing: false, files: {} });
  await assert.rejects(() => planner.plan('gid://shopify/OnlineStoreTheme/99', change), /isn't a Blueprint AI draft/);
  assert.ok(!shop.calls.some((c) => c.name === 'ThemeFilesUpsert'));
});

test('a draft that gets published is no longer writable', async () => {
  const { shop, planner, draftId, index } = setup();
  index.sections[index.order[0]].settings.padding_top = 40;
  const plan = await planner.plan(draftId, [{ filename: 'templates/index.json', content: JSON.stringify(index) }]);
  shop.theme(draftId).role = 'MAIN';
  await assert.rejects(() => planner.apply(draftId, plan.change_token), /is MAIN, not a draft/);
  assert.ok(!shop.calls.some((c) => c.name === 'ThemeFilesUpsert'));
});

test('changes apply only with their own token, and never over a file that changed meanwhile', async () => {
  const { shop, planner, draftId, index } = setup();
  index.sections[index.order[0]].settings.padding_top = 40;
  const content = JSON.stringify(index, null, 2);
  const plan = await planner.plan(draftId, [{ filename: 'templates/index.json', content }]);
  assert.match(plan.diff, /"padding_top": 40/);
  await assert.rejects(() => planner.apply(draftId, 'not-the-token'), /Unknown or expired change_token/);
  shop.theme(draftId).files['templates/index.json'] += ' ';
  await assert.rejects(() => planner.apply(draftId, plan.change_token), /changed since the plan/);
  const again = await planner.plan(draftId, [{ filename: 'templates/index.json', content }]);
  await planner.apply(draftId, again.change_token);
  assert.equal(shop.theme(draftId).files['templates/index.json'], content);
  assert.notEqual(shop.store.themes[0].files['templates/index.json'], content, 'the live theme is untouched');
});

test('invalid content is refused before anything is planned', async () => {
  const { planner, draftId, index } = setup();
  index.sections[index.order[0]].settings.padding_top = 5000;
  await assert.rejects(() => planner.plan(draftId, [{ filename: 'templates/index.json', content: JSON.stringify(index) }]), /doesn't fit Blueprint's schema[\s\S]*padding_top/);
  await assert.rejects(() => planner.plan(draftId, [{ filename: 'layout/theme.liquid', content: '' }]), /can't be changed/);
  await assert.rejects(() => planner.plan(draftId, [{ filename: 'templates/index.json', content: null }]), /only files this server created/);
});
