-- One realistic paid, packed order to exercise the despatch flow by hand.
--
-- Purpose: open it in admin -> Orders, choose a carrier, type a consignment number,
-- press "Mark as despatched", and watch the customer's despatch email appear in the
-- "Emails for this order" panel with its Track-your-parcel link.
--
-- Apply:
--   Local:  wrangler d1 execute salty-lamps-db --local  --file=d1/sample-despatch-order.sql
--   Remote: wrangler d1 execute salty-lamps-db --remote --file=d1/sample-despatch-order.sql
--
-- Requires d1/migrations/006-order-despatch.sql to have been applied first — the
-- despatch form writes carrier, carrier_name and tracking_url.
--
-- SAFE AND REPEATABLE. The id carries the same 'demo_order_' prefix as the generated
-- demo data, so a real Stripe checkout session id can never collide with it and
-- d1/reset-demo-orders.sql clears it along with the rest. The two DELETEs below make
-- re-running this file put the order back to its un-despatched starting state rather
-- than erroring on the primary key.
--
-- Line items are selected BY SKU CODE rather than by row id: skus.id is a surrogate
-- that differs between databases, so hardcoding it would silently attach the wrong
-- products (or none) on a database seeded in a different order.

DELETE FROM order_items WHERE order_id = 'demo_order_sample_despatch';
DELETE FROM orders      WHERE id       = 'demo_order_sample_despatch';

INSERT INTO orders (
  id, payment_intent, status, customer_email, amount_total_pence, currency, created_at,
  fulfilment_status, ship_name, ship_line1, ship_line2, ship_city, ship_postcode, ship_country
) VALUES (
  'demo_order_sample_despatch',
  'pi_demo_sample_despatch',
  'paid',
  'sample.customer@example.com',
  6096,
  'gbp',
  datetime('now', '-1 day'),
  'packed',
  'Helen Whitmore',
  'Flat 2, Cobbler''s Yard',
  '14 Market Street',
  'Stoke-on-Trent',
  'ST1 1JQ',
  'GB'
);

INSERT INTO order_items (order_id, sku_id, quantity, unit_price_pence)
  SELECT 'demo_order_sample_despatch', id, 1, price_pence FROM skus WHERE sku = 'RSL-A' LIMIT 1;
INSERT INTO order_items (order_id, sku_id, quantity, unit_price_pence)
  SELECT 'demo_order_sample_despatch', id, 1, price_pence FROM skus WHERE sku = 'RSL-B3' LIMIT 1;
INSERT INTO order_items (order_id, sku_id, quantity, unit_price_pence)
  SELECT 'demo_order_sample_despatch', id, 1, price_pence FROM skus WHERE sku = 'PC2' LIMIT 1;
