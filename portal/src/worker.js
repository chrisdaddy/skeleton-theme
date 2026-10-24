// Blueprint Portal: a Cloudflare Worker (D1 + R2) that sells nothing itself. The Blueprint sales
// store (a Shopify store) sends order webhooks here; the Portal mints licence keys, binds each
// key to one *.myshopify.com store, signs release downloads for the updater, and gives buyers a
// magic-link portal for their keys and downloads (docs/PLAN.md §13.1).
//
// Routes
//   POST /webhooks/orders/paid           mint keys (idempotent per order)
//   POST /webhooks/refunds/create        revoke keys for refunded line items
//   POST /webhooks/orders/cancelled      revoke every key of the order
//   POST /api/v1/licenses/validate       { key, shop } → binds an unbound key on first use
//   POST /api/v1/licenses/deactivate     { key, shop } → frees the key for another store (3 per 30 days)
//   POST /api/v1/releases/latest         { key, shop } → latest version, signed zip URL, manifest
//   POST /api/v1/releases/manifest       { key, shop, version } → a release manifest
//   GET  /download/<version>?k&exp&sig   the zip (signed, 15-minute links)
//   GET  /  POST /auth/link  GET /auth/callback  GET /account  POST /account/deactivate  POST /auth/logout
//
// No dependencies: Web Crypto, fetch and the D1/R2 bindings only.

export const PRODUCTS = {
  'BP-THEME': { product: 'theme', keys: 1 },
  'BP-AGENCY': { product: 'agency', keys: 5 },
  'BP-LICENSE': { product: 'license', keys: 1 },
  'BP-DFY': { product: 'dfy', keys: 1 },
};
const DOWNLOAD_TTL = 15 * 60;
const MAGIC_TTL = 15 * 60;
const SESSION_TTL = 30 * 24 * 3600;
const TRANSFERS_PER_30_DAYS = 3;
const SHOP = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

const enc = new TextEncoder();
const now = () => new Date();
const iso = (d = now()) => d.toISOString();
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
const fail = (error, status = 400) => json({ error }, status);

// ---------- Crypto ----------

const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
const hmacKey = (secret) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
export const sha256 = async (text) => hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
async function sign(secret, text) {
  return hex(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(text)));
}
async function verifyHex(secret, text, signature) {
  if (!/^[0-9a-f]{64}$/.test(signature ?? '')) return false;
  const bytes = Uint8Array.from(signature.match(/../g).map((h) => parseInt(h, 16)));
  return crypto.subtle.verify('HMAC', await hmacKey(secret), bytes, enc.encode(text));
}
// Shopify signs webhook bodies: base64(HMAC-SHA256(secret, raw body)).
export async function verifyShopifyWebhook(secret, rawBody, header) {
  if (!secret || !header) return false;
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64(header), enc.encode(rawBody));
  } catch {
    return false;
  }
}
const random = (bytes = 32) => crypto.getRandomValues(new Uint8Array(bytes));
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function newKey() {
  const chars = [...random(16)].map((b) => CROCKFORD[b % 32]).join('');
  return `BP-${chars.match(/.{4}/g).join('-')}`;
}
const normalizeKey = (key) => String(key ?? '').trim().toUpperCase();
const normalizeShop = (shop) => String(shop ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

// ---------- Licences ----------

async function licence(env, key) {
  return env.DB.prepare('SELECT * FROM licenses WHERE key = ?').bind(normalizeKey(key)).first();
}
async function activeBinding(env, key) {
  return env.DB.prepare('SELECT * FROM activations WHERE key = ? AND deactivated_at IS NULL ORDER BY id DESC LIMIT 1').bind(key).first();
}

// Valid for this shop: binds the key if it is free (first activation).
export async function validateLicence(env, rawKey, rawShop) {
  const shop = normalizeShop(rawShop);
  if (!SHOP.test(shop)) return { valid: false, reason: 'shop must be a *.myshopify.com domain' };
  const lic = await licence(env, rawKey);
  if (!lic) return { valid: false, reason: 'unknown key' };
  if (lic.status !== 'active') return { valid: false, reason: 'this key was revoked (refund or cancellation)' };
  const bound = await activeBinding(env, lic.key);
  if (bound && bound.shop !== shop) return { valid: false, reason: `this key is active on another store; deactivate it there (or in the Portal) first` };
  if (!bound) await env.DB.prepare('INSERT INTO activations (key, shop, activated_at) VALUES (?, ?, ?)').bind(lic.key, shop, iso()).run();
  return { valid: true, key: lic.key, shop, product: lic.product };
}

export async function deactivateLicence(env, rawKey, rawShop) {
  const lic = await licence(env, rawKey);
  if (!lic) return { ok: false, reason: 'unknown key' };
  const bound = await activeBinding(env, lic.key);
  if (!bound || bound.shop !== normalizeShop(rawShop)) return { ok: false, reason: 'the key is not active on that store' };
  const since = iso(new Date(Date.now() - 30 * 24 * 3600 * 1000));
  const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM activations WHERE key = ? AND deactivated_at >= ?').bind(lic.key, since).first();
  if (count >= TRANSFERS_PER_30_DAYS) return { ok: false, reason: `at most ${TRANSFERS_PER_30_DAYS} transfers in 30 days; contact support` };
  await env.DB.prepare('UPDATE activations SET deactivated_at = ? WHERE id = ?').bind(iso(), bound.id).run();
  return { ok: true };
}

// ---------- Webhooks ----------

async function ordersPaid(env, order) {
  const id = String(order.id);
  if (await env.DB.prepare('SELECT id FROM orders WHERE id = ?').bind(id).first()) return { minted: 0, duplicate: true };
  const email = String(order.email ?? order.customer?.email ?? order.contact_email ?? '').toLowerCase();
  const statements = [env.DB.prepare('INSERT INTO orders (id, name, email, created_at) VALUES (?, ?, ?, ?)').bind(id, String(order.name ?? id), email, iso())];
  let minted = 0;
  for (const item of order.line_items ?? []) {
    const spec = PRODUCTS[String(item.sku ?? '').toUpperCase()];
    if (!spec) continue;
    for (let i = 0; i < spec.keys * Number(item.quantity ?? 1); i++) {
      statements.push(env.DB.prepare('INSERT INTO licenses (key, order_id, line_item_id, product, email, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newKey(), id, String(item.id), spec.product, email, iso()));
      minted += 1;
    }
  }
  await env.DB.batch(statements);
  return { minted };
}

async function revoke(env, keys) {
  const at = iso();
  await env.DB.batch(keys.flatMap((key) => [env.DB.prepare("UPDATE licenses SET status = 'revoked', revoked_at = ? WHERE key = ?").bind(at, key), env.DB.prepare('UPDATE activations SET deactivated_at = ? WHERE key = ? AND deactivated_at IS NULL').bind(at, key)]));
  return keys.length;
}

// Refunded quantities revoke that many units' keys, unused keys first.
async function refundsCreate(env, refund) {
  const keys = [];
  for (const line of refund.refund_line_items ?? []) {
    const lineId = String(line.line_item_id ?? line.line_item?.id);
    const sku = String(line.line_item?.sku ?? '').toUpperCase();
    const { results } = await env.DB.prepare(
      `SELECT l.key, (SELECT COUNT(*) FROM activations a WHERE a.key = l.key AND a.deactivated_at IS NULL) AS bound
       FROM licenses l WHERE l.line_item_id = ? AND l.status = 'active' ORDER BY bound ASC, l.created_at DESC`,
    ).bind(lineId).all();
    const perUnit = PRODUCTS[sku]?.keys ?? (results.length && line.quantity ? Math.max(1, Math.round(results.length / Number(line.quantity))) : 1);
    keys.push(...results.slice(0, perUnit * Number(line.quantity ?? 1)).map((r) => r.key));
  }
  return { revoked: await revoke(env, keys) };
}

async function ordersCancelled(env, order) {
  const { results } = await env.DB.prepare("SELECT key FROM licenses WHERE order_id = ? AND status = 'active'").bind(String(order.id)).all();
  return { revoked: await revoke(env, results.map((r) => r.key)) };
}

// ---------- Releases ----------

async function latestRelease(env) {
  const { results } = await env.DB.prepare('SELECT version, date, notes FROM releases').all();
  return results.sort((a, b) => compareVersions(b.version, a.version))[0] ?? null;
}
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}
async function manifest(env, version) {
  const object = await env.RELEASES.get(`releases/${version}/manifest.json`);
  return object ? JSON.parse(await object.text()) : null;
}
export async function signedDownload(env, version, key) {
  const exp = Math.floor(Date.now() / 1000) + DOWNLOAD_TTL;
  const k = (await sha256(key)).slice(0, 16);
  const sig = await sign(env.SIGNING_SECRET, `${version}|${exp}|${k}`);
  return `${env.PORTAL_URL}/download/${version}?k=${k}&exp=${exp}&sig=${sig}`;
}

async function download(env, version, params) {
  const exp = Number(params.get('exp'));
  if (!/^\d+\.\d+\.\d+$/.test(version) || !exp || exp < Date.now() / 1000) return new Response('Link expired', { status: 403 });
  if (!(await verifyHex(env.SIGNING_SECRET, `${version}|${exp}|${params.get('k')}`, params.get('sig')))) return new Response('Invalid link', { status: 403 });
  const object = await env.RELEASES.get(`releases/${version}/blueprint-${version}.zip`);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="blueprint-${version}.zip"`, 'cache-control': 'private, no-store' } });
}

// ---------- Portal (magic links) ----------

const COOKIE = 'bp_session';
const page = (env, title, body) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)} · Blueprint Portal</title>
<style>:root{color-scheme:light dark;--ink:#0f1a14;--bg:#f7f7f2;--line:#d8ded2;--accent:#17533d}@media(prefers-color-scheme:dark){:root{--ink:#f3f0e8;--bg:#0b1526;--line:#243350;--accent:#7fd1ae}}
body{margin:0;font:16px/1.5 system-ui,sans-serif;color:var(--ink);background:var(--bg)}main{max-width:760px;margin:0 auto;padding:32px 16px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--line);vertical-align:top}code{font-size:.9em}
input,button{font:inherit;padding:10px 14px;border-radius:8px;border:1px solid var(--line)}button{background:var(--accent);color:var(--bg);border:0;cursor:pointer}a{color:var(--accent)}:focus-visible{outline:3px solid var(--accent);outline-offset:2px}</style></head>
<body><main>${body}</main></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" } },
  );
function escape(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function sendEmail(env, to, subject, text) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
  });
  if (!response.ok) throw new Error(`email failed: ${response.status}`);
}

async function requestLink(env, email) {
  const address = String(email ?? '').trim().toLowerCase();
  const generic = page(env, 'Check your email', `<h1>Check your email</h1><p>If we have a Blueprint purchase for that address, a sign-in link is on its way. It works for 15 minutes.</p>`);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return generic;
  const owns = await env.DB.prepare('SELECT 1 FROM licenses WHERE email = ? LIMIT 1').bind(address).first();
  if (!owns) return generic;
  const hourAgo = iso(new Date(Date.now() - 3600 * 1000));
  const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM magic_links WHERE email = ? AND created_at >= ?').bind(address, hourAgo).first();
  if (count >= 5) return generic;
  const token = hex(random(32));
  await env.DB.prepare('INSERT INTO magic_links (token_hash, email, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(await sha256(token), address, iso(new Date(Date.now() + MAGIC_TTL * 1000)), iso()).run();
  await sendEmail(env, address, 'Your Blueprint Portal sign-in link', `Sign in to the Blueprint Portal:\n\n${env.PORTAL_URL}/auth/callback?token=${token}\n\nThe link works once, for 15 minutes. If you didn't ask for it, ignore this email.`);
  return generic;
}

async function callback(env, token) {
  const hash = await sha256(String(token ?? ''));
  const link = await env.DB.prepare('SELECT * FROM magic_links WHERE token_hash = ?').bind(hash).first();
  if (!link || link.used_at || link.expires_at < iso()) return page(env, 'Link expired', `<h1>That link has expired</h1><p><a href="/">Request a new one</a>.</p>`);
  const session = hex(random(32));
  await env.DB.batch([
    env.DB.prepare('UPDATE magic_links SET used_at = ? WHERE token_hash = ?').bind(iso(), hash),
    env.DB.prepare('INSERT INTO sessions (id_hash, email, expires_at) VALUES (?, ?, ?)').bind(await sha256(session), link.email, iso(new Date(Date.now() + SESSION_TTL * 1000))),
  ]);
  return new Response(null, { status: 303, headers: { location: '/account', 'set-cookie': `${COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}` } });
}

async function sessionEmail(env, request) {
  const id = /(?:^|;\s*)bp_session=([0-9a-f]{64})/.exec(request.headers.get('cookie') ?? '')?.[1];
  if (!id) return null;
  const session = await env.DB.prepare('SELECT * FROM sessions WHERE id_hash = ?').bind(await sha256(id)).first();
  return session && session.expires_at > iso() ? { email: session.email, id } : null;
}

async function account(env, who) {
  const { results: keys } = await env.DB.prepare(
    `SELECT l.key, l.product, l.status, o.name AS order_name, (SELECT shop FROM activations a WHERE a.key = l.key AND a.deactivated_at IS NULL ORDER BY id DESC LIMIT 1) AS shop
     FROM licenses l JOIN orders o ON o.id = l.order_id WHERE l.email = ? ORDER BY l.created_at`,
  ).bind(who.email).all();
  const csrf = await sign(env.SIGNING_SECRET, `csrf|${who.id}`);
  const latest = await latestRelease(env);
  const activeKey = keys.find((k) => k.status === 'active')?.key;
  const rows = keys
    .map(
      (k) => `<tr><td><code>${escape(k.key)}</code><br><small>${escape(k.product)} · order ${escape(k.order_name)}</small></td><td>${k.status === 'active' ? (k.shop ? escape(k.shop) : 'Not used yet') : 'Revoked'}</td><td>${
        k.status === 'active' && k.shop
          ? `<form method="post" action="/account/deactivate"><input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="key" value="${escape(k.key)}"><input type="hidden" name="shop" value="${escape(k.shop)}"><button>Move to another store</button></form>`
          : ''
      }</td></tr>`,
    )
    .join('');
  const downloadLink = latest && activeKey ? `<p><a href="${await signedDownload(env, latest.version, activeKey)}">Download Blueprint ${escape(latest.version)}</a> (${escape(latest.date)}). The link works for 15 minutes.</p>` : '<p>No download available.</p>';
  return page(
    env,
    'Your licences',
    `<h1>Your Blueprint licences</h1><p>Signed in as ${escape(who.email)}.</p>
<table><thead><tr><th scope="col">Key</th><th scope="col">Store</th><th scope="col"><span hidden>Actions</span></th></tr></thead><tbody>${rows || '<tr><td colspan="3">No licences.</td></tr>'}</tbody></table>
<h2>Download</h2>${downloadLink}
<h2>Updating</h2><p>Run <code>blueprint update</code> or ask the AI kit to update the theme: it installs the new version as an unpublished theme and keeps your settings. See the <a href="${escape(env.DOCS_URL)}/updating">update guide</a>.</p>
${latest ? `<h2>What's new in ${escape(latest.version)}</h2><pre style="white-space:pre-wrap">${escape(latest.notes)}</pre>` : ''}
<p><a href="${escape(env.DOCS_URL)}">Setup docs</a> · <a href="${escape(env.DISCORD_URL)}">Discord</a></p>
<form method="post" action="/auth/logout"><button>Sign out</button></form>`,
  );
}

// ---------- Router ----------

async function body(request) {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return request.json().catch(() => ({}));
  return Object.fromEntries(new URLSearchParams(await request.text()));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    try {
      if (method === 'POST' && pathname.startsWith('/webhooks/')) {
        const raw = await request.text();
        if (!(await verifyShopifyWebhook(env.SHOPIFY_WEBHOOK_SECRET, raw, request.headers.get('x-shopify-hmac-sha256')))) return fail('invalid signature', 401);
        const payload = JSON.parse(raw);
        if (pathname === '/webhooks/orders/paid') return json(await ordersPaid(env, payload));
        if (pathname === '/webhooks/refunds/create') return json(await refundsCreate(env, payload));
        if (pathname === '/webhooks/orders/cancelled') return json(await ordersCancelled(env, payload));
        return fail('unknown webhook', 404);
      }
      if (method === 'POST' && pathname.startsWith('/api/v1/')) {
        const { key, shop, version } = await body(request);
        if (pathname === '/api/v1/licenses/validate') return json(await validateLicence(env, key, shop));
        if (pathname === '/api/v1/licenses/deactivate') return json(await deactivateLicence(env, key, shop));
        const check = await validateLicence(env, key, shop);
        if (!check.valid) return fail(check.reason, 403);
        if (pathname === '/api/v1/releases/latest') {
          const latest = await latestRelease(env);
          if (!latest) return fail('no releases yet', 404);
          return json({ version: latest.version, date: latest.date, notes: latest.notes, zip_url: await signedDownload(env, latest.version, check.key), manifest: await manifest(env, latest.version) });
        }
        if (pathname === '/api/v1/releases/manifest') {
          const found = /^\d+\.\d+\.\d+$/.test(String(version)) ? await manifest(env, version) : null;
          return found ? json(found) : fail('unknown version', 404);
        }
        return fail('not found', 404);
      }
      if (method === 'GET' && pathname.startsWith('/download/')) return download(env, pathname.slice('/download/'.length), url.searchParams);
      if (method === 'GET' && pathname === '/') {
        return page(env, 'Sign in', `<h1>Blueprint Portal</h1><p>Your licence keys, downloads and updates. Enter the email you bought Blueprint with and we'll send you a sign-in link.</p>
<form method="post" action="/auth/link"><label for="email">Email</label><br><input id="email" name="email" type="email" autocomplete="email" required> <button>Send link</button></form>`);
      }
      if (method === 'POST' && pathname === '/auth/link') return requestLink(env, (await body(request)).email);
      if (method === 'GET' && pathname === '/auth/callback') return callback(env, url.searchParams.get('token'));
      const who = await sessionEmail(env, request);
      if (pathname === '/account' && method === 'GET') return who ? account(env, who) : new Response(null, { status: 303, headers: { location: '/' } });
      if (pathname === '/account/deactivate' && method === 'POST') {
        if (!who) return fail('sign in first', 401);
        const form = await body(request);
        if (!(await verifyHex(env.SIGNING_SECRET, `csrf|${who.id}`, form.csrf))) return fail('invalid form token', 403);
        const owned = await env.DB.prepare('SELECT key FROM licenses WHERE key = ? AND email = ?').bind(normalizeKey(form.key), who.email).first();
        if (!owned) return fail('not your key', 403);
        const result = await deactivateLicence(env, form.key, form.shop);
        return result.ok ? new Response(null, { status: 303, headers: { location: '/account' } }) : page(env, 'Not moved', `<h1>Couldn't free that key</h1><p>${escape(result.reason)}.</p><p><a href="/account">Back</a></p>`);
      }
      if (pathname === '/auth/logout' && method === 'POST') {
        if (who) await env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(await sha256(who.id)).run();
        return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });
      }
      return fail('not found', 404);
    } catch (error) {
      console.error(error);
      return fail('server error', 500);
    }
  },
};
