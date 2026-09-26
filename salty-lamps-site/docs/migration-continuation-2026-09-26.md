# Migration continuation evidence — 26 September 2026

## Boundary

Existing uncommitted work was retained. No production data import, deployment, Access policy change, payment, customer email, DNS mutation or service cancellation occurred. The retired Cloudflare account and its credentials were not accessed. Asif explicitly deferred the independent second copy. The original-media download blocker and Access form were not retried.

## Recovery defect and completed local evidence

The original business-export manifest was rechecked against all five listed files, including its field inventory. All recorded hashes and lengths matched. The 142 recovered media files and 56 captured HTML pages also matched their saved hashes and lengths; the two failed catalogue references were left unresolved.

A fresh real-export rehearsal failed while restoring SQL into an empty SQLite database: the local Python 3.9 exporter placed internal `sqlite_sequence` cleanup before the AUTOINCREMENT table that creates it. A new end-to-end synthetic regression reproduced the failure. The fix moves complete internal sequence statements after schema/data statements, before COMMIT; it does not split or rewrite source values. Five Python tests passed, including complete recovery, leading zeros, multiline Unicode content, orphan rejection, tampering detection and preserved deleted sequence high-water marks.

The corrected real-export rehearsal passed 294 columns and 480,778 cells: 245 product/variant/media rows, 609 orders, 770 item rows and 4,412 contacts. Repeat import changed no records. SQL restore, integrity, relationship checks, CSV re-export and extraction of four byte-identical original export files passed. The failed rehearsal was retained separately; it is not success evidence.

Private evidence:

- `backups/wix/rehearsal-continuation-fixed-2026-09-26/reconciliation.json`
- `backups/wix/rehearsal-continuation-fixed-2026-09-26/field-mapping.csv`
- `backups/wix/rehearsal-continuation-fixed-2026-09-26/recovered-originals/`
- `backups/wix/rehearsal-continuation-fixed-2026-09-26/source-manifest-before-update.json`

The stale private source manifest was corrected to distinguish passed historical field preservation from pending live behavior. Original CSV files were unchanged.

## Captured-material recovery bundle

`backups/wix/recovery-bundle-continuation-2026-09-26/` contains a 302,304,504-byte archive and a separate recovery report and manifest. It includes the captured business files, recovered catalogue media, saved HTML, successful rehearsal, staging schema, field definitions, recovery helper and existing rollback materials. All 236 included files were extracted into a disposable local directory and compared by length and SHA-256; all matched. The disposable extraction was removed after verification.

This archive is private and ignored by version control. It is on the same Mac, is not an independent second copy, and does not include the missing original-media inventory or uncaptured settings. It therefore proves recovery only for captured material, not a complete business restore. New account notes and DNS follow-up evidence were recorded after this bundle was created and are not represented as bundle contents.

## Account and routing checks

The approved owner account's All members page was read again and showed the owner and authorized Gmail administrator as the only two Active entries. No separately evidenced pending-invitation view was obtained; that check remains open. No member changes were performed.

All 46 read-only DNS comparisons passed across the two old Wix authoritative servers, two Cloudflare authoritative servers and two public resolvers. Both HTTPS addresses returned 200. The detailed result is `infra/dns-continuation-2026-09-26.json`. This verifies current routing and old-provider readiness, not delivered email or a timed rollback.

Twenty-six focused Node checks passed for administrator host denial, Wix archive separation and preservation, production target guards, migration safety and checklist parity. These do not replace the unresolved full browser acceptance run or prove live authentication/payment/email behavior.

## Still pending

No additional top-level migration item was completed. Item 4 is explicitly blocked and deferred. Items 2 and 5 now have fresh recovery evidence but remain open for missing business material, a second copy and owner mapping review. The 12-item checklist remains authoritative in `migration.md` and its shared source. Keep Wix and Zoho live.


## Owner accepts one copy for continued preparation

Asif subsequently confirmed that one verified backup is sufficient for now. The verified local captured-material recovery bundle satisfies that provisional preparation requirement. Do not block catalogue comparison, account checks, local shop testing or other independent preparation on the deferred second copy. Missing original media and settings remain accurately listed; neither they nor the second copy are represented as completed. No production customer-data import, launch, live payment or cancellation was authorized. Next work is item 5: compare the separate Wix archive and replacement shop structures and present mapping decisions for owner review before any live change.

## Public holding page and continued catalogue review

The owner later explicitly authorized the holding page on www.saltylamps.co.uk. Pages deployment and custom-domain activation succeeded in the approved owner account; the wooden-frame page, direct contact links, desktop and 390-pixel layout were verified. The bare domain redirects to www. Thirty-six non-www record comparisons remained unchanged. Wix remains retained and Zoho routing is preserved. See docs/holding-page.md for the exact scope, HTTP-probe limitation and rollback.

The full local unit suite passed 138 checks before three holding-only tests were added; all three holding tests and four migration-plan checks pass. This does not close the remaining browser acceptance or live payment/email gates.

Owner decisions now include bath-salt assortment, frame orientations and shared stock per frame size. A read-only reconciliation found two differing local database copies (43 and 35 products), neither with a verified migration ledger. No source was silently adopted. The operational review identifies the needed order-choice storage and reservation aggregation; see docs/catalogue-mapping-review.md. Bath-salt prices were submitted to the owner as a local-rehearsal decision, not live import authorization.

## Provider and checkout-settings continuation

Read-only Wix Accept Payments review confirmed cards, Apple Pay, Google Pay, Clearpay and Klarna with Checkout Active and Payouts Active. PayPal shows Checkout Active. Tap to Pay on mobile is active; Wix Point of Sale shows an Accept action and manual payments are not connected. No controls were changed. The shared payment decision and migration checklist now distinguish this completed source inventory from pending destination eligibility and payment tests.

Checkout settings show enabled terms, privacy and return policies. Policy agreement is enabled and prechecked; marketing opt-in is enabled but not prechecked. Terms use a Leyton return address, privacy/returns use Unit 45A in Fenton, and contact details use Unit 41 in Fenton. Several telephone numbers and legacy .com references are present. Terms and the return policy also use different start points for their fourteen-day wording. These factual discrepancies require owner reconciliation before reuse; no legal assessment or policy edit was performed. The settings summary was saved, but full checkout-editor text archival remains pending; the browser page export capability was unavailable and was not retried.

Resend and Stripe require sign-in, so owner account access and sending-domain status remain unverified. Fresh public DNS checks matched all 36 preserved web/mail comparisons. Twelve probes of the three default Resend sending labels across four servers returned NXDOMAIN; this does not establish the exact labels of an uninspected owner account. Evidence is in `infra/provider-readiness-2026-09-26.json` and `infra/provider-dns-verification-2026-09-26.json`.

Asif approved customer messages through Resend plus business notifications to `Saltylamps@hotmail.com`. The separate staged production-settings file uses that owner destination, preserves the public `info@saltylamps.co.uk` contact, and leaves sending disabled. No remote schema or settings were changed. Two new in-memory routing tests passed with mocked providers: signed order events produce the separate buyer/owner messages once, enquiries target Hotmail with customer Reply-To, and public contact content excludes the owner mailbox. Actual delivery, sender authentication and customer-reply handling remain pending. All previous uncommitted work was retained; stock, packed weights and the second backup remain deferred.

Final follow-up validation: all 16 focused routing, checklist consistency and production-safety checks passed. The local build passed using the saved catalogue snapshot, whose SHA-256 remained unchanged. Asif has asked the business owner to create Resend and Stripe accounts; creation, activation and access are still awaiting confirmation. No new top-level launch gate was closed.
