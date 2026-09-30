-- The paragraph under the product title. Blank means "use the standard text for this
-- product's type" (content_themes.lede_template), so existing products are unchanged.
ALTER TABLE products ADD COLUMN intro TEXT NOT NULL DEFAULT '';
