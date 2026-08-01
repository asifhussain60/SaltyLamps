-- Migration 002 — Product image gallery.
--
-- Before this, a product had exactly one image (products.image). This adds a
-- proper gallery: each product can have any number of images, addable/deletable/
-- replaceable independently. products.image is kept as-is and now always mirrors
-- the gallery's primary image (lowest sort_order) — every other query that reads
-- products.image (storefront, product cards, checkout, SEO generation) keeps
-- working unchanged.
--
-- Apply once to each existing database:
--   Local:  wrangler d1 execute salty-lamps-db --local  --file=d1/migrations/002-product-gallery.sql
--   Remote: wrangler d1 execute salty-lamps-db --remote --file=d1/migrations/002-product-gallery.sql
--
-- Fresh installs get this table from schema.sql directly and should NOT run this file.

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id),
  key TEXT,                          -- R2 object key; NULL for legacy static /media/... paths
  path TEXT NOT NULL,                -- served path, e.g. /api/images/products/<id>/<uuid>.jpg
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

-- Backfill: every product's existing single image becomes image #0 of its gallery.
-- '/api/images/' is 12 characters, so substr(image, 13) strips it to recover the R2 key.
INSERT INTO product_images (product_id, key, path, sort_order)
SELECT id,
       CASE WHEN image LIKE '/api/images/%' THEN substr(image, 13) ELSE NULL END,
       image,
       0
FROM products
WHERE image != '';
