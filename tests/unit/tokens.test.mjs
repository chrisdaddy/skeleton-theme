import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast, mix } from '../../tools/lib/color.mjs';
import { deriveMode, failures } from '../../tools/lib/tokens.mjs';
import { settingsSets, themeTokens } from '../../tools/contrast-check.mjs';

test("matches Shopify's documented color_mix example", () => {
  // {{ '#E800B0' | color_mix: '#00936F', 50 }} → #744a90
  assert.equal(mix('#00936F', '#E800B0', 0.5), '#744A90');
});

test('derives readable tokens from the reference presets that fail as given', () => {
  const shared = (accent) => ({ accent, success: '#1F7A4D', dark_text: '#1F1A14' });
  // GOODBOY: white on orange is 3.27:1, so the button text switches to the dark ink.
  const goodboy = deriveMode({ bg: '#FFFCF5', surface: '#FFF0D6', ink: '#1F1A14', line: '#F1E2C6' }, shared('#F0611A'));
  assert.equal(goodboy.onAccent, '#1F1A14');
  assert.ok(contrast(goodboy.accentText, '#FFFCF5') >= 4.5);
  // DREAMR: violet text on near-black is 3.42:1, so accent text lightens toward the ink.
  const dreamr = deriveMode({ bg: '#0E0A1C', surface: '#1A1332', ink: '#FFFFFF', line: '#2C2450' }, shared('#7C3AED'));
  assert.deepEqual(failures('dreamr', dreamr), []);
});

test('every preset passes in both modes', () => {
  for (const [name, settings] of settingsSets()) {
    for (const [mode, tokens] of Object.entries(themeTokens(settings))) {
      assert.deepEqual(failures(`${name} (${mode})`, tokens), []);
    }
  }
});

test('ships the three presets from the brief', () => {
  assert.deepEqual(
    settingsSets().map(([name]) => name),
    ['Clinical', 'Editorial', 'Bold'],
  );
});
