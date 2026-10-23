import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast, luminance, mix, overlay, parseHex } from '../../tools/lib/color.mjs';
import { check } from '../../tools/contrast-check.mjs';

test('parses short and long hex', () => {
  assert.deepEqual(parseHex('#fff'), [1, 1, 1]);
  assert.deepEqual(parseHex('000000'), [0, 0, 0]);
  assert.throws(() => parseHex('#12'));
});

test('matches the WCAG reference ratios', () => {
  assert.equal(luminance('#FFFFFF'), 1);
  assert.equal(contrast('#000000', '#FFFFFF'), 21);
  assert.equal(contrast('#FFFFFF', '#000000'), 21);
  assert.equal(contrast('#777777', '#FFFFFF').toFixed(2), '4.48');
});

test('mixes and overlays in sRGB', () => {
  assert.equal(mix('#000000', '#FFFFFF', 0.5), '#808080');
  assert.equal(overlay('#000000', '#FFFFFF', 0.25), '#BFBFBF');
});

test('flags the failures the plan found in the reference presets', () => {
  const editorial = { bg: '#F6F1E8', accent: '#B5532E', ink: '#2A2420' };
  const goodboy = { accent: '#F0611A', onAccent: '#FFFFFF' };
  assert.equal(check('editorial', editorial, [['accent as text', 'accent', 'bg', 4.5]]).length, 1);
  assert.equal(check('goodboy', goodboy, [['button text', 'onAccent', 'accent', 4.5]]).length, 1);
  assert.equal(check('editorial', editorial, [['text', 'ink', 'bg', 4.5]]).length, 0);
});
