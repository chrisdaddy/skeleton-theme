// Color math for contrast checks (WCAG 2.x relative luminance and contrast ratio).

export function parseHex(hex) {
  const h = String(hex).trim().replace(/^#/, '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Not a hex color: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

export function toHex(rgb) {
  return '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function channel(c) {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(color) {
  const [r, g, b] = typeof color === 'string' ? parseHex(color) : color;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Mix `a` toward `b` by `t` (0 = a, 1 = b) in sRGB, as CSS color-mix(in srgb) does.
export function mix(a, b, t) {
  const [x, y] = [parseHex(a), parseHex(b)];
  return toHex(x.map((c, i) => c * (1 - t) + y[i] * t));
}

// Composite `fg` at `alpha` over `bg`, which is what opacity-faded text renders as.
export function overlay(fg, bg, alpha) {
  return mix(bg, fg, alpha);
}
