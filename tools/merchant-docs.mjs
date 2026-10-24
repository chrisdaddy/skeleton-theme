#!/usr/bin/env node
// Generates the reference pages of the merchant docs from the theme itself, so they never
// drift: docs/merchant/sections.md (every section you can add, its blocks and settings) and
// docs/merchant/metafields.md (the metafields and metaobjects Blueprint reads).
//
//   node tools/merchant-docs.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { METAFIELDS, METAOBJECTS, NAMESPACE, STANDARD_METAFIELDS } from './demo/definitions.mjs';
import { buildSchemaIndex } from './lib/schema-index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const index = buildSchemaIndex(root);
const cell = (text) => String(text ?? '').replace(/\|/g, '\\|');
const COMMON = new Set(['surface_style', 'width', 'heading_tag', 'padding_top', 'padding_bottom', 'hide_mobile', 'hide_desktop', 'custom_class']);

function sections() {
  const lines = [
    '# Sections',
    '',
    'Every section you can add in the theme editor (**Add section**), generated from the theme by `node tools/merchant-docs.mjs`.',
    '',
    'Most content sections also share these settings: color style, width, heading tag, top and bottom padding, hide on mobile or desktop, and a custom CSS class.',
    '',
    'Sections marked "product data first" read the product\'s Blueprint metafields (see [metafields](metafields.md)) and fall back to their own blocks when there are none.',
    '',
    '| Section | Blocks | Settings |',
    '|---|---|---|',
  ];
  for (const [type, s] of Object.entries(index.sections).filter(([, s]) => s.addable).sort((a, b) => a[1].name.localeCompare(b[1].name))) {
    const own = s.settings.filter((x) => !COMMON.has(x.id) && x.type !== 'header' && x.type !== 'paragraph');
    const blocks = s.blocks.map((b) => (b.type === '@app' ? 'app blocks' : b.type === '@theme' ? 'theme blocks' : b.name ?? b.type));
    const productData = s.settings.some((x) => x.id === 'use_metafield') ? ' (product data first)' : '';
    lines.push(`| **${cell(s.name)}**${productData}<br>\`${type}\` | ${cell(blocks.join(', ') || '—')}${s.max_blocks ? ` (up to ${s.max_blocks})` : ''} | ${cell(own.map((x) => x.label ?? x.id).join(', ') || '—')} |`);
  }
  lines.push('', `## Product page blocks`, '', 'The buy box on the product page, the featured product section and the pre-lander offer section are built from these theme blocks (**Add block** inside the section).', '', '| Block | Settings |', '|---|---|');
  for (const [type, b] of Object.entries(index.blocks).filter(([t]) => t.startsWith('product-')).sort((a, b) => a[1].name.localeCompare(b[1].name))) {
    lines.push(`| **${cell(b.name)}**<br>\`${type}\` | ${cell(b.settings.filter((x) => x.type !== 'header' && x.type !== 'paragraph').map((x) => x.label ?? x.id).join(', ') || '—')} |`);
  }
  return `${lines.join('\n')}\n`;
}

function metafields() {
  const lines = [
    '# Metafields and metaobjects',
    '',
    `Blueprint reads product content from metafields in the \`${NAMESPACE}\` namespace and from metaobjects, so the same tiers, benefits or FAQs show wherever the product appears. Every section and block also works without them, using its own settings.`,
    '',
    '**Create the definitions** in one of two ways:',
    '- Ask the AI kit to "set up Blueprint metafields" (`setup_metafields`, additive only).',
    '- Add them by hand in **Settings → Custom data**, with the namespace, keys and types below.',
    '',
    '**Money never goes in metafields.** Prices, savings and per-unit figures always come from variants and selling plans.',
    '',
    '## Product metafields',
    '',
    '| Key | Type | Used for |',
    '|---|---|---|',
    ...METAFIELDS.filter((m) => m.ownerType === 'PRODUCT').map((m) => `| \`${NAMESPACE}.${m.key}\` | ${m.type}${m.metaobject ? ` → \`${m.metaobject}\`` : ''} | ${cell(m.name)} |`),
    ...STANDARD_METAFIELDS.map((m) => `| \`${m.namespace}.${m.key}\` | Shopify standard | ${m.namespace === 'reviews' ? 'Star ratings (written by your review app)' : 'Subtitle under the product title'} |`),
    '',
    '## Variant metafields',
    '',
    '| Key | Type | Used for |',
    '|---|---|---|',
    ...METAFIELDS.filter((m) => m.ownerType === 'PRODUCTVARIANT').map((m) => `| \`${NAMESPACE}.${m.key}\` | ${m.type} | ${cell(m.name)} |`),
    '',
    '## Page metafields',
    '',
    '| Key | Values | Used for |',
    '|---|---|---|',
    ...METAFIELDS.filter((m) => m.ownerType === 'PAGE').map((m) => `| \`${NAMESPACE}.${m.key}\` | ${m.choices.join(', ')} | ${cell(m.name)} |`),
    '',
    '## Metaobjects',
    '',
  ];
  for (const mo of METAOBJECTS) {
    lines.push(`### ${mo.name.replace('Blueprint: ', '')} (\`${mo.type}\`)`, '', '| Field | Type | Notes |', '|---|---|---|');
    for (const f of mo.fields) lines.push(`| \`${f.key}\`${f.required ? ' (required)' : ''} | ${f.type} | ${cell(f.description ?? f.name)} |`);
    lines.push('');
  }
  return `${lines.join('\n')}`;
}

const files = { 'docs/merchant/sections.md': sections(), 'docs/merchant/metafields.md': metafields() };
let stale = false;
for (const [path, content] of Object.entries(files)) {
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(join(root, path), 'utf8');
    } catch {}
    if (current !== content) {
      console.error(`${path} is out of date: run node tools/merchant-docs.mjs`);
      stale = true;
    }
  } else {
    writeFileSync(join(root, path), content);
  }
}
if (stale) process.exit(1);
if (!process.argv.includes('--check')) console.log(Object.keys(files).join(', '));
