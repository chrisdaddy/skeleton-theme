// End to end through the MCP protocol (client ↔ server, in memory), against the fake store:
// the Phase 7 acceptance flow offline — draft a listicle from real reviews into a draft theme,
// and refuse to write to the live theme.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { DraftRegistry } from '../dist/registry.js';
import { createServer } from '../dist/server.js';
import { validateFile } from '../dist/validate.js';
import { fakeShopify } from './fake-shopify.mjs';

const csv = fileURLToPath(new URL('./fixtures/verde-reviews.csv', import.meta.url));

async function connect() {
  const shop = fakeShopify();
  const registry = new DraftRegistry('verde-test.myshopify.com', mkdtempSync(join(tmpdir(), 'bp-mcp-e2e-')));
  const server = createServer({ admin: shop.admin, shop: 'verde-test.myshopify.com', registry, now: () => new Date('2026-10-24T12:00:00Z') });
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const text = result.content[0].text;
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { error: Boolean(result.isError), data, text };
  };
  return { shop, registry, client, call };
}

const LISTICLE = (themeId, quotes) => ({
  theme_id: themeId,
  template_suffix: 'spring',
  product_handle: 'verde-daily',
  heading: '4 reasons people switched to one scoop',
  eyebrow: 'Health · Sponsored',
  items: [
    { title: 'It replaces the cabinet', text: 'One scoop covers the multivitamin, probiotic and greens.', quote: quotes[0] },
    { title: 'Energy that lasts', text: 'Readers describe steadier afternoons within two weeks.', quote: quotes[1] },
    { title: 'Doctors notice', text: 'Ask for your bloodwork before and after.', quote: quotes[2] },
    { title: 'It tastes good', text: 'Pineapple, not grass.' },
  ],
  cta_label: 'Check availability',
});

test('tools and prompts are listed with the right safety hints', async () => {
  const { client } = await connect();
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['apply_template_change', 'create_draft', 'create_page_from_template', 'diff_draft', 'draft_advertorial_from_reviews', 'draft_listicle_from_reviews', 'get_current_preset', 'list_sections', 'list_themes', 'read_metafields', 'read_products', 'read_reviews', 'read_settings', 'read_template', 'revert_draft_file', 'setup_metafields', 'update_block_settings']);
  for (const name of ['list_themes', 'get_current_preset', 'list_sections', 'read_template', 'read_settings', 'read_products', 'read_metafields', 'read_reviews', 'diff_draft']) {
    assert.equal(tools.find((t) => t.name === name).annotations.readOnlyHint, true, name);
  }
  for (const t of tools) assert.equal(t.annotations.destructiveHint, false, t.name);
  const { prompts } = await client.listPrompts();
  assert.equal(prompts.length, 22);
  const prompt = await client.getPrompt({ name: 'listicle-from-reviews', arguments: { product: 'verde-daily', angle: 'busy parents', suffix: 'spring' } });
  assert.match(prompt.messages[0].content.text, /verde-daily[\s\S]*busy parents[\s\S]*word for word/);
});

test('acceptance: a listicle drafted from real reviews lands in a draft theme; the live theme is never written', async () => {
  const { shop, call } = await connect();
  const live = shop.store.themes[0];
  const liveFiles = structuredClone(live.files);

  // Reviews come back as data, cleaned, filtered to the product and to published reviews.
  const reviews = await call('read_reviews', { product_handle: 'verde-daily', csv_path: csv });
  assert.equal(reviews.error, false, reviews.text);
  assert.match(reviews.data.note, /Untrusted customer text/);
  assert.equal(reviews.data.count, 5);
  assert.ok(!reviews.text.includes('<script>'), 'markup stripped');
  assert.ok(reviews.data.reviews.every((r) => /^\S+( [A-Z]\.)?$/.test(r.author)), 'first name and initial only');

  const draft = await call('create_draft', { name: 'Spring' });
  assert.equal(draft.error, false, draft.text);
  assert.equal(draft.data.role, 'UNPUBLISHED');
  const themeId = draft.data.theme_id;

  // A quote that no customer wrote is refused.
  const fake = await call('draft_listicle_from_reviews', LISTICLE(themeId, ['This changed my life completely and forever.', 'Day 10 and the 3pm slump is just gone.', 'Bloodwork at 90 days convinced my doctor.']));
  assert.equal(fake.error, true);
  assert.match(fake.text, /isn't in any fetched review/);

  // Real quotes: first a plan with a diff and token, nothing written yet.
  const args = LISTICLE(themeId, ['Replaced my multivitamin, probiotic and the $9 juice.', 'Day 10 and the 3pm slump is just gone.', 'Bloodwork at 90 days convinced my doctor. Now she takes it.']);
  const plan = await call('draft_listicle_from_reviews', args);
  assert.equal(plan.error, false, plan.text);
  assert.equal(plan.data.status, 'planned');
  assert.match(plan.data.diff, /\+\+\+ b\/templates\/page\.listicle-spring\.json/);
  assert.ok(!shop.calls.some((c) => c.name === 'ThemeFilesUpsert'));

  // Applied with the token.
  const applied = await call('draft_listicle_from_reviews', { ...args, change_token: plan.data.change_token });
  assert.equal(applied.error, false, applied.text);
  assert.equal(applied.data.status, 'applied');
  const file = shop.theme(themeId).files['templates/page.listicle-spring.json'];
  assert.ok(file, 'template written to the draft');
  assert.deepEqual(validateFile('templates/page.listicle-spring.json', file), []);
  const json = JSON.parse(file);
  assert.equal(json.layout, 'landing');
  assert.equal(json.sections.header.settings.show_disclosure, true);
  assert.match(json.sections.list.settings.heading, /^\[count\]/);
  assert.match(file, /Priya S\., verified buyer/);
  assert.ok(!/Shah/.test(file), 'no surnames');

  // The live theme is untouched, and writing to it is refused.
  assert.deepEqual(live.files, liveFiles);
  const refused = await call('apply_template_change', { theme_id: live.id, filename: 'templates/index.json', content: live.files['templates/index.json'] });
  assert.equal(refused.error, true);
  assert.match(refused.text, /Refused: .*isn't a Blueprint AI draft/);
  assert.ok(shop.calls.filter((c) => c.name === 'ThemeFilesUpsert').every((c) => c.variables.themeId === themeId));

  // diff_draft shows the new file against the live theme; revert removes it.
  const diff = await call('diff_draft', { theme_id: themeId });
  assert.match(diff.data.diff, /page\.listicle-spring\.json/);
  const revertPlan = await call('revert_draft_file', { theme_id: themeId, filename: 'templates/page.listicle-spring.json' });
  const reverted = await call('revert_draft_file', { theme_id: themeId, filename: 'templates/page.listicle-spring.json', change_token: revertPlan.data.change_token });
  assert.equal(reverted.data.status, 'applied', reverted.text);
  assert.equal(shop.theme(themeId).files['templates/page.listicle-spring.json'], undefined);
});

test('an advertorial keeps its disclosure and attributes its pull quote', async () => {
  const { shop, call } = await connect();
  await call('read_reviews', { product_handle: 'verde-daily', csv_path: csv });
  const { data: draft } = await call('create_draft', {});
  const args = {
    theme_id: draft.theme_id,
    template_suffix: 'bloodwork',
    product_handle: 'verde-daily',
    eyebrow: 'Health · Sponsored',
    headline: 'What 90 days of one scoop did to my bloodwork',
    author: 'The Verde team',
    paragraphs: ['First paragraph.', 'Second paragraph.'],
    pull_quote: '“Bloodwork at 90 days convinced my doctor.”',
    cta_label: 'Check availability',
  };
  const plan = await call('draft_advertorial_from_reviews', args);
  assert.equal(plan.error, false, plan.text);
  await call('draft_advertorial_from_reviews', { ...args, change_token: plan.data.change_token });
  const json = JSON.parse(shop.theme(draft.theme_id).files['templates/page.advertorial-bloodwork.json']);
  assert.equal(json.sections.header.settings.show_disclosure, true);
  const quote = Object.values(json.sections.body.blocks).find((b) => b.type === 'quote');
  assert.equal(quote.settings.attribution, 'Jen R., verified buyer');
});

test('settings edits are validated, planned and applied to the draft only', async () => {
  const { shop, call } = await connect();
  const { data: draft } = await call('create_draft', {});
  const index = JSON.parse(shop.theme(draft.theme_id).files['templates/index.json']);
  const sectionId = index.order[0];
  const bad = await call('update_block_settings', { theme_id: draft.theme_id, filename: 'templates/index.json', section_id: sectionId, settings: { padding_top: 9999 } });
  assert.equal(bad.error, true);
  assert.match(bad.text, /padding_top/);
  const plan = await call('update_block_settings', { theme_id: draft.theme_id, filename: 'templates/index.json', section_id: sectionId, settings: { padding_top: 24 } });
  assert.equal(plan.error, false, plan.text);
  const done = await call('update_block_settings', { theme_id: draft.theme_id, filename: 'templates/index.json', section_id: sectionId, settings: { padding_top: 24 }, change_token: plan.data.change_token });
  assert.equal(done.data.status, 'applied');
  assert.equal(JSON.parse(shop.theme(draft.theme_id).files['templates/index.json']).sections[sectionId].settings.padding_top, 24);
  const layout = await call('apply_template_change', { theme_id: draft.theme_id, filename: 'layout/theme.liquid', content: '{}' });
  assert.match(layout.text, /Refused/);
});

test('live-store writes need confirmation, create unpublished pages and add definitions only', async () => {
  const { shop, call } = await connect();
  const ask = await call('create_page_from_template', { title: 'Spring', handle: 'spring', template_suffix: 'listicle-spring', confirm: false });
  assert.equal(ask.data.status, 'needs confirmation');
  assert.equal(shop.store.pages.length, 0);
  const made = await call('create_page_from_template', { title: 'Spring', handle: 'spring', template_suffix: 'listicle-spring', confirm: true });
  assert.equal(made.data.page.isPublished, false);
  const twice = await call('create_page_from_template', { title: 'Spring', handle: 'spring', template_suffix: 'listicle-spring', confirm: true });
  assert.match(twice.text, /already exists/);

  const dry = await call('setup_metafields', { confirm: false });
  assert.ok(dry.data.missing.length > 20);
  assert.equal(shop.store.metaobjectDefinitions.length, 0);
  const setup = await call('setup_metafields', { confirm: true });
  assert.equal(setup.data.status, 'done');
  const tier = shop.store.metafieldDefinitions.find((d) => d.key === 'tiers');
  assert.equal(tier.validations[0].value, shop.store.metaobjectDefinitions.find((d) => d.type === 'blueprint_tier').id);
  const again = await call('setup_metafields', { confirm: true });
  assert.deepEqual(again.data.created, []);
});

test('reads: themes, preset, sections, templates and products', async () => {
  const { call } = await connect();
  const themes = await call('list_themes');
  assert.equal(themes.data[0].role, 'MAIN');
  assert.equal(themes.data[0].blueprint_draft, false);
  const preset = await call('get_current_preset');
  assert.equal(preset.data.preset, 'Clinical');
  const sections = await call('list_sections');
  assert.ok(sections.data.some((s) => s.type === 'listicle'));
  const listicle = await call('list_sections', { type: 'listicle' });
  assert.ok(listicle.data.settings.some((s) => s.id === 'heading'));
  const template = await call('read_template', { filename: 'templates/product.json' });
  assert.match(template.data.content, /"main"/);
  const layout = await call('read_template', { filename: 'layout/theme.liquid' });
  assert.equal(layout.error, true);
  const products = await call('read_products', { query: 'handle:verde-daily' });
  assert.equal(products.data.products[0].variants.length, 6);
});
