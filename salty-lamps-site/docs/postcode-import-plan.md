# Postcode import preparation

The planner is local-only. It creates a fresh rehearsal database and numbered SQL
chunks from a captured national source; it never contacts Cloudflare or imports
into the production shop. The Wix archive remains separate.

## Build and validate

Run `scripts/import-uk-postcodes.py` from the site directory to capture the ONS
August 2026 live postcode layer. It checks the returned count, uniqueness and
postcode syntax, and excludes BT records. Keep the generated file ignored.

Pass that file and a **new** ignored output directory to
`scripts/plan-postcode-import.py`. The output contains a complete local SQLite
rehearsal, numbered chunks and a manifest. An existing output directory is rejected.
Only a successful run produces the manifest; incomplete output is not an import
candidate. Preserve the source and manifest together for hash verification.

Every chunk uses at most 400 rows per statement. The planner checks statement
length, exact inserted counts and database integrity. It replays every chunk
locally and verifies that no rows change. It also measures the complete postcode
table and records the actual application's indexed prefix query plan. SQLite
measurement is not a remote D1 size or billing result.

## Daily plan and resumption

The default plan allows 40,000 source rows per chunk. This reserves 80,000 daily
writes using an unverified assumption of two writes per row. Cloudflare Free
currently permits 100,000 writes **across the account** each day; other operations
consume that same allowance. The plan is conservative scheduling, not a promise
that a chunk fits the remaining allowance. Measure remote usage before selecting
the real batch size. Replaying a chunk may consume quota despite changing no rows.

Before any remote import, obtain the documented owner review of the production
schema and catalogue mapping, verify the approved owner account and database,
take the required destination backup, and confirm the postcode table is empty.
Do not use this plan to overwrite an existing table or reconcile conflicting data.

For each approved import day, verify the source and next chunk hashes, inspect
actual account usage and start with a small measured batch to establish write cost.
Apply only the next unconfirmed chunk within the measured remaining allowance.
Record its hash, provider result, actual rows written and reconciled row count in
the private manifest. Stop on an error or uncertain response; reconcile existing
keys before deciding whether to retry. Never advance a chunk on an error. Do not
blindly replay all chunks or assume local change counts equal provider billing.

The output marks all chunks `not_imported`. There is deliberately no automatic
remote runner: scheduling, production authorization, quota measurement and
reconciliation remain required. After the final chunk, verify complete count and
sample prefix coverage through the protected candidate's real endpoint.

## Coverage and attribution

The captured source contains live postcode identifiers only, not full addresses.
It does not establish courier coverage or validate a customer's street address.
BT suggestions remain excluded because ONS requires separate commercial licensing
for Northern Ireland data; customers can still enter a postcode manually, subject
to the shop's independently configured shipping rules.

ONS permits reuse of the remaining postcode data under the relevant open licence,
with acknowledgements for ONS, Ordnance Survey and Royal Mail. Before public use,
display the required current-year attribution statements and licence link in the
replacement site's data credits. That customer-visible attribution remains a
launch check; this private planning document alone does not satisfy it.

## References checked on 27 September 2026

- [ONS live dataset](https://www.data.gov.uk/dataset/f10c1fb7-ae3d-4811-9f37-82d50a5fae83/online-ons-postcode-directory-live3)
- [ONS postcode licensing and required attribution](https://www.ons.gov.uk/methodology/geography/licences)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 write allowance and accounting](https://developers.cloudflare.com/d1/platform/pricing/)
