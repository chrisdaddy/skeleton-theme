#!/usr/bin/env node
// Fails when any preset, in either color mode, has a color pair below the WCAG minimums.
// Tokens are derived exactly as snippets/tokens-mode.liquid derives them (tools/lib/tokens.mjs).
//
//   node tools/contrast-check.mjs          check config/settings_data.json (current + every preset)
//   node tools/contrast-check.mjs --demo   report on the reference presets in data/demo-content.json, as given
import { readFileSync } from 'node:fs';
import { contrast, overlay } from './lib/color.mjs';
import { deriveMode, failures } from './lib/tokens.mjs';

const root = new URL('../', import.meta.url);
export const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

const MODE_KEYS = ['bg', 'surface', 'ink', 'line', 'star', 'accent_soft', 'on_accent', 'accent_text', 'muted'];

export function schemaDefaults(schema) {
  const defaults = {};
  for (const group of schema) for (const s of group.settings ?? []) if ('default' in s && s.id) defaults[s.id] = s.default;
  return defaults;
}

// Returns the derived tokens for both modes of one settings object.
export function themeTokens(settings) {
  const shared = { accent: settings.accent_color, success: settings.success_color, dark_text: settings.light_ink };
  const modes = {};
  for (const mode of ['light', 'dark']) {
    const values = Object.fromEntries(MODE_KEYS.map((k) => [k, settings[`${mode}_${k}`] || '']));
    modes[mode] = deriveMode(values, shared);
  }
  return modes;
}

export function settingsSets() {
  const defaults = schemaDefaults(readJson('config/settings_schema.json'));
  const data = readJson('config/settings_data.json');
  const sets = [];
  if (data.current && typeof data.current === 'object') sets.push(['current', { ...defaults, ...data.current }]);
  for (const [name, preset] of Object.entries(data.presets ?? {})) sets.push([name, { ...defaults, ...preset }]);
  return sets;
}

// The reference demo's presets as given, including its opacity-faded text, for the plan's audit.
const DEMO_PAIRS = [
  ['text on background', 'ink', 'bg', 4.5],
  ['button text', 'onAccent', 'accent', 4.5],
  ['accent as text', 'accent', 'bg', 4.5],
  ['accent on selected fill', 'accent', 'accentSoft', 4.5],
  ['faded text (60%)', ['ink', 0.6], 'bg', 4.5],
  ['strike-through price (50%)', ['ink', 0.5], 'bg', 4.5],
  ['line as input border', 'line', 'bg', 3],
];

function demoFailures(name, p) {
  const pick = (k) => (Array.isArray(k) ? overlay(p[k[0]], p.bg, k[1]) : p[k]);
  return DEMO_PAIRS.map(([label, fg, bg, min]) => [label, contrast(pick(fg), pick(bg)), min])
    .filter(([, ratio, min]) => ratio < min)
    .map(([label, ratio, min]) => `${name}: ${label} is ${ratio.toFixed(2)}:1 (needs ${min}:1)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--demo')) {
    const found = Object.entries(readJson('data/demo-content.json').presets).flatMap(([n, p]) => demoFailures(n, p));
    console.log(found.join('\n') + `\n\n${found.length} contrast failure(s) in the reference presets as given (report only).`);
  } else {
    const found = settingsSets().flatMap(([name, settings]) =>
      Object.entries(themeTokens(settings)).flatMap(([mode, tokens]) => failures(`${name} (${mode})`, tokens)),
    );
    if (found.length) {
      console.error(found.join('\n') + `\n\n${found.length} contrast failure(s).`);
      process.exit(1);
    }
    console.log(`Contrast check passed: ${settingsSets().length} setting sets × 2 modes.`);
  }
}
