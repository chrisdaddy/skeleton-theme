// An index of the theme's schemas: every section's and theme block's settings (IDs, types,
// options, ranges), block types, max_blocks and limits, plus the global settings schema.
//
// Used by the AI kit (mcp/scripts/sync.mjs) to validate edits, and by the release tools as the
// baseline the update-safety check compares against (tools/update-safety.mjs).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function schemaOf(file) {
  const source = readFileSync(file, 'utf8');
  const match = /\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/.exec(source);
  return match ? JSON.parse(match[1]) : null;
}

export function buildSchemaIndex(root) {
  const schemaLocale = JSON.parse(readFileSync(join(root, 'locales/en.default.schema.json'), 'utf8'));
  const label = (value) => {
    if (typeof value !== 'string' || !value.startsWith('t:')) return value;
    return value.slice(2).split('.').reduce((node, key) => node?.[key], schemaLocale) ?? value;
  };
  const settings = (list = []) =>
    list
      .filter((s) => s.id)
      .map((s) => {
        const out = { id: s.id, type: s.type, label: label(s.label) };
        if (s.options) out.options = s.options.map((o) => o.value);
        for (const key of ['min', 'max', 'step', 'default']) if (key in s) out[key] = s[key];
        return out;
      });
  const blocks = (list = []) =>
    list.map((b) => {
      const out = { type: b.type };
      if (b.name) out.name = label(b.name);
      if (b.settings) out.settings = settings(b.settings);
      if (b.limit) out.limit = b.limit;
      return out;
    });

  const sections = {};
  for (const file of readdirSync(join(root, 'sections')).filter((f) => f.endsWith('.liquid')).sort()) {
    const schema = schemaOf(join(root, 'sections', file));
    if (!schema) continue;
    sections[file.replace('.liquid', '')] = {
      name: label(schema.name),
      settings: settings(schema.settings),
      blocks: blocks(schema.blocks),
      ...(schema.max_blocks ? { max_blocks: schema.max_blocks } : {}),
      ...(schema.presets ? { addable: true } : {}),
      ...(schema.limit ? { limit: schema.limit } : {}),
    };
  }
  const themeBlocks = {};
  for (const file of readdirSync(join(root, 'blocks')).filter((f) => f.endsWith('.liquid')).sort()) {
    const schema = schemaOf(join(root, 'blocks', file));
    if (!schema) continue;
    themeBlocks[file.replace('.liquid', '')] = { name: label(schema.name), settings: settings(schema.settings), blocks: blocks(schema.blocks) };
  }
  const globalSettings = JSON.parse(readFileSync(join(root, 'config/settings_schema.json'), 'utf8')).flatMap((group) => settings(group.settings));
  const presets = Object.keys(JSON.parse(readFileSync(join(root, 'config/settings_data.json'), 'utf8')).presets ?? {});
  return { sections, blocks: themeBlocks, settings: globalSettings, presets };
}
