-- Migration 001 — Admin portal: order fulfilment + shipping address + audit log.
--
-- Why a migration file: `CREATE TABLE IF NOT EXISTS` in d1/schema.sql is a no-op
-- against a database that already has these tables, so new COLUMNS must be added
-- with explicit ALTER TABLE statements (see infra/cloudflare.md).
--
-- Apply once to each existing database:
--   Local:  wrangler d1 execute salty-lamps-db --local  --file=d1/migrations/001-admin-portal.sql
--   Remote: wrangler d1 execute salty-lamps-db --remote --file=d1/migrations/001-admin-portal.sql
--
-- Safe to run on a DB with existing orders: every added column has a default or is
-- nullable, so existing rows remain valid. Fresh installs get these from schema.sql
-- directly and should NOT run this file.

-- Order fulfilment lifecycle (distinct from the Stripe payment `status`).
ALTER TABLE orders ADD COLUMN fulfilment_status TEXT NOT NULL DEFAULT 'unfulfilled'
  CHECK (fulfilment_status IN ('unfulfilled', 'packed', 'shipped', 'delivered'));
ALTER TABLE orders ADD COLUMN tracking_number TEXT;
ALTER TABLE orders ADD COLUMN shipped_at TEXT;

-- Shipping address captured from Stripe at checkout.
ALTER TABLE orders ADD COLUMN ship_name TEXT;
ALTER TABLE orders ADD COLUMN ship_line1 TEXT;
ALTER TABLE orders ADD COLUMN ship_line2 TEXT;
ALTER TABLE orders ADD COLUMN ship_city TEXT;
ALTER TABLE orders ADD COLUMN ship_postcode TEXT;
ALTER TABLE orders ADD COLUMN ship_country TEXT;

-- Append-only admin audit log.
CREATE TABLE IF NOT EXISTS admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit(created_at);
