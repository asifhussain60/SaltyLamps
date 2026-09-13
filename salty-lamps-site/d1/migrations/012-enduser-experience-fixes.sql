-- Corrections from the full end-user review. These updates are idempotent and
-- preserve prices, stock, images, orders, and all customer records.

-- A gift promotion must still belong to the home-and-gifts audience.
UPDATE collection_sections
SET rule = '{"categories":{"any":["special-deal"],"none":["equestrian-salt-licks"]}}'
WHERE id = 'home-gifts:gift-sets-offers';

-- Product purpose and promotional status are separate facets. Add purpose tags
-- to the serving pieces so the kitchen landing can form its intended sections.
UPDATE products SET tags = 'serving,hosting'
WHERE id IN (
  'product_0408c683-5d23-83ba-40a5-3066340979c9',
  'product_5a2f41f6-b0dd-5903-63ca-7e38e104298d'
);
UPDATE products SET tags = 'barware,hosting'
WHERE id = 'product_3fdc1a9e-5ceb-b63c-f6fb-0037df447e40';
UPDATE products SET tags = 'pantry'
WHERE id = 'product_39183349-a084-a1a8-5ccb-a3e0ecbcd35b';

UPDATE collection_sections
SET rule = '{"tags":{"any":["pantry","barware"]}}'
WHERE id = 'kitchen-food:pantry-barware';

-- The frame range is currently quoted per project. Give the empty collection an
-- intentional action until individually priced products are ready.
UPDATE collections
SET trade_eyebrow = 'Homes, studios and commercial interiors',
    trade_heading = 'Plan a Saltwood Frames installation.',
    trade_body = 'Tell us about the wall, room, preferred frame size, and location. We will help with suitable sizes, lead time, delivery, and a project quotation.',
    trade_cta = 'Request a Saltwood Frames quote'
WHERE slug = 'saltwood-frames';

-- The legacy guestbook has text comments but no rating or purchase-verification
-- evidence. Remove the editable score and suppress comments that make objective
-- health or air-treatment claims.
UPDATE content_snippets SET value = '' WHERE key = 'reviews.headline_score';
UPDATE reviews
SET display = 0,
    flagged_reason = CASE WHEN flagged_reason = '' THEN 'Health or air-treatment claim withheld from public reuse.' ELSE flagged_reason END
WHERE lower(quote) LIKE '%health benefit%'
   OR lower(quote) LIKE '%air quality%'
   OR lower(quote) LIKE '%purif%'
   OR lower(quote) LIKE '%detox%'
   OR lower(quote) LIKE '%asthma%'
   OR lower(quote) LIKE '%blood circulation%'
   OR lower(quote) LIKE '%blood pressure%'
   OR lower(quote) LIKE '%negative ion%'
   OR lower(quote) LIKE '%pneumonia%';

-- Replace imported, truncated sales copy with concise descriptions grounded in
-- observable material, appearance, included fittings, size choice, and use.
UPDATE products SET description = 'A hand-finished angel-shaped lamp carved from natural Himalayan rock salt. It gives a warm amber light and includes the compatible cable and bulb fitting shown with the selected option. Natural colour, texture, shape, and weight vary from piece to piece.'
WHERE id = 'product_1b92dfb0-dae3-eb06-66b7-2e5977e45712';

UPDATE products SET description = 'A metal fire-basket lamp filled with natural Himalayan rock-salt pieces. The internal bulb creates a warm glow through the loose salt chunks. Supplied with a compatible cable and bulb fitting; natural colour and texture vary.'
WHERE id = 'product_c8539b66-7a44-fe18-affc-afec4be8562a';

UPDATE products SET description = 'A heart-shaped tealight holder carved from natural Himalayan rock salt. Designed for a standard tealight and suited to shelves, tables, and gift sets. Colour, veining, texture, and dimensions vary slightly because each piece is natural.'
WHERE id = 'product_0bb26b6a-e51a-6ac1-bbb7-6ae828c6112a';

UPDATE products SET description = 'A natural Himalayan rock-salt lick for horses and cattle, available in the listed weights and pack sizes. Place it in a suitable lick holder or protected location and provide fresh water. Ask a veterinary professional for advice about an individual animal’s dietary needs.'
WHERE id = 'product_197a2dbf-710a-5331-7cc6-0f676974f33f';

UPDATE products SET description = 'Bulk packs of natural Himalayan rock-salt licks for horses and cattle. Choose the listed weight and quantity for yards, farms, or repeat supply. Use a suitable holder, keep fresh water available, and seek veterinary advice for individual dietary needs.'
WHERE id = 'product_a197ccb4-1208-6b6f-a57e-bd2bcb1fcb9e';

UPDATE products SET description = 'A solid Himalayan rock-salt scrub bar for external use. Use gently on wet skin, avoid broken or irritated areas, rinse after use, and stop if discomfort occurs. Keep the bar dry between uses and seek professional advice for a skin condition.'
WHERE id = 'product_df19c1f7-07d8-a265-42f8-e8dfa824cc6e';

UPDATE products
SET description = replace(replace(description, 'lenght', 'length'), 'Polyurethene', 'polyurethane')
WHERE description LIKE '%lenght%' OR description LIKE '%Polyurethene%';

UPDATE content_pages
SET body = '["Salty Lamps Ltd is responsible for personal information collected through this shop. The full notice explains what is collected, why it is used, who receives it, how long it is kept, and the choices available to customers.","Questions or rights requests can be sent to info@saltylamps.co.uk. Customers may also complain to the Information Commissioner’s Office."]',
    meta_description = 'How Salty Lamps Ltd collects, uses, shares, retains, and protects customer information.'
WHERE path = '/privacy-policy';

UPDATE content_pages
SET body = '["These terms explain consumer ordering, payment, delivery, cancellations, returns, product variation, care, and how to raise a problem with Salty Lamps Ltd.","Trade, bespoke, and bulk quotations may include additional written terms supplied before an order is accepted."]',
    meta_description = 'Terms for buying Salty Lamps products, including payment, delivery, cancellations, returns, and natural variation.'
WHERE path = '/terms-and-conditions';

UPDATE content_pages
SET body = '["Consumers buying eligible goods online can normally notify Salty Lamps of cancellation within fourteen days after delivery, then return the goods within the following fourteen days.","The detailed returns page explains condition, costs, refunds, faulty goods, and exceptions."]',
    meta_description = 'How to cancel, return, exchange, or report a problem with a Salty Lamps order.'
WHERE path = '/return-refund-policy';
