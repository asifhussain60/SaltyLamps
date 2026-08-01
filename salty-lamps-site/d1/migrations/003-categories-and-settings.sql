-- Migration 003 — Category taxonomy, slug aliases, and settings.
--
-- Why a migration file: `CREATE TABLE IF NOT EXISTS` in d1/schema.sql is a no-op
-- against a database that already has these tables, so anything new must arrive
-- here as well (see d1/migrations/001-admin-portal.sql for the original lesson).
--
-- UNLIKE 001, THIS FILE IS IDEMPOTENT AND SAFE TO RE-RUN. Every statement is
-- `CREATE TABLE IF NOT EXISTS` or `INSERT OR IGNORE`. That matters because
-- deploy-production.sh loops over d1/migrations/*.sql on EVERY run, not just the
-- first — 001's bare ALTER TABLEs error on a second pass; these do not.
--
-- Apply once to each existing database:
--   Local:  wrangler d1 execute salty-lamps-db --local  --file=d1/migrations/003-categories-and-settings.sql
--   Remote: wrangler d1 execute salty-lamps-db --remote --file=d1/migrations/003-categories-and-settings.sql
--
-- LOCAL GOTCHA (bit us on 2026-08-01): `wrangler d1 execute --local` and
-- `wrangler pages dev --d1 DB=...` can resolve to DIFFERENT sqlite files under
-- .wrangler/state/v3/d1/miniflare-D1DatabaseObject/. Verify through the running
-- server (`curl localhost:8788/api/categories`), never by trusting --local alone.
--
-- Fresh installs get these tables from schema.sql directly, but STILL NEED the
-- INSERTs below — an empty categories table renders a 404 for every /category/*
-- URL. That is also why the seed rows live here and not in d1/seed.sql:
-- deploy-production.sh gates the seed behind SEED_CATALOG=1 and refuses to run it
-- once any order exists, so a production database would otherwise never get them.

-- The display metadata for a category: everything the storefront used to hardcode.
-- Product membership is NOT here — it stays in products.categories (a comma-
-- separated slug list), with existence now enforced at the admin write path by
-- assertCategoriesExist(). A join table models it better and would clean up the
-- revenue-by-category report, but it would force flattenProductRows from a pure
-- .map into a group-by reduce — a contract change to the one module shared by the
-- Worker runtime and the Node build script. Revisit past ~200 products.
CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',           -- site-relative path, same convention as products.image
  -- One of the nine theme token sets defined in src/styles/saltylamps.css
  -- (.theme-lamp, .theme-holder, ...). Validated against CATEGORY_THEMES in
  -- functions/lib/validation.mjs — a category with an unknown theme renders unstyled.
  theme TEXT NOT NULL DEFAULT 'lamp',
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,       -- hide without deleting, mirroring products.visible
  -- 1 = catch-all bucket rather than a real merchandising category. Replaces the
  -- `slug !== 'all-products'` literal repeated across the nav, the spotlight rail
  -- and the sitemap generator.
  is_virtual INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_visible ON categories(visible, sort_order);

-- Old slugs that must keep resolving. A separate table rather than an `alias_of`
-- column on categories, because that would require `WHERE alias_of IS NULL` in
-- every category query and one missed filter leaks a phantom category into the
-- shop nav, the sidebar and the sitemap. Two columns cannot fail that way.
CREATE TABLE IF NOT EXISTS category_aliases (
  alias TEXT PRIMARY KEY,
  slug TEXT NOT NULL REFERENCES categories(slug)
);

-- Typed key/value settings. Deliberately separate from the marketing-copy tables
-- added later: these are operational values consumed by server logic (stock
-- arithmetic, JSON-LD, currency formatting), so a copy edit must never be able to
-- change a business rule.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string' CHECK (value_type IN ('string', 'int', 'bool', 'json')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Backfill. Generated from src/content/site-content.mjs by
-- `node scripts/generate-content-migration.mjs categories` — do not hand-edit;
-- re-run the generator so the SQL can never disagree with what the site renders.
-- ---------------------------------------------------------------------------

-- Categories: the taxonomy that until now lived in src/App.jsx's `categories` const.
-- name/description/image carried verbatim; theme from the `groupThemes` map.
-- sort_order is spaced by ten so the owner can reorder without renumbering.
INSERT OR IGNORE INTO categories (slug, name, description, image, theme, sort_order, visible, is_virtual)
  VALUES ('all-products', 'All products', 'The full Salty Lamps range in one place.', '/media/live-site-products/lamp-sphere-gemini.jpg', 'lamp', 0, 1, 1);
INSERT OR IGNORE INTO categories (slug, name, description, image, theme, sort_order, visible, is_virtual)
  VALUES ('salt-lamps', 'Salt lamps', 'Warm-glow lamps for bedrooms, counters, lounges, and gifts.', '/media/live-site-products/lamp-block-gemini.jpg', 'lamp', 20, 1, 0);
INSERT OR IGNORE INTO categories (slug, name, description, image, theme, sort_order, visible, is_virtual)
  VALUES ('candle-holders', 'Candle holders', 'Giftable tealight holders for cosy rooms, spas, and tables.', '/media/live-site-products/holder-natural-gemini.jpg', 'holder', 30, 1, 0);
INSERT OR IGNORE INTO categories (slug, name, description, image, theme, sort_order, visible, is_virtual)
  VALUES ('rock-salt-pantry-items', 'Kitchen saltware', 'Platters, bowls, culinary salt, and salt barware.', '/media/live-site-products/salty-chef-family-live-site.png', 'kitchen', 40, 1, 0);
INSERT OR IGNORE INTO categories (slug, name, description, image, theme, sort_order, visible, is_virtual)
  VALUES ('rock-salt-bricks', 'Salt bricks', 'Salt wall bricks and feature-wall materials for trade buyers.', '/media/live-site-products/salt-bricks-clean-gemini.jpg', 'bricks', 50, 1, 0);
INSERT OR IGNORE INTO categories (slug, name, description, image, theme, sort_order, visible, is_virtual)
  VALUES ('equestrian-salt-licks', 'Equestrian salt licks', 'Mineral salt licks for horses, cattle, fields, and yards.', '/media/live-site-products/lick-field-scene-gemini.jpg', 'equestrian', 60, 1, 0);
INSERT OR IGNORE INTO categories (slug, name, description, image, theme, sort_order, visible, is_virtual)
  VALUES ('himalayan-salt-massage-relaxation-products', 'Massage and relaxation', 'Spa, bath, massage, and body-care salt products.', '/media/live-site-products/massage-stones-gemini.jpg', 'relaxation', 70, 1, 0);
INSERT OR IGNORE INTO categories (slug, name, description, image, theme, sort_order, visible, is_virtual)
  VALUES ('accessories', 'Accessories', 'Replacement bulbs and cables for compatible salt lamps.', '/media/live-site-products/accessory-bulb-gemini.jpg', 'accessory', 80, 1, 0);
INSERT OR IGNORE INTO categories (slug, name, description, image, theme, sort_order, visible, is_virtual)
  VALUES ('special-deal', 'Special deals', 'Bundle offers and starter sets for easy gifting.', '/media/live-site-products/holder-apple-gemini.jpg', 'deal', 90, 1, 0);
INSERT OR IGNORE INTO categories (slug, name, description, image, theme, sort_order, visible, is_virtual)
  VALUES ('salt-wall-panels', 'Aura Collection', 'Illuminated Himalayan salt wall art in hand-finished wood frames.', '/media/live-site-products/aura-collection-frame-detail-live-site.jpg', 'panel', 100, 0, 0);

-- Slug aliases. This 301 mapping previously existed in three places at once:
-- App.jsx's `categoryAliases`, generate-seo.mjs's legacy/clean slug pair, and
-- public/_redirects. The first two now read from here.
INSERT OR IGNORE INTO category_aliases (alias, slug) VALUES ('himalyan-salt-massage-relaxation-products', 'himalayan-salt-massage-relaxation-products');

-- Settings. Only keys that something actually reads are seeded; an editable field
-- that changes nothing is worse than an honest static one.
INSERT OR IGNORE INTO settings (key, value, value_type) VALUES ('low_stock_threshold', '5', 'int');
INSERT OR IGNORE INTO settings (key, value, value_type) VALUES ('currency', 'GBP', 'string');
INSERT OR IGNORE INTO settings (key, value, value_type) VALUES ('site_url', 'https://www.saltylamps.co.uk', 'string');
