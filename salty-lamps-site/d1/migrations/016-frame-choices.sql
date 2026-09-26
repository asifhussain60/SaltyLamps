-- Local development only until the production mapping/schema review is approved.
-- One stock/order line per size SKU; retain the immutable orientation breakdown.
ALTER TABLE order_items ADD COLUMN frame_choices_json TEXT;
