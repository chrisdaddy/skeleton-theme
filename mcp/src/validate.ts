// Validates JSON templates, section groups and settings_data.json against Blueprint's own
// section, block and settings schemas (src/generated/theme-index.json), so a draft never gets
// a file the theme editor would reject or silently ignore.

import index from './generated/theme-index.json' with { type: 'json' };

interface Setting {
  id: string;
  type: string;
  label?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}
interface BlockDef {
  type: string;
  name?: string;
  settings?: Setting[];
  limit?: number;
}
interface SectionDef {
  name: string;
  settings: Setting[];
  blocks: BlockDef[];
  max_blocks?: number;
  addable?: boolean;
}
export const THEME_INDEX = index as unknown as { sections: Record<string, SectionDef>; blocks: Record<string, { name: string; settings: Setting[]; blocks: BlockDef[] }>; settings: Setting[]; presets: string[] };

const TEXT_TYPES = new Set(['text', 'textarea', 'richtext', 'inline_richtext', 'html', 'liquid', 'url', 'video_url', 'image_picker', 'video', 'product', 'collection', 'page', 'blog', 'article', 'link_list', 'font_picker', 'color_background', 'text_alignment', 'metaobject']);
const LIST_TYPES = new Set(['product_list', 'collection_list', 'metaobject_list']);
const APP_BLOCK = /^shopify:\/\/apps\//;

export function checkSetting(setting: Setting, value: unknown, where: string, errors: string[]) {
  if (value === null || value === undefined) return;
  const bad = (why: string) => errors.push(`${where}: setting "${setting.id}" ${why}`);
  switch (setting.type) {
    case 'checkbox':
      if (typeof value !== 'boolean') bad('must be true or false');
      break;
    case 'number':
      if (typeof value !== 'number' && !(typeof value === 'string' && value !== '' && !Number.isNaN(Number(value)))) bad('must be a number');
      break;
    case 'range': {
      if (typeof value !== 'number') return bad('must be a number');
      if (setting.min !== undefined && value < setting.min) bad(`must be at least ${setting.min}`);
      if (setting.max !== undefined && value > setting.max) bad(`must be at most ${setting.max}`);
      if (setting.step && setting.min !== undefined && Math.abs(((value - setting.min) / setting.step) % 1) > 1e-9 && Math.abs(((value - setting.min) / setting.step) % 1) < 1 - 1e-9) bad(`must be in steps of ${setting.step}`);
      break;
    }
    case 'select':
    case 'radio':
      if (!setting.options?.includes(String(value))) bad(`must be one of ${setting.options?.join(', ')}`);
      break;
    case 'color':
      if (typeof value !== 'string' || !(value === '' || /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) || /^rgba?\(/.test(value))) bad('must be a hex color');
      break;
    default:
      if (LIST_TYPES.has(setting.type)) {
        if (!Array.isArray(value)) bad('must be a list');
      } else if (TEXT_TYPES.has(setting.type) && typeof value !== 'string') bad('must be text');
  }
}

function checkSettings(defs: Setting[], values: unknown, where: string, errors: string[]) {
  if (values === undefined) return;
  if (!values || typeof values !== 'object' || Array.isArray(values)) return errors.push(`${where}: settings must be an object`);
  for (const [id, value] of Object.entries(values)) {
    const def = defs.find((s) => s.id === id);
    if (!def) errors.push(`${where}: unknown setting "${id}"`);
    else checkSetting(def, value, where, errors);
  }
}

type BlockJson = { type?: unknown; settings?: unknown; blocks?: Record<string, BlockJson>; block_order?: unknown; static?: boolean; disabled?: boolean };

function checkBlocks(allowed: BlockDef[], blocks: Record<string, BlockJson> | undefined, order: unknown, where: string, errors: string[], maxBlocks?: number) {
  if (!blocks) return;
  if (typeof blocks !== 'object' || Array.isArray(blocks)) return errors.push(`${where}: blocks must be an object`);
  const ids = Object.keys(blocks);
  if (order !== undefined) {
    if (!Array.isArray(order)) errors.push(`${where}: block_order must be a list`);
    else for (const id of order) if (!ids.includes(id)) errors.push(`${where}: block_order names missing block "${id}"`);
  }
  const counted = ids.filter((id) => !blocks[id]?.static);
  if (maxBlocks && counted.length > maxBlocks) errors.push(`${where}: ${counted.length} blocks, at most ${maxBlocks}`);
  const acceptsApps = allowed.some((b) => b.type === '@app');
  const acceptsTheme = allowed.some((b) => b.type === '@theme');
  for (const [id, block] of Object.entries(blocks)) {
    const type = String(block?.type ?? '');
    const at = `${where} › block "${id}" (${type || 'no type'})`;
    if (APP_BLOCK.test(type)) {
      if (!acceptsApps) errors.push(`${at}: this section doesn't accept app blocks`);
      continue;
    }
    const local = allowed.find((b) => b.type === type);
    const themeBlock = THEME_INDEX.blocks[type];
    if (local && local.type !== '@app' && local.type !== '@theme') {
      checkSettings(local.settings ?? [], block.settings, at, errors);
    } else if (themeBlock && (acceptsTheme || allowed.some((b) => b.type === type) || block.static)) {
      checkSettings(themeBlock.settings, block.settings, at, errors);
      checkBlocks(themeBlock.blocks, block.blocks, block.block_order, at, errors);
    } else {
      errors.push(`${at}: block type not allowed here`);
    }
  }
  for (const def of allowed.filter((b) => b.limit)) {
    const count = Object.values(blocks).filter((b) => b?.type === def.type).length;
    if (count > def.limit!) errors.push(`${where}: at most ${def.limit} "${def.type}" blocks`);
  }
}

type SectionsJson = { sections?: Record<string, { type?: unknown; settings?: unknown; blocks?: Record<string, BlockJson>; block_order?: unknown; disabled?: boolean }>; order?: unknown };

export function validateSections(json: SectionsJson, label: string): string[] {
  const errors: string[] = [];
  if (!json || typeof json !== 'object') return [`${label}: not a JSON object`];
  const sections = json.sections ?? {};
  if (typeof sections !== 'object' || Array.isArray(sections)) return [`${label}: "sections" must be an object`];
  if (!Array.isArray(json.order)) errors.push(`${label}: "order" must be a list`);
  else {
    for (const id of json.order) if (!(id in sections)) errors.push(`${label}: order names missing section "${id}"`);
    if (json.order.length > 25) errors.push(`${label}: at most 25 sections`);
  }
  for (const [id, section] of Object.entries(sections)) {
    const type = String(section?.type ?? '');
    const where = `${label} › section "${id}" (${type || 'no type'})`;
    if (APP_BLOCK.test(type)) continue;
    const def = THEME_INDEX.sections[type];
    if (!def) {
      errors.push(`${where}: no such Blueprint section`);
      continue;
    }
    checkSettings(def.settings, section.settings, where, errors);
    checkBlocks(def.blocks, section.blocks, section.block_order, where, errors, def.max_blocks);
  }
  return errors;
}

export function validateSettingsData(json: { current?: unknown; presets?: Record<string, unknown> }): string[] {
  const errors: string[] = [];
  if (!json || typeof json !== 'object') return ['config/settings_data.json: not a JSON object'];
  const check = (values: unknown, where: string) => {
    if (typeof values === 'string') {
      if (!(json.presets && values in json.presets)) errors.push(`${where}: no preset named "${values}"`);
      return;
    }
    if (!values || typeof values !== 'object') return errors.push(`${where}: must be a preset name or an object`);
    for (const [id, value] of Object.entries(values as Record<string, unknown>)) {
      if (id === 'sections' || id === 'content_for_index' || id === 'blocks') continue;
      const def = THEME_INDEX.settings.find((s) => s.id === id);
      // Settings a theme version no longer has are kept by Shopify; only check known ones.
      if (def) checkSetting(def, value, where, errors);
    }
  };
  check(json.current, 'config/settings_data.json › current');
  return errors;
}

export function validateFile(filename: string, content: string): string[] {
  let json: any;
  try {
    json = JSON.parse(stripJsonComment(content));
  } catch (error) {
    return [`${filename}: not valid JSON (${(error as Error).message})`];
  }
  if (filename === 'config/settings_data.json') return validateSettingsData(json);
  return validateSections(json, filename);
}

// Shopify prepends a /* … */ notice to JSON templates it writes.
export function stripJsonComment(content: string) {
  return content.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
}
