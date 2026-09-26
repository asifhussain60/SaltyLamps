-- One durable result per admin mutation. The journal and catalogue changes commit together.
CREATE TABLE IF NOT EXISTS admin_save_requests (
  request_id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
