-- Re-runnable, additive; unknown weights remain NULL. Never infer from names.
CREATE TABLE IF NOT EXISTS sku_weights (
  sku_id INTEGER PRIMARY KEY REFERENCES skus(id) ON DELETE CASCADE,
  product_weight_min_g INTEGER CHECK(product_weight_min_g IS NULL OR (typeof(product_weight_min_g)='integer' AND product_weight_min_g>0 AND product_weight_min_g<=1000000000)),
  product_weight_max_g INTEGER CHECK(product_weight_max_g IS NULL OR (typeof(product_weight_max_g)='integer' AND product_weight_max_g>0 AND product_weight_max_g<=1000000000)),
  packed_weight_g INTEGER CHECK(packed_weight_g IS NULL OR (typeof(packed_weight_g)='integer' AND packed_weight_g>0 AND packed_weight_g<=1000000000)),
  postal_group TEXT NOT NULL DEFAULT '',
  weight_public INTEGER NOT NULL DEFAULT 1 CHECK(weight_public IN (0,1)),
  CHECK((product_weight_min_g IS NULL AND product_weight_max_g IS NULL) OR (product_weight_min_g IS NOT NULL AND product_weight_max_g IS NOT NULL AND product_weight_min_g<=product_weight_max_g)),
  CHECK(packed_weight_g IS NULL OR product_weight_max_g IS NULL OR packed_weight_g>=product_weight_max_g)
);
CREATE TRIGGER IF NOT EXISTS sku_weights_delete AFTER DELETE ON skus BEGIN DELETE FROM sku_weights WHERE sku_id=OLD.id; END;
CREATE TABLE IF NOT EXISTS order_item_weights (
  order_id TEXT NOT NULL,
  sku_id INTEGER NOT NULL,
  product_weight_min_g INTEGER,
  product_weight_max_g INTEGER,
  packed_weight_g INTEGER,
  postal_group TEXT NOT NULL DEFAULT '',
  weight_public INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(order_id,sku_id),
  FOREIGN KEY(order_id,sku_id) REFERENCES order_items(order_id,sku_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS order_postage (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  actual_weight_g INTEGER CHECK(actual_weight_g IS NULL OR (typeof(actual_weight_g)='integer' AND actual_weight_g>0 AND actual_weight_g<=1000000000)),
  actual_cost_pence INTEGER CHECK(actual_cost_pence IS NULL OR (typeof(actual_cost_pence)='integer' AND actual_cost_pence>=0 AND actual_cost_pence<=100000000)),
  service TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  estimate_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO settings (key,value,value_type) VALUES ('postage_config','{"unit":"kg","show_cards":false,"rates":[]}','json');
