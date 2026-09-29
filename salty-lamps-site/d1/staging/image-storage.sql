-- Test shop only. Apply to the isolated staging D1 before enabling uploads.
-- Production remains on R2 and never imports this schema.
CREATE TABLE IF NOT EXISTS staging_image_objects (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  etag TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS staging_image_chunks (
  key TEXT NOT NULL REFERENCES staging_image_objects(key) ON DELETE CASCADE,
  part INTEGER NOT NULL,
  bytes BLOB NOT NULL,
  PRIMARY KEY (key, part)
);
