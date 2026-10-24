// Declarative, idempotent migrations of a merchant's theme JSON between Blueprint versions.
//
// migrations/<from>-<to>.json:
//   { "from": "1.0.0", "to": "1.0.1", "description": "…", "operations": [ … ] }
//
// Operations only ever fill in or carry over values, so running them twice changes nothing:
//   { "op": "theme_setting_default", "setting": "x", "value": v }            theme setting x = v if unset
//   { "op": "copy_theme_setting", "from": "a", "to": "b" }                   b = a if b is unset
//   { "op": "section_setting_default", "section": "hero", "setting": "x", "value": v }
//   { "op": "copy_section_setting", "section": "hero", "from": "a", "to": "b" }
//   { "op": "block_setting_default", "block": "product-price", "setting": "x", "value": v, "section"?: "main-product" }
//   { "op": "add_block", "file": "templates/product.json", "section_id": "main", "block_id": "trust", "block": {…}, "after"?: "price" }
//   { "op": "add_section", "file": "templates/cart.json", "section_id": "faq", "section": {…}, "after"?: "main" }
// "section" and "block" name section and block types; section and block operations apply in
// every template and section group. Settings that hold a value (even false or "") are never
// overwritten.
import { compareVersions } from './update-safety.mjs';

const COMMENT = /^\s*\/\*[\s\S]*?\*\/\s*/;
const has = (object, key) => object && Object.prototype.hasOwnProperty.call(object, key);

export function parseThemeJson(content) {
  const comment = COMMENT.exec(content)?.[0] ?? '';
  return { comment, json: JSON.parse(content.slice(comment.length)) };
}

export function stringifyThemeJson(json, comment = '') {
  return `${comment}${JSON.stringify(json, null, 2)}\n`;
}

// The migrations that take a theme from `from` to `to`, in order.
export function migrationChain(migrations, from, to) {
  return migrations
    .filter((m) => compareVersions(m.from, from) >= 0 && compareVersions(m.to, to) <= 0)
    .sort((a, b) => compareVersions(a.from, b.from));
}

function currentSettings(settingsData) {
  if (typeof settingsData.current === 'string') {
    // A theme still on a named preset: materialise it, so defaults can be added.
    settingsData.current = { ...(settingsData.presets?.[settingsData.current] ?? {}) };
  }
  settingsData.current ??= {};
  return settingsData.current;
}

function eachSection(docs, type, fn) {
  for (const doc of docs) for (const [id, section] of Object.entries(doc.json.sections ?? {})) if (section?.type === type) fn(section, id, doc);
}

function eachBlock(blocks, fn) {
  for (const block of Object.values(blocks ?? {})) {
    fn(block);
    eachBlock(block.blocks, fn);
  }
}

// files: { filename: content } (settings_data, templates/*.json, sections/*-group.json).
// Returns the changed files and a log of what each operation did.
export function applyMigrations(files, migrations) {
  const docs = Object.entries(files)
    .filter(([name]) => /^(templates\/.+|sections\/.+-group)\.json$/.test(name))
    .map(([name, content]) => ({ name, ...parseThemeJson(content), changed: false }));
  const settingsDoc = files['config/settings_data.json'] ? { name: 'config/settings_data.json', ...parseThemeJson(files['config/settings_data.json']), changed: false } : null;
  const log = [];
  const touch = (doc, message) => {
    doc.changed = true;
    log.push(`${doc.name}: ${message}`);
  };

  for (const migration of migrations) {
    for (const op of migration.operations) {
      switch (op.op) {
        case 'theme_setting_default':
        case 'copy_theme_setting': {
          if (!settingsDoc) break;
          const current = currentSettings(settingsDoc.json);
          const target = op.op === 'copy_theme_setting' ? op.to : op.setting;
          if (has(current, target)) break;
          if (op.op === 'copy_theme_setting') {
            if (!has(current, op.from)) break;
            current[target] = current[op.from];
          } else {
            current[target] = op.value;
          }
          touch(settingsDoc, `${target} = ${JSON.stringify(current[target])}`);
          break;
        }
        case 'section_setting_default':
        case 'copy_section_setting':
          eachSection(docs, op.section, (section, id, doc) => {
            section.settings ??= {};
            const target = op.op === 'copy_section_setting' ? op.to : op.setting;
            if (has(section.settings, target)) return;
            if (op.op === 'copy_section_setting') {
              if (!has(section.settings, op.from)) return;
              section.settings[target] = section.settings[op.from];
            } else {
              section.settings[target] = op.value;
            }
            touch(doc, `section ${id}: ${target} = ${JSON.stringify(section.settings[target])}`);
          });
          break;
        case 'block_setting_default':
          for (const doc of docs) {
            for (const [id, section] of Object.entries(doc.json.sections ?? {})) {
              if (op.section && section?.type !== op.section) continue;
              eachBlock(section?.blocks, (block) => {
                if (block.type !== op.block) return;
                block.settings ??= {};
                if (has(block.settings, op.setting)) return;
                block.settings[op.setting] = op.value;
                touch(doc, `section ${id} block ${op.block}: ${op.setting} = ${JSON.stringify(op.value)}`);
              });
            }
          }
          break;
        case 'add_block': {
          const doc = docs.find((d) => d.name === op.file);
          const section = doc?.json.sections?.[op.section_id];
          if (!section || has(section.blocks, op.block_id) || Object.values(section.blocks ?? {}).some((b) => b.type === op.block.type)) break;
          section.blocks ??= {};
          section.blocks[op.block_id] = op.block;
          section.block_order ??= [];
          const at = op.after ? section.block_order.indexOf(op.after) : -1;
          section.block_order.splice(at >= 0 ? at + 1 : section.block_order.length, 0, op.block_id);
          touch(doc, `section ${op.section_id}: added block ${op.block_id}`);
          break;
        }
        case 'add_section': {
          const doc = docs.find((d) => d.name === op.file);
          if (!doc || has(doc.json.sections, op.section_id)) break;
          doc.json.sections[op.section_id] = op.section;
          const at = op.after ? doc.json.order.indexOf(op.after) : -1;
          doc.json.order.splice(at >= 0 ? at + 1 : doc.json.order.length, 0, op.section_id);
          touch(doc, `added section ${op.section_id}`);
          break;
        }
        default:
          throw new Error(`Unknown migration operation "${op.op}" in ${migration.from}-${migration.to}`);
      }
    }
  }

  const out = {};
  for (const doc of [...docs, ...(settingsDoc ? [settingsDoc] : [])]) if (doc.changed) out[doc.name] = stringifyThemeJson(doc.json, doc.comment);
  return { files: out, log };
}

export function validateMigration(migration, name = 'migration') {
  const errors = [];
  if (!/^\d+\.\d+\.\d+$/.test(migration.from ?? '') || !/^\d+\.\d+\.\d+$/.test(migration.to ?? '')) errors.push(`${name}: "from" and "to" must be versions`);
  if (compareVersions(migration.to ?? '0', migration.from ?? '0') <= 0) errors.push(`${name}: "to" must be later than "from"`);
  if (!Array.isArray(migration.operations)) errors.push(`${name}: "operations" must be a list`);
  const required = {
    theme_setting_default: ['setting', 'value'],
    copy_theme_setting: ['from', 'to'],
    section_setting_default: ['section', 'setting', 'value'],
    copy_section_setting: ['section', 'from', 'to'],
    block_setting_default: ['block', 'setting', 'value'],
    add_block: ['file', 'section_id', 'block_id', 'block'],
    add_section: ['file', 'section_id', 'section'],
  };
  for (const [i, op] of (migration.operations ?? []).entries()) {
    if (!required[op.op]) errors.push(`${name}: operation ${i + 1} has unknown op "${op.op}"`);
    else for (const key of required[op.op]) if (!has(op, key)) errors.push(`${name}: operation ${i + 1} (${op.op}) needs "${key}"`);
  }
  return errors;
}
