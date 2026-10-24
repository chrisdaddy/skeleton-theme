-- Blueprint Portal (Cloudflare D1). Apply with:
--   npx wrangler d1 execute blueprint-portal --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,            -- Shopify order ID
  name TEXT NOT NULL,             -- e.g. #1001
  email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS licenses (
  key TEXT PRIMARY KEY,           -- BP-XXXX-XXXX-XXXX-XXXX
  order_id TEXT NOT NULL REFERENCES orders(id),
  line_item_id TEXT NOT NULL,
  product TEXT NOT NULL,          -- theme | agency | license | dfy
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',   -- active | revoked
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS licenses_email ON licenses(email);
CREATE INDEX IF NOT EXISTS licenses_line ON licenses(line_item_id);

CREATE TABLE IF NOT EXISTS activations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL REFERENCES licenses(key),
  shop TEXT NOT NULL,             -- *.myshopify.com
  activated_at TEXT NOT NULL,
  deactivated_at TEXT
);
CREATE INDEX IF NOT EXISTS activations_key ON activations(key);

CREATE TABLE IF NOT EXISTS magic_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS releases (
  version TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT ''  -- the CHANGELOG section (Markdown)
);
