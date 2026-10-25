// Derives the contrast-safe design tokens for one color mode.
//
// This mirrors snippets/tokens-mode.liquid step for step, using the same
// color_mix weights and contrast targets, so the CI contrast check tests
// exactly what the storefront renders. Change both files together.
import { contrast, mix } from './color.mjs';

// Liquid's color_contrast rounds to one decimal, so the theme aims above
// the WCAG minimums to keep a rounded-up 4.45 from passing as 4.5.
export const TEXT_TARGET = 4.6;
export const UI_TARGET = 3.1;

// Liquid: {{ a | color_mix: b, weight }} keeps `weight` percent of `a`.
const liquidMix = (a, b, weight) => mix(b, a, weight / 100);

const passes = (color, backgrounds, target) => backgrounds.every((bg) => contrast(color, bg) >= target);

// First candidate from `weights` that passes, else the last one tried.
function firstPassing(make, weights, backgrounds, target) {
  let color;
  for (const weight of weights) {
    color = make(weight);
    if (passes(color, backgrounds, target)) break;
  }
  return color;
}

const range = (from, to, step) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

export function pickOn(color, light, dark) {
  return contrast(color, light) >= contrast(color, dark) ? light : dark;
}

// mode: { bg, surface, ink, line, star?, accent_soft?, on_accent?, accent_text?, muted? }
// shared: { accent, success, dark_text }  dark_text is the darkest text color the theme offers.
export function deriveMode(mode, shared) {
  const { bg, surface, ink, line } = mode;
  const { accent, success, dark_text: darkText } = shared;
  const accentSoft = mode.accent_soft || liquidMix(accent, bg, 16);
  const onAccent = mode.on_accent || pickOn(accent, '#FFFFFF', darkText);
  const accentText =
    mode.accent_text ||
    firstPassing((w) => liquidMix(accent, ink, w), range(100, 0, -5), [bg, surface, accentSoft], TEXT_TARGET);
  // Muted text also sits on selected tiers and plans (accent-soft), so it must pass there too.
  const muted = mode.muted || firstPassing((w) => liquidMix(ink, bg, w), range(55, 100, 5), [bg, surface, accentSoft], TEXT_TARGET);
  const inputBorder = firstPassing((w) => liquidMix(ink, bg, w), range(30, 100, 5), [bg, surface], UI_TARGET);
  // Stars are graphics, so they need 3:1 (WCAG 1.4.11); keep the brand accent when it qualifies.
  const star = mode.star || (contrast(accent, bg) >= UI_TARGET && contrast(accent, surface) >= UI_TARGET ? accent : accentText);
  const onSuccess = pickOn(success, '#FFFFFF', darkText);
  return { bg, surface, ink, line, accent, accentSoft, onAccent, accentText, muted, inputBorder, star, success, onSuccess };
}

// The pairs every preset and mode must pass: [label, foreground, background, minimum].
export const REQUIRED_PAIRS = [
  ['text on background', 'ink', 'bg', 4.5],
  ['text on surface', 'ink', 'surface', 4.5],
  ['muted text on background', 'muted', 'bg', 4.5],
  ['muted text on surface', 'muted', 'surface', 4.5],
  ['muted text on selected fill', 'muted', 'accentSoft', 4.5],
  ['accent text on background', 'accentText', 'bg', 4.5],
  ['accent text on surface', 'accentText', 'surface', 4.5],
  ['accent text on selected fill', 'accentText', 'accentSoft', 4.5],
  ['text on selected fill', 'ink', 'accentSoft', 4.5],
  ['button text', 'onAccent', 'accent', 4.5],
  ['free-gift badge text', 'onSuccess', 'success', 4.5],
  ['rating stars on background', 'star', 'bg', 3],
  ['rating stars on surface', 'star', 'surface', 3],
  ['input border on background', 'inputBorder', 'bg', 3],
  ['input border on surface', 'inputBorder', 'surface', 3],
];

export function failures(name, tokens, pairs = REQUIRED_PAIRS) {
  return pairs
    .map(([label, fg, bg, min]) => [label, contrast(tokens[fg], tokens[bg]), min])
    .filter(([, ratio, min]) => ratio < min)
    .map(([label, ratio, min]) => `${name}: ${label} is ${ratio.toFixed(2)}:1 (needs ${min}:1)`);
}
