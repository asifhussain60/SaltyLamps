# Known issues and pre-go-live checklist

Things discovered while building this that are fine for now but worth fixing before this
processes real customer money, roughly in priority order.

## 1. Catalog re-sync will orphan order history once real orders exist

`scripts/generate-d1-seed.mjs` does `DELETE FROM skus; DELETE FROM products;` before reinserting —
deliberately **never** touches `orders`/`order_items` (a safety check blocked an earlier version
of this script from doing so). But `skus.id` is an autoincrement surrogate key, and
`order_items.sku_id` references it. Re-running the seed script after real orders exist will delete
and recreate every `skus` row with **new** ids, silently orphaning `order_items.sku_id` for every
past order (D1/SQLite doesn't enforce foreign keys by default, so this fails silently, not loudly).

**Fix before go-live:** switch the seed script to an `INSERT ... ON CONFLICT (product_id, sku) DO
UPDATE` upsert instead of delete+insert, so `skus.id` values stay stable across re-syncs.

## 2. Duplicate SKU codes in the live Wix catalog

Three SKU codes are ambiguous in the source Wix data (confirmed by the seed script's local
validation step, which is exactly what caught this):

- `ST-841` — used by both "Himalayan Rock Salt Bricks for Salt Walls" and "Himalayan Rock Salt
  Platters" (two different products).
- `SL-2` — used by both "Himalayan Rock Salt Lick for Equestrian & Cattle" and "Salty Licks for
  Horses & Cattle, Himalayan Rock Salt Licks" — these two product *names* are similar enough this
  might actually be a duplicate product listing in Wix, not just a duplicate code.
- `E14-1` — reused across three different variant combinations within the same "Salt Lamp Bulb"
  product (15W/2pc, 25W/2pc, 15W/1pc).

The D1 schema tolerates this (`skus.sku` is intentionally not `UNIQUE`; `order_items` references
the surrogate `skus.id`, never the human-readable `sku` string), so nothing breaks — but if you
ever scan or search one of these codes for fulfilment, you can't tell which item it means. Worth
fixing at the source in Wix (or wherever the catalog is edited going forward).

## 3. Product images are full-resolution Wix originals

`scripts/generate-d1-seed.mjs` downloads the first image per product straight from Wix's CDN with
no resizing or compression — files run 1–4.7MB each, 35 of them. Functionally fine, but worth
compressing before page-load speed matters. Not done as part of this work since it's a separate
concern from getting the storefront wired to D1.

## 4. `database_id` is hardcoded in one place outside `wrangler.toml`

`scripts/generate-seo.mjs`'s `fetchProductsFromD1()` has the D1 database id as a literal string
constant, because it talks to D1's HTTP API directly (not through a `wrangler.toml` binding) so
the SEO build step doesn't depend on a deployment that hasn't happened yet. If the database is ever
recreated (new id), this needs updating alongside `wrangler.toml`. See
[`migration-playbook.md`](migration-playbook.md) Scenario C.

## 5. One checkout flow step never verified live

A full test purchase (Stripe test card → webhook fires → order appears in D1, stock decrements)
was not completed — Stripe's iframe-based card input didn't accept automated browser input
reliably. Everything up to Checkout Session creation is proven live; this last step needs a human
to click through once. Takes about 30 seconds with test card `4242 4242 4242 4242`, any future
expiry, any CVC.

## 6. Standard (full-access) Stripe key in use, not the restricted one

See [`stripe.md`](stripe.md#api-key-in-use) — a deliberate choice for test-mode simplicity, but
worth revisiting before live mode (Scenario B in the migration playbook already recommends the
restricted key for the live-mode key).
