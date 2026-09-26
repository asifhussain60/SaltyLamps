# Checklist item 5 — operational mapping review

Prepared 26 September 2026. This is a review proposal, not production import authorization. All original Wix values remain preserved separately. The approved owner EU database remains empty and untouched.

## Two structures and the proposed boundary

| Information | Separate Wix archive | Replacement shop | Proposed treatment |
| --- | --- | --- | --- |
| Product identity | Original handle, row and snapshot identity | Existing product id plus numeric SKU id | Keep both identities; link only reviewed candidates. None of the 34 public candidate parent links matches by exact identifier. Never regenerate replacement identities from names or duplicate stock codes. |
| Copy, category and media | Raw exported description/category/media strings | Edited copy, category records, local gallery and option image references | Retain replacement owner edits; review differences individually. Preserve raw descriptions including unsupported claims without automatically publishing them. |
| Prices | Original decimal strings | Integer pennies per size/SKU | Preserve replacement prices unless specifically approved; bath-salt rehearsal prices approved at £4.49 / £11.99 / £16.99 for 1 / 5 / 10 kg. No historical seed is current pricing authority. |
| Stock | Original source inventory strings | Quantity/binary status and checkout reservations per numeric SKU | Review current opening count. Wooden-frame orientation shares the same size/SKU stock pool; six choices must not create six independent pools. |
| Options | Original option names, types and choices | Size/variant labels keyed by SKU | Retain all approved bath-salt sizes. Add portrait/landscape as a validated order choice for frames while keeping size identity. |
| Weight | Raw exported shipping-weight and package values | Separate net range and packed weight in grams | Confirm units and packed-versus-net meaning before conversion. Do not copy displayed net weight into postage weight. |
| Historic orders | 609 preserved order summaries and 770 item rows | New provider-session orders and order items with payment/refund/dispatch actions | Keep historical records in a dedicated archive. No conversion into new live orders; no charge, refund, dispatch or receipt replay. |
| Contacts/consent | 4,412 original rows, blanks and raw consent values | Checkout customer/address snapshots | Keep historical contact rows separate. Do not merge by email, infer fresh consent or enrol customers in marketing. |
| Tax, discounts and preorders | Original fields plus captured settings evidence | Only explicitly implemented live behavior | Unresolved operational differences remain launch gates; archival preservation alone does not prove checkout parity. |

## Approved choices

- Include the existing hidden bath-salt product with 1 kg, 5 kg and 10 kg sizes; do not insert a duplicate parent.
- Preserve frame size and portrait/landscape choices.
- Portrait and landscape share stock for each size. Retain the current size prices pending any separate owner change.

## Read-only state reconciliation

The saved public snapshot has 34 products and 76 choices, including three frame sizes and no public bath salt. Two local database copies contain 43 and 35 product rows respectively; the larger copy includes test fixtures. Neither has the verified production migration ledger. Both differ from the public snapshot and from one another. These are development artifacts, not evidence of a populated owner production database. Report: `backups/wix/local-catalogue-state-review-2026-09-26.json`.

Do not silently adopt either local database or run the historical seed against the owner database. Preserve the two existing files. A new disposable rehearsal must have an explicit source boundary and changeset, reviewed price/stock decisions, and before/after hashes.

## Frame implementation requirements identified in current code

The current cart merges by numeric SKU alone; checkout reservations and order_items are also keyed by SKU. Merely adding an orientation selector would lose mixed-orientation choices on refresh or when an order is stored.

A complete implementation needs all of the following before publication:

1. Customer chooses a validated portrait/landscape value. Basket lines retain size plus orientation through refresh, edits and checkout-attempt fingerprints.
2. Stock validation and reservation aggregate quantity by the existing size/SKU across both orientations. A basket with two portrait plus two landscape frames requires four units from one pool.
3. Order storage retains immutable orientation quantities as children of the same existing order/SKU line, or an equivalently reviewed line model. Payment, confirmation emails, fulfilment, exports and refunds must show the same choice breakdown.
4. Reject unknown/missing frame choices before creating a provider session. Expiration/cancellation releases only the reservation aggregate, once; webhook retries do not duplicate orientation rows.
5. Rehearse mixed orientations, combined last-unit contention, refresh, abandoned checkout, replay, refund and historical orders that predate orientation storage.

Local implementation now carries orientation through basket persistence, size/orientation edits, server aggregation, payment metadata, immutable order-item JSON, administrator order display and receipt/refund/dispatch email formatting. Migration 016 adds only nullable order-item choice JSON; it has not been applied to any remote database. The existing stock identity and reservation trigger remain unchanged. See the continuation evidence below.

## Verified preservation versus remaining approval

Preservation passed for all 294 source columns and 480,778 cells, including byte-identical original recovery, SQL restore, CSV re-export and no-op repeat import. Five archive recovery regression tests passed. Those results establish lossless archival handling only.

Pending: current opening stock, packed weights, complete operational field/behavior review, reversible local implementation/rehearsal, and separate owner approval of any production mapping/import. The holding-page authorization does not waive these gates.

## Local implementation and verification

The owner replied “proceed” after the three bath-salt prices were presented for local rehearsal; that approval is recorded in the staged decision file. A new, separate rehearsal preserves all 76 existing public option objects exactly and adds the three bath-salt sizes with existing identities. Its 35 parents and 79 stock SKUs do not become 82 independently stocked variants: the three frame sizes provide six customer choices against three shared pools. Bath opening stock is deliberately zero/unavailable, and packed weights remain unknown pending business confirmation. No old source stock figure is claimed as current inventory.

Evidence: `backups/catalogue/approved-decisions-2026-09-26-v2/report.json`. The initial attempt was retained after exposing an unrelated email-schema dependency; the corrected rehearsal uses the exact reservation schema/trigger section required for the stock proof and records its hash. It checks mixed choices, competing last-unit admission, atomic failure rollback, release/reuse, repeated old release isolation, database restore equality and source byte preservation. This is a disposable projection and feasibility test, not a complete production database reconstruction.

The complete Node unit suite passes 148 checks, including seven new frame tests. A mocked provider round-trip verifies one aggregate payment line, immutable orientation quantities in the saved order, shared stock deducted once, webhook replay safety and receipt job content. No Stripe/PayPal connection, charge, refund or delivered email is proven by that mock. Local build passes.

Browser verification against the compiled application and read-only rehearsal database passed: portrait and landscape remain separate basket lines after refresh; size changes retain orientation; nine portrait plus one landscape frame reaches the shared ten-unit limit and disables both increase controls; 390-pixel layout has no horizontal overflow. Bath-salt size switching displays £4.49, £11.99 and £16.99, with purchase disabled until stock/weights are reviewed. The preview serves catalogue/delivery through actual application handlers, snapshot-backed public copy/categories, and blocks payment, messages and mutations. It is not deployed and does not expose an administrator service.

Remaining validation includes the approved live source/mapping, actual packed weights/stock, provider sandbox/live checks, protected administrator access, and full fulfilment/refund/customer-mail acceptance. Source public snapshot hash remains `498c33301b420efe65c7bc38bad64dd295ba8cacb64d50b31f1e4ed163a33e1b`.
