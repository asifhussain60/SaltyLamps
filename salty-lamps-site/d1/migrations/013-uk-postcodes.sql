-- Current UK postcodes from ONS live postcode directory, August 2026.
-- Store only the fields needed for prefix suggestions. The primary key keeps
-- lookup fast without a second index, and WITHOUT ROWID keeps the table small.
CREATE TABLE IF NOT EXISTS uk_postcodes (
  postcode_key TEXT PRIMARY KEY,
  postcode TEXT NOT NULL
) WITHOUT ROWID;
