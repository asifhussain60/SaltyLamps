-- Cloudflare D1 schema for the Salty Lamps catalog, inventory, and orders.
-- Apply with: wrangler d1 execute salty-lamps-db --file=d1/schema.sql

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,              -- Wix product handleId, kept stable across re-imports
  name TEXT NOT NULL,
  slug TEXT NOT NULL DEFAULT '',            -- URL slug, e.g. /product-page/<slug>
  description TEXT NOT NULL DEFAULT '',     -- plain text, stripped/trimmed from Wix's HTML description
  image TEXT NOT NULL DEFAULT '',           -- site-relative path, e.g. /media/live-site-products/foo.jpg
  categories TEXT NOT NULL DEFAULT '',      -- comma-separated category slugs, e.g. "salt-lamps,special-deal"
  tags TEXT NOT NULL DEFAULT '',            -- comma-separated, e.g. "Lamp,Bestseller"
  visible INTEGER NOT NULL DEFAULT 1
);

-- Category display metadata — the taxonomy the storefront used to hardcode.
-- See d1/migrations/003-categories-and-settings.sql for the rationale, and note
-- that a fresh install still needs that file's INSERTs: an empty categories table
-- renders a 404 for every /category/* URL.
CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'lamp',   -- one of the nine theme sets in src/styles/saltylamps.css
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  is_virtual INTEGER NOT NULL DEFAULT 0, -- 1 = catch-all bucket ('all-products'), not merchandising
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_visible ON categories(visible, sort_order);

-- Old category slugs that must keep resolving (301 targets).
CREATE TABLE IF NOT EXISTS category_aliases (
  alias TEXT PRIMARY KEY,
  slug TEXT NOT NULL REFERENCES categories(slug)
);

-- Typed operational settings (low-stock threshold, currency, site URL). Kept apart
-- from marketing copy so a copy edit can never change a business rule.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string' CHECK (value_type IN ('string', 'int', 'bool', 'json')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- NOTE: sku is NOT declared UNIQUE. The live Wix catalog currently reuses two SKU
-- codes across unrelated products (ST-841, SL-2) — a data problem worth fixing at
-- the source, not something this schema should silently assume can't happen.
-- order_items therefore references skus.id (the surrogate key), not skus.sku.
CREATE TABLE IF NOT EXISTS skus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_label TEXT NOT NULL DEFAULT '',  -- '' for a standalone product with no variants
  price_pence INTEGER NOT NULL,
  track_mode TEXT NOT NULL CHECK (track_mode IN ('quantity', 'binary')),
  quantity INTEGER,                 -- set when track_mode = 'quantity'; null for 'binary'
  in_stock INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_skus_product_id ON skus(product_id);
CREATE INDEX IF NOT EXISTS idx_skus_sku ON skus(sku);

-- A product's image gallery. products.image always mirrors the primary image here
-- (lowest sort_order) — see d1/migrations/002-product-gallery.sql for the rationale.
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id),
  key TEXT,                          -- R2 object key; NULL for legacy static /media/... paths
  path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,              -- Stripe Checkout Session id
  payment_intent TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded', 'cancelled')),
  customer_email TEXT,
  amount_total_pence INTEGER,
  currency TEXT NOT NULL DEFAULT 'gbp',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Fulfilment lifecycle, distinct from the Stripe payment `status` above.
  fulfilment_status TEXT NOT NULL DEFAULT 'unfulfilled'
    CHECK (fulfilment_status IN ('unfulfilled', 'packed', 'shipped', 'delivered')),
  tracking_number TEXT,
  shipped_at TEXT,
  -- Shipping address captured from Stripe at checkout (needed to pack and post).
  ship_name TEXT,
  ship_line1 TEXT,
  ship_line2 TEXT,
  ship_city TEXT,
  ship_postcode TEXT,
  ship_country TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id TEXT NOT NULL REFERENCES orders(id),
  sku_id INTEGER NOT NULL REFERENCES skus(id),
  quantity INTEGER NOT NULL,
  unit_price_pence INTEGER NOT NULL,  -- snapshot of price at time of order
  PRIMARY KEY (order_id, sku_id)
);

-- Append-only audit log: every admin write records who did what, to which entity.
-- actor_email comes from the verified Cloudflare Access token (see functions/_middleware.js).
CREATE TABLE IF NOT EXISTS admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,              -- e.g. 'product.update', 'sku.delete', 'order.fulfil', 'image.upload'
  entity TEXT NOT NULL,             -- 'product' | 'sku' | 'order' | 'inventory' | 'image'
  entity_id TEXT,
  detail TEXT,                       -- JSON string with the changed fields / context
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit(created_at);
