#!/usr/bin/env node
// Serves the static sales site (site/) for local checks. No dependencies.
//
//   node tools/sales/serve.mjs [port]      default 4173; port 0 picks a free one
//
// Also importable: `const { url, close } = await serveSite(0)`.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../site/', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export function serveSite(port = 4173) {
  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    let path = normalize(join(root, decodeURIComponent(pathname)));
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep) && path !== root.slice(0, -1)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    if (!existsSync(path) || !statSync(path).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    const type = TYPES[extname(path)] ?? 'application/octet-stream';
    // Long cache for fingerprint-free assets is wrong in production; locally, revalidate everything.
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    createReadStream(path).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(port, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() })),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await serveSite(Number(process.argv[2] ?? 4173));
  console.log(`Sales site at ${url} (Ctrl+C to stop)`);
}
