# Owner-confirmed preview to owner-account production: data map

The owner has confirmed that `https://salty-lamps-proposal.pages.dev/` shows the
correct **public catalogue data and prices**. Treat its public read-only responses
as the content reference, not its retired Cloudflare account, database, dashboard,
credentials, or deployment. The final destination is the **empty production D1**
database in the approved `Saltylamps@hotmail.com` account, after a private
rehearsal and the two-structure review in migration item 5. The shop and admin
must use that one production binding. This document maps the work; it does not
authorize a production import, launch, payment, or customer-data transfer.

## Verified boundary and current evidence

| Surface | Current observation | Migration use |
| --- | --- | --- |
| Public preview | Read-only `/api/products`, `/api/categories`, `/api/content` returned 34 visible products, 76 choices, 10 categories and 5 collections. A private local capture fetched each endpoint twice with matching hashes. | Authoritative for the owner-confirmed **visible** catalogue and prices; recapture at the review freeze. |
| Checked-in content snapshot | Same 76 choice identities, prices, stock fields and image references as the captured preview. It is older than the preview's latest edits. | Comparison baseline only; never silently substitute it for a fresh source or destination read. |
| Owner-account private test database | Dashboard read-only query returned 35 products, 77 choices, 43 gallery rows, 10 categories, 3 content pages and 10 test orders. | Rehearsal and regression checks. Do not copy its demo orders, synthetic shipping values, image blobs or settings wholesale to production. |
| Owner-account production database | Dashboard showed 0 tables and 0 queries; the configured production database remains empty. | Final destination after review, guarded bootstrap, verified media and provider gates. |

The local ignored evidence folder is
`d1/backups/public-preview-owner-confirmed-2026-09-29/`. Its manifest records
source URLs, hashes, counts and capture time; the JSON responses retain the exact
visible copy. Its `snapshot-drift.json` names every changed choice. This capture
also preserves the two publicly served Saltwood Frames gallery PNGs, with byte
counts and hashes. The other 75 unique image references are static `/media/`
paths and all 75 are present in the current local release tree; recheck the
actual release bundle. This capture contains public data only and is **not** a
full database export or a migration backup.
Re-fetch before any import, compare hashes and field-level differences, and
stop if the responses change during capture.

### Changes already missing from the code snapshot

The preview has **23 choice descriptions across 11 products** and **13 choice
tag values across 4 products** that differ from the checked-in snapshot. There
are no added or removed public choice identities in this comparison. Prices,
stock fields, gallery references, categories, aliases and the public content
response currently match. The recent copy includes changed wording on lamps,
salt licks and scrub bars; the tags affect culinary salt, bowls, a shot glass and
a fire bowl. These edits must flow from a fresh preview capture into the
reviewed import and into the build snapshot. Do not overwrite them with the old
snapshot or the test database's demo seed.

The 35th test product and 77th test choice are consistent with the separate
approved bath-salt rehearsal. Confirm their exact identities and visibility in
the item-5 review before deciding whether to include them in production. Counts
alone do not prove that every identity matches.

## Field and ownership map

| Source or decision | Destination | Transfer rule and validation |
| --- | --- | --- |
| Public visible product ID, name, slug, description, categories and tags | `products` | Match by immutable product ID; review slug collisions and hidden products separately because their visibility cannot be inferred from the public response. Preserve preview's latest descriptions and tags. Check every product route and admin editor after import. |
| Public choice identity, SKU, label and displayed price | `skus` | Match by choice ID plus product ID; SKU text is not unique. Convert pounds to exact integer pence, rejecting rounding ambiguity. Verify each option's price in both shop picker and admin, including all six culinary-salt choices. |
| Public stock state and quantity | `skus`, `sku_weights` | Treat as a comparison, not final stock authority. Reconcile actual stock and packed weights with the owner immediately before launch; never use sandbox synthetic weights or stock as saleable production values. |
| Public categories and aliases | `categories`, `category_aliases` | Preserve slugs, ordering, visibility and redirects. Compare category pages, menus and old URLs. |
| Public collection, theme, policy-page, snippet and list content | Content tables introduced by migration 004 | Preserve IDs and display order. Public API currently matches the snapshot; rerun the comparison at the freeze. Keep operational `settings` separate from marketing copy. |
| Public product and choice image paths | `product_images`, `sku_images`, `products.image`, production object storage | Fetch only public media, verify bytes, type and hash, then map paths to owner-controlled storage. Preserve gallery order, first-image cover and choice assignments. Test load, upload, reorder and primary-image changes in shop and admin. The test database's D1 image blobs are not the production image store. |
| Reviews and other non-public admin fields | Reviewed source records and owner decisions | The three public API responses do not provide a complete review corpus, hidden products, cost, packed weight, shipping rules, promotions or operational settings. Inventory these separately; do not infer them from page text or copy sandbox defaults. |
| Current Wix shop changes since the last business export | Separate reviewed delta, then approved shop tables | Compare new/edited products, stock, shipping settings, discounts and new orders against the saved Wix export and the owner-confirmed preview. The preview remains the confirmed price/content reference; a newer Wix difference is a conflict to review, never an automatic override. |
| Orders, customers, payment records and audit logs | Separate reconciliation, not this catalogue import | Leave the private test orders behind. Any historical Wix records require the separately reviewed mapping and import authorization; never replay payments, emails or inventory deductions. |

## Drift-safe transfer sequence

1. **Freeze and capture.** Record a short editing freeze for the preview and
   current Wix shop, capture the preview's three public APIs again, and compare
   with the stored capture and checked-in snapshot. Take a fresh Wix business
   delta since the last export; inventory hidden and operational fields with the
   owner. Record additions, removals and changes by stable ID and field,
   including asset hashes. A missing or unreadable endpoint blocks the plan.
2. **Review both structures.** Show the owner the preview projection, the
   proposed production tables, the extra bath-salt choice and every unmapped
   field. Approve the mapping under migration item 5 before any production
   import. Keep the Wix archive separate from the replacement-shop database.
3. **Rehearse on a fresh isolated copy.** Apply schema/migrations, project the
   captured source by stable ID, and check parent/choice/image relationships,
   prices, media, stock rules and route counts. Use three-way comparison:
   previous source capture vs fresh source vs target, with a separate fresh Wix
   delta. Apply a source-only edit only when the target still has its expected
   old value; keep target-only edits; stop for owner review when both sides
   changed the same field or Wix has a newer conflicting change.
   Do not replay test orders or sandbox provider settings.
4. **Prepare the owner destination.** Verify the owner account and database IDs
   against the production config, establish production image storage and scoped
   deployment access, capture a recoverable pre-import state, and run the
   existing production preflight. The current unrelated personal-account
   Wrangler login is not a valid deployment credential.
5. **Apply once, then read back.** Import only the approved projection using
   guarded writes in a maintenance window. Requery the production database and
   compare IDs, prices, copy, galleries, category links and counts with the
   frozen source manifest. Any unexpected row or conflict stops publication.
   Build the storefront snapshot from this **owner production database**; do
   not build it from the old code snapshot or the preview endpoint.
6. **Verify both apps and rollback path.** Confirm the shop and protected admin
   point to the same production binding. Exercise list/detail, each price
   option, image loading, new upload, drag/keyboard reorder and primary photo;
   then run stock, cart, checkout, order and access tests in their approved
   modes. Keep the public holding page and Wix rollback available until the
   separate launch decision. Record a forward delta or restored database/media
   state if validation fails; do not overwrite newly accepted orders.

## Release gates that remain open

This map does not make the production shop launch-ready. Production R2 and its
terms/usage decision, scoped owner-account credentials, a reviewed catalogue
and media mapping, final stock and packed weights, protected-admin acceptance,
provider-backed payment and email, complete recovery evidence and owner
acceptance are independent gates. The code changes for image upload and
reordering are prepared in the current worktree; the private site must receive
and pass a live Chrome check before they can be called deployed fixes.
