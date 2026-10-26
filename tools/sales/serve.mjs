#!/usr/bin/env node
// Serves the static sales site (site/) for local checks. No dependencies. Text files are
// gzipped, as Cloudflare Pages compresses them in production.
//
//   node tools/sales/serve.mjs [port]      default 4173; port 0 picks a free one
//
// Also importable: `const { url, close } = await serveSite(0)`.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createGzip } from 'node:zlib';
import { extname, join, normalize } from 'node:path';
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
    if (!path.startsWith(root)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    if (!existsSync(path) || !statSync(path).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    const type = TYPES[extname(path)] ?? 'application/octet-stream';
    const gzip = /text|json|svg/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
    // no-cache: edits show on the next reload.
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache', vary: 'accept-encoding', ...(gzip && { 'content-encoding': 'gzip' }) });
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(path);
    (gzip ? stream.pipe(createGzip()) : stream).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(port, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() })),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await serveSite(Number(process.argv[2] ?? 4173));
  console.log(`Sales site at ${url} (Ctrl+C to stop)`);
}
