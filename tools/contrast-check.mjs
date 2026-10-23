#!/usr/bin/env node
// Fails when any theme color pair falls below WCAG contrast minimums.
//
//   node tools/contrast-check.mjs          check config/settings_data.json (current + presets)
//   node tools/contrast-check.mjs --demo   report on the reference presets in data/demo-content.json
//
// Text pairs need 4.5:1. Pairs listed under UI need 3:1 (WCAG 1.4.11).
import { readFileSync } from 'node:fs';
import { contrast, overlay } from './lib/color.mjs';

const root = new URL('../', import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//, ''));

// [label, foreground key, background key, minimum ratio]
const SETTINGS_PAIRS = [
  ['text on background', 'color_ink', 'color_bg', 4.5],
  ['text on accent', 'color_on_accent', 'color_accent', 4.5],
];

const DEMO_PAIRS = [
  ['text on background', 'ink', 'bg', 4.5],
  ['text on surface', 'ink', 'surface', 4.5],
  ['button text', 'onAccent', 'accent', 4.5],
  ['accent as text', 'accent', 'bg', 4.5],
  ['accent on selected fill', 'accent', 'accentSoft', 4.5],
  ['text on selected fill', 'ink', 'accentSoft', 4.5],
  ['faded text (60%)', ['ink', 0.6], 'bg', 4.5],
  ['strike-through price (50%)', ['ink', 0.5], 'bg', 4.5],
  ['UI: line as input border', 'line', 'bg', 3],
];

function resolve(tokens, key) {
  if (Array.isArray(key)) return overlay(tokens[key[0]], tokens.bg, key[1]);
  return tokens[key];
}

export function check(name, tokens, pairs) {
  const failures = [];
  for (const [label, fg, bg, min] of pairs) {
    const a = resolve(tokens, fg);
    const b = resolve(tokens, bg);
    if (!a || !b) continue;
    const ratio = contrast(a, b);
    if (ratio < min) failures.push(`${name}: ${label} is ${ratio.toFixed(2)}:1 (needs ${min}:1)`);
  }
  return failures;
}

function settingsSets() {
  const schema = readJson('config/settings_schema.json');
  const defaults = {};
  for (const group of schema) for (const s of group.settings ?? []) if (s.type === 'color' && s.default) defaults[s.id] = s.default;
  const data = readJson('config/settings_data.json');
  const sets = [];
  const current = typeof data.current === 'string' ? data.presets?.[data.current] : data.current;
  sets.push(['current', { ...defaults, ...(current ?? {}) }]);
  for (const [name, preset] of Object.entries(data.presets ?? {})) sets.push([`preset "${name}"`, { ...defaults, ...preset }]);
  return sets;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = process.argv.includes('--demo');
  const failures = demo
    ? Object.entries(readJson('data/demo-content.json').presets).flatMap(([name, p]) => check(name, p, DEMO_PAIRS))
    : settingsSets().flatMap(([name, tokens]) => check(name, tokens, SETTINGS_PAIRS));
  if (failures.length) {
    console.error(failures.join('\n'));
    console.error(`\n${failures.length} contrast failure(s).`);
    process.exit(demo ? 0 : 1);
  }
  console.log('Contrast check passed.');
}
