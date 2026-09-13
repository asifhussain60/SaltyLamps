-- Correct the collection branding, preserving IDs, stock and owner-managed settings.
-- Runs after 007; repeat-safe even when earlier seed migrations are replayed.
-- Rename the collection without replacing admin-managed copy or child IDs.
-- Idempotent: older seed migrations may recreate the legacy row on deployment.
INSERT OR IGNORE INTO collections (
  slug, name, short_name, eyebrow, heading, description, hero_intro,
  hero_video, hero_poster, theme, background, trade_eyebrow, trade_heading,
  trade_body, trade_cta, sort_order, visible
)
SELECT 'saltwood-frames', 'Saltwood Frames', 'Saltwood Frames',
  eyebrow, heading, description,
  REPLACE(hero_intro, 'Wooden Frame Collection', 'Saltwood Frames'),
  REPLACE(hero_video, 'wooden-frame-collection', 'saltwood-frames'),
  REPLACE(hero_poster, 'wooden-frame-collection', 'saltwood-frames'), theme,
  REPLACE(background, 'wooden-frame-collection', 'saltwood-frames'),
  trade_eyebrow, trade_heading, trade_body, trade_cta, sort_order, visible
FROM collections WHERE slug = 'wooden-frame-collection';

INSERT OR IGNORE INTO collection_categories (collection_slug, category_slug, sort_order)
SELECT 'saltwood-frames', category_slug, sort_order
FROM collection_categories WHERE collection_slug = 'wooden-frame-collection';
DELETE FROM collection_categories WHERE collection_slug = 'wooden-frame-collection';
UPDATE collection_sections SET collection_slug = 'saltwood-frames'
WHERE collection_slug = 'wooden-frame-collection';
DELETE FROM collections WHERE slug = 'wooden-frame-collection';


-- Rename the collection without replacing admin-managed copy or child IDs.
-- Idempotent: older seed migrations may recreate the legacy row on deployment.
INSERT OR IGNORE INTO collections (
  slug, name, short_name, eyebrow, heading, description, hero_intro,
  hero_video, hero_poster, theme, background, trade_eyebrow, trade_heading,
  trade_body, trade_cta, sort_order, visible
)
SELECT 'saltwood-frames', 'Saltwood Frames', 'Saltwood Frames',
  eyebrow, heading, description,
  REPLACE(hero_intro, 'Aura Collection', 'Saltwood Frames'),
  REPLACE(hero_video, 'aura-collection', 'saltwood-frames'),
  REPLACE(hero_poster, 'aura-collection', 'saltwood-frames'), theme,
  REPLACE(background, 'aura-collection', 'saltwood-frames'),
  trade_eyebrow, trade_heading, trade_body, trade_cta, sort_order, visible
FROM collections WHERE slug = 'aura-collection';

INSERT OR IGNORE INTO collection_categories (collection_slug, category_slug, sort_order)
SELECT 'saltwood-frames', category_slug, sort_order
FROM collection_categories WHERE collection_slug = 'aura-collection';
DELETE FROM collection_categories WHERE collection_slug = 'aura-collection';
UPDATE collection_sections SET collection_slug = 'saltwood-frames'
WHERE collection_slug = 'aura-collection';
DELETE FROM collections WHERE slug = 'aura-collection';


UPDATE categories SET name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(name, 'The Wooden Frame Collection', 'Saltwood Frames'), 'The Aura Collection', 'Saltwood Frames'), 'Wooden Frame Collection', 'Saltwood Frames'), 'Aura Collection', 'Saltwood Frames'), 'wooden-frame-collection', 'saltwood-frames'), 'aura-collection', 'saltwood-frames')
WHERE name LIKE '%Wooden Frame Collection%' OR name LIKE '%Aura Collection%'
   OR name LIKE '%wooden-frame-collection%' OR name LIKE '%aura-collection%';

UPDATE categories SET image = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(image, 'The Wooden Frame Collection', 'Saltwood Frames'), 'The Aura Collection', 'Saltwood Frames'), 'Wooden Frame Collection', 'Saltwood Frames'), 'Aura Collection', 'Saltwood Frames'), 'wooden-frame-collection', 'saltwood-frames'), 'aura-collection', 'saltwood-frames')
WHERE image LIKE '%Wooden Frame Collection%' OR image LIKE '%Aura Collection%'
   OR image LIKE '%wooden-frame-collection%' OR image LIKE '%aura-collection%';

UPDATE theme_images SET src = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(src, 'The Wooden Frame Collection', 'Saltwood Frames'), 'The Aura Collection', 'Saltwood Frames'), 'Wooden Frame Collection', 'Saltwood Frames'), 'Aura Collection', 'Saltwood Frames'), 'wooden-frame-collection', 'saltwood-frames'), 'aura-collection', 'saltwood-frames')
WHERE src LIKE '%Wooden Frame Collection%' OR src LIKE '%Aura Collection%'
   OR src LIKE '%wooden-frame-collection%' OR src LIKE '%aura-collection%';

UPDATE collection_sections SET image = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(image, 'The Wooden Frame Collection', 'Saltwood Frames'), 'The Aura Collection', 'Saltwood Frames'), 'Wooden Frame Collection', 'Saltwood Frames'), 'Aura Collection', 'Saltwood Frames'), 'wooden-frame-collection', 'saltwood-frames'), 'aura-collection', 'saltwood-frames')
WHERE image LIKE '%Wooden Frame Collection%' OR image LIKE '%Aura Collection%'
   OR image LIKE '%wooden-frame-collection%' OR image LIKE '%aura-collection%';

UPDATE products SET name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(name, 'The Wooden Frame Collection', 'Saltwood Frames'), 'The Aura Collection', 'Saltwood Frames'), 'Wooden Frame Collection', 'Saltwood Frames'), 'Aura Collection', 'Saltwood Frames'), 'wooden-frame-collection', 'saltwood-frames'), 'aura-collection', 'saltwood-frames')
WHERE name LIKE '%Wooden Frame Collection%' OR name LIKE '%Aura Collection%'
   OR name LIKE '%wooden-frame-collection%' OR name LIKE '%aura-collection%';

UPDATE collections SET hero_intro = REPLACE(hero_intro, 'The Saltwood Frames is ', 'Saltwood Frames are ') WHERE slug = 'saltwood-frames';
UPDATE products SET name = 'Saltwood Frames' WHERE name = 'AuraFrames UK';
