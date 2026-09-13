# Product weights and internal postage tracking

## Product entry

Products → edit a product → Product option(s) → Weight & delivery. Each option stores its own product weight range, packed shipping weight, postal group and customer visibility. A single-option product uses the same fields directly; there is no conflicting parent weight.

Enter kilograms with up to three decimal places. Use the same lower and upper product weight for a fixed weight. Product weights exclude packaging. Packed weight includes packaging for one complete sellable item or multipack; order quantity multiplies that whole-pack weight. Unknown values stay blank, not zero. Packed weight must cover the maximum product weight.

Inventory → Weights supports batch editing, searching and a missing-weight/group filter. A failed validation rejects the complete batch. Product lists show shipping readiness without copying the cheapest option's weight onto the whole product.

## Delivery rules

Settings → Delivery manages customer display units (kg/g), optional catalogue card summaries and up to 200 delivery rates. Each rate specifies group, service, country, optional comma-separated postcode prefixes, exclusive lower weight, inclusive upper weight and price in pounds. A blank prefix covers the whole country. Overlapping bands for the same service/destination are rejected. Different services may offer different valid rates.

No delivery prices or product weights are inferred or seeded. Checkout offers the configured United Kingdom rates only when every basket line has a packed weight, all lines share a postal group, and a matching country-wide weight band exists. The chosen delivery charge is included in Stripe's payment total. Missing weights, mixed groups, postcode-specific rates, and unmatched baskets stop before payment and direct the customer to request a quote.

## Orders and customer displays

The product page and quick view show only the selected option's public product weight. Basket quantities multiply full sellable packs. Catalogue cards optionally show a range across options; incomplete ranges say the weight varies rather than copy one option. Public payloads never include packed shipping weights or actual postage costs.

Checkout snapshots trusted database weights into line metadata. Payment processing copies these into order records. Customer order emails show only the recorded public product weight. Existing orders without recorded weights are explicitly labelled as current-catalogue estimates; missing historical measurements are not invented.

Order detail → Weight & postage shows recorded/calculated weight, current matching rates and the original saved estimate. Admins may record actual parcel weight, actual postage cost (including genuine zero), service and adjustment notes without dispatching the order or charging a customer. Editing actual costs preserves the original saved estimate and logs the prior record. Reports export product weights and actual order postage, keeping unknown values blank.

## Workbook compatibility

The owner workbook generator exports saved weights. The importer recognises headings in both the legacy workbook and the newer product/postage workbook, including reordered columns. Blank or omitted weight cells preserve saved values. Use `CLEAR` to explicitly remove a weight or group; clear both ends of a range together. `Show product weight` accepts Yes/No. Weight imports remain dry-run by default; review the report before `--apply`. Rates are maintained in the admin Delivery settings; freeform postal-rate worksheets are not silently interpreted as executable rules.

## Deployment and recovery

1. Back up the target database and application revision. Apply `d1/migrations/011-product-weights.sql` to that target **before** publishing the application. The migration is additive and re-runnable and creates no fabricated measurements. It is also included in the fresh-install schema.
2. Refresh the content snapshot against that same migrated target, build, and deploy the matching application/functions. The standard production deployment script already iterates the migrations. Do not seed or reset the catalogue on a live shop.
3. Verify a disposable product through save/reload, public option switching, visibility, display units and inventory editing. Verify order postage independently of despatch. Export and inspect the recorded values. Remove only disposable fixtures.

Rollback application code if needed; retain additive weight tables so entered data remains recoverable. Do not drop tables or restore an old database over newer orders. Local review backups and execution evidence are under the workspace outputs directory; production has not been migrated by the local implementation task.

## Verification scope

Critical tests cover exact conversion, missing/invalid values, range checks, rates/boundaries, bulk rollback, older-client preservation, public privacy, checkout snapshots, historical order persistence, workbook headers and clearing semantics. Browser coverage includes real admin save/reload, validation, navigation protection, option switching, basket quantities, unit conversion and inventory editing on desktop and mobile. Existing unrelated manufacturing-video failures must be reported separately.

Commands used for local verification:

- `npm run test:unit`
- `python3 -m unittest discover -s test -p 'test_weight_import.py'`
- `CONTENT_SNAPSHOT_SOURCE=committed npm run build`
- From `tests`: `PLAYWRIGHT_CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm test -- --workers=1`

There is no configured lint script in this repository. Server modules were syntax-checked with `node --check`; the production build parsed frontend modules, and the importer/generator were checked with `py_compile`.
