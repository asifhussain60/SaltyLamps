-- Re-runnable; existing catalogue and gallery identities are preserved.
CREATE TABLE IF NOT EXISTS sku_images (
  sku_id INTEGER PRIMARY KEY REFERENCES skus(id) ON DELETE CASCADE,
  image_id INTEGER NOT NULL REFERENCES product_images(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sku_images_image ON sku_images(image_id);

CREATE TRIGGER IF NOT EXISTS sku_images_same_product_insert
BEFORE INSERT ON sku_images
WHEN NOT EXISTS (
  SELECT 1 FROM skus s JOIN product_images pi ON pi.product_id = s.product_id
  WHERE s.id = NEW.sku_id AND pi.id = NEW.image_id
)
BEGIN SELECT RAISE(ABORT, 'Option image must belong to the same product'); END;

CREATE TRIGGER IF NOT EXISTS sku_images_same_product_update
BEFORE UPDATE ON sku_images
WHEN NOT EXISTS (
  SELECT 1 FROM skus s JOIN product_images pi ON pi.product_id = s.product_id
  WHERE s.id = NEW.sku_id AND pi.id = NEW.image_id
)
BEGIN SELECT RAISE(ABORT, 'Option image must belong to the same product'); END;

-- Explicit cleanup also covers local tools which disable foreign keys.
CREATE TRIGGER IF NOT EXISTS sku_images_delete_sku
AFTER DELETE ON skus
BEGIN DELETE FROM sku_images WHERE sku_id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS sku_images_delete_image
AFTER DELETE ON product_images
BEGIN DELETE FROM sku_images WHERE image_id = OLD.id; END;
