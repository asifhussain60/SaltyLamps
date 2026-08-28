-- Migration 006 — Order despatch: carrier, courier name, tracking link.
--
-- Why a migration file: `CREATE TABLE IF NOT EXISTS` in d1/schema.sql is a no-op
-- against a database that already has `orders`, so new COLUMNS must arrive here as
-- well (the lesson d1/migrations/001-admin-portal.sql was written for).
--
-- Apply once to each existing database:
--   Local:  wrangler d1 execute salty-lamps-db --local  --file=d1/migrations/006-order-despatch.sql
--   Remote: wrangler d1 execute salty-lamps-db --remote --file=d1/migrations/006-order-despatch.sql
--
-- deploy-cloudflare.sh (dev/UAT) applies NO migrations at all — it only builds and
-- deploys — so this file goes onto the UAT database by hand, exactly as 005 did.
-- deploy-production.sh does loop over d1/migrations/*.sql on every run.
--
-- RE-RUNNING THIS FILE. SQLite has no `ADD COLUMN IF NOT EXISTS`, so the three
-- ALTERs below raise "duplicate column name" on a second pass, exactly like 001's.
-- deploy-production.sh's apply_migration() absorbs that one error and continues.
-- The consequence to know: wrangler stops a file at its FIRST failing statement,
-- so on a re-run everything after the first ALTER is skipped. That is harmless
-- here because a re-run has nothing left to do — but it is why this file must
-- never be edited to append a fourth column later. A new column means a NEW file.
--
-- Safe to run on a database with live orders: all three columns are nullable with
-- no default, so existing rows stay valid and orders despatched before this change
-- keep their tracking_number and simply have no carrier or link.

-- The courier code, from CARRIERS in functions/lib/validation.mjs ('royal_mail',
-- 'evri', 'dpd', 'yodel', 'parcelforce', 'other'). Deliberately NOT a CHECK
-- constraint: SQLite cannot alter one without rebuilding the table, and the list of
-- couriers a shop uses changes far more often than the fulfilment lifecycle does.
-- The whitelist is enforced at the write path by validateOrderPatch() instead.
ALTER TABLE orders ADD COLUMN carrier TEXT;

-- The courier's display name as it stood at despatch. Stored rather than looked up
-- from the code so that renaming a carrier — or the owner typing their own under
-- 'other' — never rewrites the name a past customer was already given by email.
ALTER TABLE orders ADD COLUMN carrier_name TEXT;

-- The RESOLVED tracking link, stored as it was sent. Built from the carrier's URL
-- pattern and the consignment number, and overridable per order in the admin so a
-- courier changing its URL shape is fixable without a code change.
ALTER TABLE orders ADD COLUMN tracking_url TEXT;

-- The order list has always run `ORDER BY created_at DESC` against a table with no
-- indexes at all. Added here because this is the migration that ships with it.
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- --------------------------------------------------------------------------
-- The despatch email's button
-- --------------------------------------------------------------------------
-- renderEmail() draws a call-to-action button only when the template has a
-- cta_label AND the message supplies a ctaHref. order_shipped seeded with an empty
-- label in 005 because there was nothing to link to; now there is.
--
-- Guarded on `cta_label = ''` so an owner who has written their own wording keeps
-- it. An owner who deliberately BLANKS the label will see it restored by the next
-- production deploy — the alternative is a marker row in `settings`, whose key
-- whitelist this has no business joining. Blanking a button label is not a thing
-- the admin editor encourages, so the trade is accepted rather than engineered.
--
-- Note for the send log: outbox rows written BEFORE this migration have no ctaHref
-- in their stored payload, so resending one from Emails -> Activity renders the new
-- wording without the button. Degraded, not broken.
UPDATE email_templates
   SET cta_label = 'Track your parcel'
 WHERE key = 'order_shipped'
   AND (cta_label IS NULL OR cta_label = '');
