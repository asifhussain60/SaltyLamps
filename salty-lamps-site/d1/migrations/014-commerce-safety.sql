-- Additive and re-runnable. Apply before enabling this version of checkout.
-- Stock remains on-hand; active holds are admitted atomically by SQLite.
CREATE TABLE IF NOT EXISTS checkout_reservations (
  session_id TEXT PRIMARY KEY,
  address_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','consumed','released')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS checkout_reservation_items (
  session_id TEXT NOT NULL REFERENCES checkout_reservations(session_id),
  sku_id INTEGER NOT NULL REFERENCES skus(id),
  quantity INTEGER NOT NULL CHECK(quantity>0),
  PRIMARY KEY(session_id,sku_id)
);
CREATE INDEX IF NOT EXISTS idx_checkout_holds_expiry ON checkout_reservations(status,expires_at);
CREATE INDEX IF NOT EXISTS idx_checkout_holds_sku ON checkout_reservation_items(sku_id);
CREATE TRIGGER IF NOT EXISTS checkout_reserve_available
BEFORE INSERT ON checkout_reservation_items
WHEN NOT EXISTS (
  SELECT 1 FROM skus s JOIN products p ON p.id=s.product_id
  WHERE s.id=NEW.sku_id AND p.visible=1 AND (
    (s.track_mode='binary' AND s.in_stock=1) OR
    (s.track_mode='quantity' AND s.quantity >= NEW.quantity + COALESCE((
      SELECT SUM(i.quantity) FROM checkout_reservation_items i
      JOIN checkout_reservations r ON r.session_id=i.session_id
      WHERE i.sku_id=NEW.sku_id AND r.status='active'
    ),0))
  )
)
BEGIN SELECT RAISE(ABORT,'checkout_stock_unavailable'); END;
-- An inventory edit cannot sell stock already promised to an active checkout.
CREATE TRIGGER IF NOT EXISTS checkout_protect_reserved_stock
BEFORE UPDATE OF quantity,track_mode ON skus
WHEN NEW.track_mode='quantity' AND COALESCE(NEW.quantity,0) < COALESCE((
  SELECT SUM(i.quantity) FROM checkout_reservation_items i
  JOIN checkout_reservations r ON r.session_id=i.session_id
  WHERE i.sku_id=NEW.id AND r.status='active'
),0)
BEGIN SELECT RAISE(ABORT,'Stock is reserved by an active checkout'); END;

-- A paid order and its notification intent commit in the same transaction.
CREATE TABLE IF NOT EXISTS order_notification_jobs (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  payload TEXT NOT NULL,
  prepared INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS commerce_email_jobs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','skipped','failed','review')),
  lease_until INTEGER NOT NULL DEFAULT 0,
  first_attempt_at INTEGER,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_commerce_email_jobs_order ON commerce_email_jobs(order_id,status);
CREATE TABLE IF NOT EXISTS order_refunds (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  refund_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'requesting',
  amount_pence INTEGER,
  attempt INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
UPDATE email_templates SET intro='Hello {{customer_name}}, your order has been cancelled and will not be despatched. If a payment needs to be returned, we will confirm that separately.', updated_at=datetime('now')
WHERE key='order_cancelled' AND intro='Hello {{customer_name}}, your order has been cancelled and will not be despatched. If you were charged, the payment has been released back to you.';
-- Stable request identity recovers a checkout whose HTTP response was lost.
CREATE TABLE IF NOT EXISTS checkout_attempts (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  parameters_json TEXT NOT NULL,
  rows_json TEXT NOT NULL,
  address_json TEXT NOT NULL,
  session_id TEXT UNIQUE,
  created_at INTEGER NOT NULL
);
-- Retain each provider refund separately: one order may have failed attempts or
-- multiple partial refunds. Old events must not overwrite the latest attempt.
CREATE TABLE IF NOT EXISTS order_refund_records (
  refund_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL,
  amount_pence INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Freeze provider request content before the first send; later template edits
-- cannot invalidate retries using the same provider idempotency key.
CREATE TABLE IF NOT EXISTS commerce_email_envelopes (
  job_id TEXT PRIMARY KEY REFERENCES commerce_email_jobs(id),
  transport_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS commerce_email_reconciliations (
  job_id TEXT PRIMARY KEY REFERENCES commerce_email_jobs(id),
  generation INTEGER NOT NULL DEFAULT 0
);
