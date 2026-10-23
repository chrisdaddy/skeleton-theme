// Offline preview server.
//
// - Renders pages on request (fresh theme code every time):
//     /<Preset>/<page>.html             home, product, styleguide
//     /products/<handle>[?variant=&selling_plan=&tier=&plan=]
//     /products/<handle>?section_id=<id> returns one section (Section Rendering API)
// - Mocks the cart: POST /cart/add(.js) records the payload and keeps an in-memory cart;
//   GET /cart.js returns it; GET /cart shows a plain page (the no-JS add-to-cart landing).
// - Serves /assets from the theme and /fonts from @fontsource.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, PRESET_PRODUCTS, PRODUCTS, presetForHandle, renderPage } from './render.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const theme = join(here, '..', '..');
const roots = {
  '/assets/': join(theme, 'assets'),
  '/fonts/dm-sans/': join(here, 'node_modules/@fontsource/dm-sans'),
  '/fonts/instrument-serif/': join(here, 'node_modules/@fontsource/instrument-serif'),
};
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };

const allVariants = () => [...Object.values(PRESET_PRODUCTS), ...PRODUCTS.gifts].flatMap((p) => p.variants.map((v) => ({ product: p, variant: v })));

export function startServer() {
  const requests = [];
  let cart = [];

  const addLines = (items) => {
    const added = [];
    for (const item of items) {
      const found = allVariants().find((x) => String(x.variant.id) === String(item.id));
      if (!found) {
        const error = new Error('Cannot find variant');
        error.status = 422;
        throw error;
      }
      const line = {
        id: Number(item.id),
        quantity: Number(item.quantity || 1),
        selling_plan: item.selling_plan ? Number(item.selling_plan) : null,
        properties: item.properties || {},
        parent_id: item.parent_id ?? null,
        title: found.product.title,
      };
      cart.push(line);
      added.push(line);
    }
    return added;
  };

  const readBody = (req) => new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });

  // Parses url-encoded or multipart form bodies into { key: [values] } and line items.
  function parseForm(body, contentType) {
    const pairs = [];
    if (contentType.startsWith('multipart/form-data')) {
      const boundary = /boundary=(.+)$/.exec(contentType)[1];
      for (const part of body.split(`--${boundary}`)) {
        const name = /name="([^"]+)"/.exec(part)?.[1];
        if (!name) continue;
        const value = part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
        pairs.push([name, value]);
      }
    } else {
      for (const [k, v] of new URLSearchParams(body)) pairs.push([k, v]);
    }
    const last = (key) => pairs.filter(([k]) => k === key).map(([, v]) => v).at(-1);
    const properties = Object.fromEntries(pairs.filter(([k]) => k.startsWith('properties[')).map(([k, v]) => [k.slice(11, -1), v]));
    return { pairs, item: { id: last('id'), quantity: last('quantity') || 1, selling_plan: last('selling_plan') || null, properties } };
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (status, body, type = 'text/html') => {
      res.writeHead(status, { 'content-type': type });
      res.end(body);
    };
    try {
      for (const [prefix, dir] of Object.entries(roots)) {
        if (url.pathname.startsWith(prefix)) {
          const path = normalize(join(dir, url.pathname.slice(prefix.length)));
          if (!path.startsWith(dir) || !existsSync(path) || !statSync(path).isFile()) return send(404, 'not found', 'text/plain');
          return send(200, readFileSync(path), types[extname(path)] ?? 'application/octet-stream');
        }
      }

      if (url.pathname === '/cart/add.js' || url.pathname === '/cart/add') {
        const body = await readBody(req);
        const contentType = req.headers['content-type'] || '';
        let items;
        let raw;
        if (contentType.includes('application/json')) {
          raw = JSON.parse(body);
          items = raw.items ?? [raw];
        } else {
          const parsed = parseForm(body, contentType);
          raw = parsed.pairs;
          items = [parsed.item];
        }
        requests.push({ path: url.pathname, contentType: contentType.split(';')[0], raw, items });
        try {
          const added = addLines(items);
          if (url.pathname === '/cart/add') {
            res.writeHead(303, { location: '/cart' });
            return res.end();
          }
          return send(200, JSON.stringify(added.length === 1 ? added[0] : { items: added }), 'application/json');
        } catch (error) {
          return send(error.status || 500, JSON.stringify({ status: error.status, message: 'Cart Error', description: error.message }), 'application/json');
        }
      }
      if (url.pathname === '/cart.js') {
        return send(200, JSON.stringify({ item_count: cart.reduce((n, l) => n + l.quantity, 0), items: cart }), 'application/json');
      }
      if (url.pathname === '/cart') {
        return send(200, `<!doctype html><title>Cart</title><h1>Cart</h1><pre id="cart">${JSON.stringify(cart, null, 2)}</pre>`);
      }

      const product = /^\/products\/([\w-]+)$/.exec(url.pathname);
      if (product) {
        const preset = presetForHandle(product[1]);
        if (!preset) return send(404, 'not found', 'text/plain');
        const page = PAGES.find((p) => p.name === 'product');
        const sectionId = url.searchParams.get('section_id');
        const html = await renderPage(preset, page, url.searchParams, sectionId);
        return send(200, html);
      }

      const page = /^\/(\w+)\/(\w+)\.html$/.exec(url.pathname);
      if (page) {
        const def = PAGES.find((p) => p.name === page[2]);
        if (!def || !PRESET_PRODUCTS[page[1]]) return send(404, 'not found', 'text/plain');
        return send(200, await renderPage(page[1], def, url.searchParams));
      }
      return send(404, 'not found', 'text/plain');
    } catch (error) {
      console.error(error);
      return send(500, `<pre>${String(error.stack).replace(/</g, '&lt;')}</pre>`);
    }
  });

  return new Promise((resolve) =>
    server.listen(0, () =>
      resolve({
        base: `http://127.0.0.1:${server.address().port}`,
        requests,
        resetCart: () => {
          cart = [];
          requests.length = 0;
        },
        close: () => server.close(),
      }),
    ),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { base } = await startServer();
  console.log(`Preview running at ${base}/Clinical/product.html (Ctrl+C to stop)`);
}
