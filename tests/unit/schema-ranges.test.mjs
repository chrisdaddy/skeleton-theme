// Range settings as Shopify validates them on upload: min < max, at most 101 steps, and every
// default and stored value inside the range and on a step. A value off the step makes Shopify
// reject the whole file (found on the first push to a real store: ticker padding 12, step 8).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { schemaOf } from '../../tools/lib/schema-index.mjs';
import { buildTemplates } from '../../tools/templates-from-demo.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8').replace(/^\/\*[\s\S]*?\*\/\s*/, ''));
const liquidSchemas = (dir) =>
  Object.fromEntries(readdirSync(join(root, dir)).filter((f) => f.endsWith('.liquid')).map((f) => [f.slice(0, -7), schemaOf(join(root, dir, f))]).filter(([, s]) => s));

const sections = liquidSchemas('sections');
const themeBlocks = liquidSchemas('blocks');
const globalSettings = json('config/settings_schema.json').flatMap((group) => group.settings ?? []);
const ranges = (settings = []) => Object.fromEntries(settings.filter((s) => s.type === 'range').map((s) => [s.id, s]));

const onStep = (range, value) => {
  const steps = (value - range.min) / range.step;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
};
function problem(range, value) {
  if (typeof value !== 'number') return `${JSON.stringify(value)} is not a number`;
  if (value < range.min || value > range.max) return `${value} is outside ${range.min}–${range.max}`;
  if (!onStep(range, value)) return `${value} is not a step of ${range.step} from ${range.min}`;
  return null;
}

test('range settings: valid bounds, at most 101 steps, defaults on a step', () => {
  const owners = [
    ['config/settings_schema.json', globalSettings],
    ...Object.entries(sections).flatMap(([name, s]) => [[`sections/${name}`, s.settings], ...(s.blocks ?? []).map((b) => [`sections/${name} block ${b.type}`, b.settings])]),
    ...Object.entries(themeBlocks).flatMap(([name, s]) => [[`blocks/${name}`, s.settings], ...(s.blocks ?? []).map((b) => [`blocks/${name} block ${b.type}`, b.settings])]),
  ];
  const problems = [];
  let count = 0;
  for (const [owner, settings] of owners) {
    for (const range of Object.values(ranges(settings))) {
      count++;
      if (!(range.step > 0) || !(range.min < range.max)) problems.push(`${owner} ${range.id}: bounds ${range.min}–${range.max} step ${range.step}`);
      else if ((range.max - range.min) / range.step > 100) problems.push(`${owner} ${range.id}: more than 101 steps`);
      else if (!onStep(range, range.max)) problems.push(`${owner} ${range.id}: max ${range.max} is not on a step`);
      if ('default' in range && problem(range, range.default)) problems.push(`${owner} ${range.id}: default ${problem(range, range.default)}`);
    }
  }
  assert.ok(count > 50, `found ${count} range settings`);
  assert.deepEqual(problems, []);
});

// Stored values: templates, section groups, listings, theme settings, section presets and the
// demo stores' templates.
function checkBlocks(where, blocks, localTypes, problems) {
  for (const [id, block] of Object.entries(blocks ?? {})) {
    const local = localTypes?.find((b) => b.type === block.type);
    const schema = local ?? themeBlocks[block.type];
    if (!schema) continue; // @app and unknown types are another test's concern
    for (const [key, value] of Object.entries(block.settings ?? {})) {
      const range = ranges(schema.settings)[key];
      if (range && problem(range, value)) problems.push(`${where} block ${id} (${block.type}).${key}: ${problem(range, value)}`);
    }
    checkBlocks(`${where} block ${id}`, block.blocks, schema.blocks, problems);
  }
}
function checkTemplate(where, data, problems) {
  for (const [id, section] of Object.entries(data.sections ?? {})) {
    const schema = sections[section.type];
    if (!schema) continue;
    for (const [key, value] of Object.entries(section.settings ?? {})) {
      const range = ranges(schema.settings)[key];
      if (range && problem(range, value)) problems.push(`${where} ${id} (${section.type}).${key}: ${problem(range, value)}`);
    }
    checkBlocks(`${where} ${id}`, section.blocks, schema.blocks, problems);
  }
}

test('every stored range value is inside its range and on a step', () => {
  const problems = [];
  const dirFiles = (dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.json')).map((f) => `${dir}/${f}`);
  const files = [
    ...dirFiles('templates'),
    ...dirFiles('sections'),
    ...readdirSync(join(root, 'listings')).flatMap((preset) => dirFiles(`listings/${preset}/templates`)),
  ];
  for (const file of files) checkTemplate(file, json(file), problems);

  const settingsData = json('config/settings_data.json');
  const globalRanges = ranges(globalSettings);
  for (const [name, values] of [['current', settingsData.current], ...Object.entries(settingsData.presets ?? {})]) {
    if (typeof values !== 'object') continue;
    for (const [key, value] of Object.entries(values)) {
      if (globalRanges[key] && problem(globalRanges[key], value)) problems.push(`settings_data ${name}.${key}: ${problem(globalRanges[key], value)}`);
    }
  }

  for (const [kind, schemas] of [['sections', sections], ['blocks', themeBlocks]]) {
    for (const [name, schema] of Object.entries(schemas)) {
      for (const preset of schema.presets ?? []) {
        const where = `${kind}/${name} preset "${preset.name}"`;
        for (const [key, value] of Object.entries(preset.settings ?? {})) {
          const range = ranges(schema.settings)[key];
          if (range && problem(range, value)) problems.push(`${where}.${key}: ${problem(range, value)}`);
        }
        const blocks = Array.isArray(preset.blocks) ? Object.fromEntries(preset.blocks.map((b, i) => [String(i), b])) : preset.blocks;
        checkBlocks(where, blocks, schema.blocks, problems);
      }
    }
  }

  const demo = json('data/demo-content.json');
  for (const id of Object.keys(demo.stores)) {
    for (const [name, data] of Object.entries(buildTemplates(id, { images: 'shop' }))) checkTemplate(`demo ${id} ${name}`, data, problems);
  }
  assert.deepEqual(problems, []);
});
