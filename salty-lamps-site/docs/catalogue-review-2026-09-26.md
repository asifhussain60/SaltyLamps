# Catalogue review — owner decisions and remaining mapping

## Evidence scope

Read-only comparison of the preserved Wix product export with the existing local replacement public snapshot. No remote database was queried or changed. The snapshot is a saved public projection, not a complete database export or proof of current production content. The empty owner-account production database remains untouched.

Wix has 35 parent records and 82 standalone/variant choices. The saved replacement public snapshot has 34 parent products and 76 choices. All 34 public replacement groups have distinct name-based candidates in Wix; the two identically named cables were distinguished by their product codes. None of the export handles exactly equals the saved replacement product identifier. These are candidate links for review, not authority to change identifiers or reseed the shop.

## Bath salt: include the existing hidden record

Asif explicitly chose to include bath salt in the replacement shop. The initial public-snapshot comparison described it as missing. Further inspection established that the Wix parent is `visible=false` and the replacement seed already contains a hidden bath-salt product. The decision is therefore to include/reveal the existing product after reconciliation, not create a duplicate. The original visibility value remains preserved in the archive.

| Size | Latest preserved Wix price | Existing historical seed price | Wix recorded quantity | Wix raw shipping weight |
| --- | --- | --- | --- | --- |
| 1 kg | £4.49 | £4.49 | 2,494 | 1.3 |
| 5 kg | £11.99 | £4.49 | 199 | 6.0 |
| 10 kg | £16.99 | £4.49 | 298 | 11.0 |

The old seed is not a current stock/price authority. Its repeated £4.49 prices would underprice the larger sizes if copied blindly. The owner approved £4.49 / £11.99 / £16.99 for the three local rehearsal sizes. Current opening stock, shipping units, source images and copy still need review before activation. Suitable bath-salt images already exist locally. Preserve current owner-edited copy/media and do not publish unsupported health claims from archived marketing text by default.

## Wooden frames: keep size and orientation

Asif explicitly chose to retain both size and portrait/landscape choices. Wix contains six size/orientation combinations; the saved replacement snapshot exposes three size-only options.

| Size | Wix price per orientation | Saved replacement price | Wix quantity per orientation | Saved replacement quantity |
| --- | --- | --- | --- | --- |
| Small | £199.99 | £199.99 | 10 | 10 |
| Medium | £299.99 | £299.00 | 10 | 10 |
| Large | £599.99 | £599.00 | 10 | 5 |

Do not silently replace the existing prices or double stock while adding orientation. Asif confirmed that portrait and landscape are the same physical frame and share one stock pool per size. Retain the size stock identity and store orientation as an order choice; do not create independently stocked orientation duplicates. Rehearse mixed-orientation baskets, reservations and release behavior against that shared stock. Keep the replacement identifiers and recorded owner changes; archive the original dimensions and spelling exactly, while presenting reviewed customer-facing labels.

## Recorded implementation boundary

The assortment and shared-stock decisions are approved. Final stock/price mapping, import execution and publication are not. The staged decision record resides outside the automatic production migrations. Next: review exact working-catalogue state, implement the approved shared-stock orientation choice in reversible local changes, and verify them in the shop before requesting any production import.

The separate historical archive continues to preserve all 294 source columns. Historical orders/contacts do not become new live shop orders/customers as part of these catalogue changes.

Local rehearsal and orientation implementation now pass the evidence recorded in docs/catalogue-mapping-review.md. No production schema change or import was performed.
