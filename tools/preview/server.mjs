// Offline preview server.
//
// - Renders pages on request (fresh theme code every time):
//     /<Preset>/<page>.html             home, product, cart, styleguide
//     /products/<handle>[?variant=&selling_plan=&tier=&plan=]
//     /cart                             the cart page (for the store last looked at)
//   Any page also answers the Section Rendering API: ?section_id=<id> (HTML) or
//   ?sections=a,b (JSON map).
// - Mocks the cart like Shopify's Ajax API (tools/preview/mock-cart.mjs):
//     POST /cart/add(.js), /cart/change(.js), /cart/update(.js); GET /cart/change?id=&quantity=;
//     GET /cart.js. The .js endpoints accept "sections" and return them rendered.
//     Form posts and GETs without .js redirect to /cart, as Shopify does.
//   POST /cart with "checkout" lands on a mock /checkout page showing the total.
// - Serves /assets from the theme and /fonts from @fontsource.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, PRESET_PRODUCTS, cart, presetForHandle, renderPage, session } from './render.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const theme = join(here, '..', '..');
const roots = {
  '/assets/': join(theme, 'assets'),
  '/fonts/dm-sans/': join(here, 'node_modules/@fontsource/dm-sans'),
  '/fonts/instrument-serif/': join(here, 'node_modules/@fontsource/instrument-serif'),
  '/vendor/axe/': join(here, 'node_modules/axe-core'),
};
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };

const page = (name) => PAGES.find((p) => p.name === name);

export function startServer() {
  const requests = [];
  // Test hook: the next cart mutation fails with this status after (optionally) applying.
  const faults = { next: null };

  const readBody = (req) =>
    new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => resolve(data));
    });

  // Parses url-encoded, multipart or JSON bodies into a flat list of [key, value] pairs.
  function parseBody(body, contentType) {
    if (contentType.includes('application/json')) return { json: body ? JSON.parse(body) : {} };
    const pairs = [];
    if (contentType.startsWith('multipart/form-data')) {
      const boundary = /boundary=(.+)$/.exec(contentType)[1];
      for (const part of body.split(`--${boundary}`)) {
        const name = /name="([^"]+)"/.exec(part)?.[1];
        if (!name) continue;
        pairs.push([name, part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '')]);
      }
    } else {
      for (const [k, v] of new URLSearchParams(body)) pairs.push([k, v]);
    }
    return { pairs };
  }

  // A form's fields as one Ajax-style item (the last value of a repeated name wins).
  function itemFromPairs(pairs) {
    const last = (key) => pairs.filter(([k]) => k === key).map(([, v]) => v).at(-1);
    const properties = Object.fromEntries(pairs.filter(([k]) => k.startsWith('properties[')).map(([k, v]) => [k.slice(11, -1), v]));
    return { id: last('id'), quantity: last('quantity') || 1, selling_plan: last('selling_plan') || null, properties };
  }

  async function sectionsFor(list) {
    if (!list) return undefined;
    const ids = (Array.isArray(list) ? list : String(list).split(',')).map((s) => s.trim()).filter(Boolean);
    return renderPage(session.preset, page(ids.includes('main') ? 'cart' : 'home'), new URLSearchParams(), ids);
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (status, body, type = 'text/html') => {
      res.writeHead(status, { 'content-type': type });
      res.end(body);
    };
    const redirect = (location) => {
      res.writeHead(303, { location });
      res.end();
    };
    const fail = (error) => send(error.status || 500, JSON.stringify({ status: error.status, message: 'Cart Error', description: error.message }), 'application/json');

    try {
      for (const [prefix, dir] of Object.entries(roots)) {
        if (url.pathname.startsWith(prefix)) {
          const path = normalize(join(dir, url.pathname.slice(prefix.length)));
          if (!path.startsWith(dir) || !existsSync(path) || !statSync(path).isFile()) return send(404, 'not found', 'text/plain');
          return send(200, readFileSync(path), types[extname(path)] ?? 'application/octet-stream');
        }
      }

      // ---------- Cart API ----------
      const cartAction = /^\/cart\/(add|change|update)(\.js)?$/.exec(url.pathname);
      if (cartAction) {
        const [, action, ajax] = cartAction;
        const contentType = req.headers['content-type'] || '';
        const parsed = req.method === 'GET' ? { pairs: [...url.searchParams] } : parseBody(await readBody(req), contentType);
        const body = parsed.json ?? null;
        const pairs = parsed.pairs ?? [];
        const field = (key) => (body ? body[key] : pairs.filter(([k]) => k === key).map(([, v]) => v).at(-1));
        let items = [];
        if (action === 'add') items = body ? (body.items ?? [body]) : [itemFromPairs(pairs)];
        requests.push({ path: url.pathname, method: req.method, contentType: contentType.split(';')[0], raw: body ?? pairs, items, sections: field('sections') ?? null });

        const fault = faults.next;
        faults.next = null;
        try {
          if (fault?.before) throw Object.assign(new Error(fault.message), { status: fault.status });
          let added = [];
          if (action === 'add') added = cart.add(items);
          if (action === 'change') cart.change({ id: field('id'), line: field('line'), quantity: field('quantity') });
          if (action === 'update') {
            const updates = body ? body.updates : Object.fromEntries(pairs.filter(([k]) => k.startsWith('updates[')).map(([k, v]) => [k.slice(8, -1), v]));
            cart.update(updates || {});
          }
          if (fault) throw Object.assign(new Error(fault.message), { status: fault.status });
          if (!ajax) return redirect('/cart');
          const sections = await sectionsFor(field('sections'));
          const view = cart.json(session.preset);
          let response;
          if (action === 'add') {
            const lines = added.map((l) => view.items.find((i) => i.key === l.key));
            response = body?.items ? { items: lines } : lines[0];
          } else {
            response = view;
          }
          if (sections) response = { ...response, sections };
          return send(200, JSON.stringify(response), 'application/json');
        } catch (error) {
          if (!ajax) return redirect('/cart');
          return fail(error);
        }
      }
      if (url.pathname === '/cart.js') return send(200, JSON.stringify(cart.json(session.preset)), 'application/json');
      if (url.pathname === '/cart' && req.method === 'POST') {
        const { pairs } = parseBody(await readBody(req), req.headers['content-type'] || '');
        requests.push({ path: '/cart', method: 'POST', raw: pairs, items: [] });
        return redirect(pairs.some(([k]) => k === 'checkout') ? '/checkout' : '/cart');
      }
      if (url.pathname === '/checkout') {
        const view = cart.json(session.preset);
        return send(200, `<!doctype html><title>Checkout (mock)</title><h1>Checkout (mock)</h1><p id="total">${view.total_price}</p><pre id="cart">${JSON.stringify(view.items.map((i) => ({ id: i.id, quantity: i.quantity, final_line_price: i.final_line_price })), null, 2)}</pre>`);
      }

      // ---------- Pages ----------
      const sectionsParam = url.searchParams.get('sections');
      const sectionId = url.searchParams.get('section_id');
      const respond = async (preset, def) => {
        if (sectionsParam) return send(200, JSON.stringify(await renderPage(preset, def, url.searchParams, sectionsParam.split(','))), 'application/json');
        return send(200, await renderPage(preset, def, url.searchParams, sectionId));
      };

      if (url.pathname === '/cart') return respond(session.preset, page('cart'));
      if (url.pathname === '/') return respond(session.preset, page('home'));

      const product = /^\/products\/([\w-]+)$/.exec(url.pathname);
      if (product) {
        const preset = presetForHandle(product[1]);
        if (!preset) return send(404, 'not found', 'text/plain');
        session.preset = preset;
        return respond(preset, page('product'));
      }

      const named = /^\/(\w+)\/(\w+)\.html$/.exec(url.pathname);
      if (named) {
        const def = page(named[2]);
        if (!def || !PRESET_PRODUCTS[named[1]]) return send(404, 'not found', 'text/plain');
        session.preset = named[1];
        return respond(named[1], def);
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
        faults,
        cart,
        session,
        resetCart: () => {
          cart.clear();
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
