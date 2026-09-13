-- Rename the collection without replacing admin-managed copy or child IDs.
-- Idempotent: older seed migrations may recreate the legacy row on deployment.
INSERT OR IGNORE INTO collections (
  slug, name, short_name, eyebrow, heading, description, hero_intro,
  hero_video, hero_poster, theme, background, trade_eyebrow, trade_heading,
  trade_body, trade_cta, sort_order, visible
)
SELECT 'wooden-frame-collection', 'Wooden Frame Collection', 'Wooden Frame Collection',
  eyebrow, heading, description,
  REPLACE(hero_intro, 'Aura Collection', 'Wooden Frame Collection'),
  REPLACE(hero_video, 'aura-collection', 'wooden-frame-collection'),
  REPLACE(hero_poster, 'aura-collection', 'wooden-frame-collection'), theme,
  REPLACE(background, 'aura-collection', 'wooden-frame-collection'),
  trade_eyebrow, trade_heading, trade_body, trade_cta, sort_order, visible
FROM collections WHERE slug = 'aura-collection';

INSERT OR IGNORE INTO collection_categories (collection_slug, category_slug, sort_order)
SELECT 'wooden-frame-collection', category_slug, sort_order
FROM collection_categories WHERE collection_slug = 'aura-collection';
DELETE FROM collection_categories WHERE collection_slug = 'aura-collection';
UPDATE collection_sections SET collection_slug = 'wooden-frame-collection'
WHERE collection_slug = 'aura-collection';
DELETE FROM collections WHERE slug = 'aura-collection';

UPDATE categories SET name = 'Wooden Frame Collection'
WHERE name IN ('Aura Collection', 'The Aura Collection');
UPDATE categories SET image = REPLACE(image, 'aura-collection', 'wooden-frame-collection')
WHERE image LIKE '%aura-collection%';
UPDATE theme_images SET src = REPLACE(src, 'aura-collection', 'wooden-frame-collection')
WHERE src LIKE '%aura-collection%';
-- Keep legacy product identifiers and all visibility/stock settings intact.
UPDATE products SET name = 'Wooden Frame Collection' WHERE name = 'AuraFrames UK';
