// Labelled placeholder images for the demo stores: each one names the photo it stands in for
// (the reference copy's `photo` text), so the shot list and the store agree until real
// photography replaces them. Rendered to PNG in Chromium (the preview's playwright-core).
//
//   const render = await imageRenderer(); const png = await render(file, preset); await render.close();

const playwright = new URL('../preview/node_modules/playwright-core/index.mjs', import.meta.url);

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Product shots are square; section photos are landscape.
export const sizeFor = (file) => (/-photo-/.test(file.filename) ? { width: 1600, height: 1067 } : { width: 1200, height: 1200 });

export function placeholderHtml(file, preset = {}, brand = '') {
  const { width, height } = sizeFor(file);
  const bg = preset.surface ?? '#E8E8E4';
  const ink = preset.ink ?? '#1A1A1A';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; }
    body { width: ${width}px; height: ${height}px; display: grid; place-items: center; background: ${bg}; color: ${ink};
      font-family: 'Liberation Sans', Arial, sans-serif; position: relative; overflow: hidden; }
    .frame { position: absolute; inset: 40px; border: 2px dashed color-mix(in srgb, ${ink} 25%, transparent); border-radius: 12px; }
    .label { max-width: 72%; text-align: center; font-size: ${Math.round(width / 26)}px; line-height: 1.3; }
    .brand { position: absolute; top: 72px; left: 0; right: 0; text-align: center; font-size: ${Math.round(width / 50)}px; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.6; }
    .note { position: absolute; bottom: 72px; left: 0; right: 0; text-align: center; font-size: ${Math.round(width / 60)}px; opacity: 0.6; }
  </style></head><body><div class="frame"></div><div class="brand">${escape(brand)}</div><div class="label">${escape(file.label)}</div><div class="note">Placeholder · photography to come</div></body></html>`;
}

export async function imageRenderer({ preset, brand } = {}) {
  const { chromium } = await import(playwright);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const render = async (file) => {
    const size = sizeFor(file);
    await page.setViewportSize(size);
    await page.setContent(placeholderHtml(file, preset, brand));
    return page.screenshot({ type: 'png' });
  };
  render.close = () => browser.close();
  return render;
}

// Uploads bytes to a staged upload target (multipart form with the target's parameters first).
export async function stagedUpload(target, filename, bytes, fetchImpl = fetch) {
  const form = new FormData();
  for (const { name, value } of target.parameters) form.append(name, value);
  form.append('file', new Blob([bytes], { type: 'image/png' }), filename);
  const response = await fetchImpl(target.url, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`Upload of ${filename} failed: ${response.status} ${(await response.text()).slice(0, 200)}`);
}
