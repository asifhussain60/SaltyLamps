# Checkout and route continuation — 27 September 2026

## Scope

Continued independent local preparation on `develop`. No deployment, account setting, DNS write, payment, customer email, customer import or production schema operation occurred. No retired-account control or credential was used. The earlier audit remains historical evidence; this report supersedes its local postcode and redirect gaps only. Stages 6 and 9 remain in progress; stage 11 remains pending.

## Exact disposable database boundary and reproduction

1. From `salty-lamps-site`, run `CONTENT_SNAPSHOT_SOURCE=committed npm run build`.
2. Run `python3 scripts/prepare-checkout-fixture.py`. It creates a new temporary directory, copies built files and Functions, creates a standard local configuration with synthetic database ID `00000000-0000-4000-8000-000000000099`, and bootstraps an empty database from committed schema/seed/migrations plus two postcode rows. It reads no existing database or private customer export. Its `.dev.vars` contains only a comment. Local dependencies are linked, not credentials.
3. The script runs `wrangler d1 execute DB --local --config <fixture>/wrangler.toml --persist-to <fixture>/state --file <fixture>/fixture.sql`. The recorded `fixture.json` and `bootstrap.log` retain the exact command and result.
4. Execute the printed command from that fixture directory: `env -i HOME="$HOME" PATH="$PATH" WRANGLER_SEND_METRICS=false <site>/node_modules/.bin/wrangler pages dev dist --persist-to <fixture>/state --ip 127.0.0.1 --port 8789`. Pages discovers the same standard configuration from its working directory. Do not pass `--d1 DB=...`, which previously replaced the database identity. Pages rejects an explicit `--config` option; this was discovered and corrected in the helper.
5. From `tests`, run `E2E_BASE_URL=http://127.0.0.1:8789 LIVE_POSTCODE=1 npm test -- specs/postcode-runtime.spec.js specs/order-review.spec.js specs/checkout-recovery.spec.js specs/redirect-runtime.spec.js --workers=1 --retries=0`.

Final clean fixture: `/var/folders/q9/5s1lv3rs3zg5j_ncbsck4jc00000gn/T/salty-checkout-fixture-f37vk8ci`. It was regenerated after the complete build and uses the final middleware, redirects and checklist. The earlier investigation fixture ended in `kkp998rj`. Never copy its SQL, database or test catalogue to production. Neither previous local database was modified.

Final combined command passed all 30 desktop/mobile cases with zero retries on the final clean fixture. Logs, bootstrap manifest and desktop/mobile screenshots are preserved in the ignored `outputs/checkout-continuation-2026-09-27` directory.

## Observed results

- `/api/postcode-suggestions?query=SW1A` returned 200 and `{"suggestions":["SW1A 1AA","SW1A 2AA"]}` from the actual Pages-bound database.
- Twenty-eight desktop/mobile checkout and recovery cases passed with zero retries. The two new runtime cases intercepted no requests: catalogue, delivery and postcode requests used actual Functions. Both checkout pages accepted suggestions; changed selection survived Back; missing BT suggestions and manual ST4 entry did not prevent address entry. No payment was attempted in those two cases. Older payment/recovery cases intentionally use mocked responses and do not establish provider readiness.
- Direct in-app browser walkthrough added an Angel Shape lamp, selected SW1A 2AA with the keyboard on order review, carried it into the address page, and displayed the SW1A 1AA suggestion there. The visible address dropdown fitted the narrow viewport and was inspected.
- The build produced 112 route shells and verified all 41 referenced media assets. All 56 path redirects parsed successfully after repair. Each exact target exists in the candidate build; both browser-test profiles checked all 56 rules, final exact target responses, checkout fallback and unknown-route 404.
- The original full-host sources are unsupported in `_redirects`; the catch-all rewrite conflicts with native HTML canonicalization. Both were removed. Actual shop page host canonicalization now runs in middleware; preview and local hosts, admin gates, API requests and payment POSTs are preserved. Excluded static assets still require reviewed production zone rules.
- A browser-style `Accept: text/html` request exposed four old Wix paths whose delegated 301 response had been overwritten with 404: the invoice page, blog index and two posts. Middleware now preserves delegated redirects. Ordinary unknown pages retain 404/noindex.
- Complete unit suite: 153 passed. Route/canonical tests cover query preservation, preview/API/admin boundaries, legacy redirects and genuine missing pages.

## National postcode import feasibility

`python3 scripts/assess-postcode-import.py` fetches only the source count and one page into an in-memory database. The dated result is in `infra/postcode-feasibility-2026-09-27.json`.

| Measurement | Result | Meaning |
| --- | --- | --- |
| Eligible source rows, excluding BT | 1,760,216 | A single-day Free import cannot fit the write allowance. |
| Sample | 2,000 rows; 57,344 SQLite bytes | Linear projection is 50,468,914 bytes. This is an estimate, not full database measurement. |
| Generated 400-row statement upper bound | 9,269 bytes | Below the 100,000-byte statement limit; the importer uses literals, not bound parameters. |
| Free database/storage limits | 500 MB per database; 5 GB account total | Include existing shop tables and indexes when measuring the complete candidate. |
| Free daily writes | 100,000 account-wide | At least 18 daily allowances at one write per row, before other use or amplification. |
| Planning example | 45 daily allowances | Assumes two writes per source row and reserves 20,000 daily writes for other use; this is a scenario, not a measured schedule. |

Before any approved import: archive the exact source version and licence, measure the complete database, inspect actual D1 `rows_written` on an authorized small batch, budget all account usage, prepare resumable daily batches and verify coverage. Existing `INSERT OR REPLACE` statements also consume writes when rerun; the current SQL generator does not supply a safe daily import scheduler. No national dataset was imported. BT manual entry remains separate from suggestion coverage.

Sources: [Cloudflare limits](https://developers.cloudflare.com/d1/platform/limits/), [Cloudflare pricing and write accounting](https://developers.cloudflare.com/d1/platform/pricing/), [ONS source catalogue](https://www.data.gov.uk/dataset/f10c1fb7-ae3d-4811-9f37-82d50a5fae83/online-ons-postcode-directory-live3), [Pages redirects and Functions boundary](https://developers.cloudflare.com/pages/configuration/redirects/). Live limits were read during this continuation.

## Catalogue, delivery and remaining owner decisions

Repeated `rehearse-catalogue-decisions.py` into the separate ignored `backups/catalogue/continuation-2026-09-27` directory using the previously reviewed snapshot, review and approved prices. Source hashes remained unchanged; 76 original option objects were preserved, three bath-salt sizes retained the approved £4.49/£11.99/£16.99 rehearsal prices, and six frame choices shared three size stock pools. Mixed holds, contention rejection, release/reuse, repeat release and SQL restore passed. This historical snapshot is not the opening-stock authority; the checkout fixture is also not the production catalogue.

| Owner review needed | Prepared evidence / remaining gap |
| --- | --- |
| Bath-salt and frame opening counts | Approved assortment and shared-stock model remain intact; current counts are not supplied. Bath stock stays unavailable. |
| Packed weights and parcel grouping | Recorded delivery bands exist, but option-by-option current packed weights and final charge parity are unapproved. |
| Promotions, vouchers, gift cards and refunds | Preserved Wix settings/history must be reconciled to remaining obligations at final handover. |
| Policy and contact wording | Previously captured addresses and telephone details disagree; final business wording needs approval. |
| Archive versus replacement mapping | Separate structures remain separate. Owner review must precede production schema changes or imports. |
| Provider and launch gates | Administrator protection, matched owner Stripe sandbox credentials and verification, webhook lifecycle, actual buyer/owner mail delivery, fresh launch backups and explicit launch approval remain open. |

Public read-only verification again returned the approved holding-page body with 503/no-store, bare-domain 301 to www, and Zoho MX priorities 10/20/50. This confirms routing and records only. No signed-in provider dashboard was refreshed, and earlier dashboard observations remain dated.
