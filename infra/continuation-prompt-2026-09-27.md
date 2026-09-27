# Continue the Salty Lamps migration

## Fresh publication check

The public owner-account staging shop loaded its 33 demo products and sandbox
banner at the shop route. Signed-out requests to the protected administrator
page and order API redirected to Cloudflare Access. The available browser
sessions were signed out, so this check did not repeat the earlier successful
approved-user dashboard visit. The customer domain still displayed the
approved holding page and returned HTTP 503 with no-store. See
`infra/published-sandbox-verification-2026-09-27.json`. No deployment, charge,
email, import or DNS change occurred in this read-only check.

## Owner email credential checkpoint

The owner signed in to the verified Resend team and created one sending-only
key restricted to `saltylamps.co.uk`. The dashboard showed zero uses. Its full
value was moved from the Mac clipboard into a private, Git-ignored, owner-only
local file; the masked dashboard prefix matched, and the clipboard was cleared.
See `infra/resend-owner-key-verification-2026-09-27.json` for the non-secret
readback. The key was not attached to either Pages deployment, staging still
has mail dry-run. After explicit approval, one direct provider message to the
operator's Gmail test inbox returned a provider ID and the dashboard showed
Sent and Delivered events. Free-plan usage changed to 1/3,000 monthly and
1/100 daily; no payment, shop order or customer email was involved. See
`infra/resend-delivery-test-draft-2026-09-27.md`. The owner then supplied a
Gmail inbox screenshot showing the expected sender, recipient, subject and
body. The owner replied, and Outlook's Sent conversation showed the reply
addressed to `info@saltylamps.co.uk`; the Zoho mailbox was not signed in, so
business inbox receipt remains unverified; the owner chose to defer that check
and continue. Shop-template buyer/owner delivery and bounce/retry acceptance
also remain open. Do not mistake this one direct
test for a completed customer email connection. The staging preflight still
forbids a Resend key and requires mail dry-run.

## Published sandbox and service-mapping checkpoint

Asif confirmed that migration work should stay focused on mapping, while
allowing Stripe and email service changes needed for verification. Preserve the
approved shop design. The separate owner-account sandbox shop is published at
`salty-lamps-staging.pages.dev`; the administrator hostname is attached behind
Cloudflare Access. One test-card payment reached the staging order list. Email
jobs were skipped under dry-run mode; no live money, customer mail, Wix import,
or production shop launch occurred. The public customer domain still serves the
holding page, and Zoho MX remains in place. The signed-out admin page/API
redirects to Access sign-in; an approved session reached the dashboard, while
revoked-user denial remains untested. See
`infra/sandbox-service-mapping-2026-09-27.md` and the updated staging guide.
The migration plan and its pricing mirror now distinguish staging proof from
production gates. This checkpoint changed mapping and service documentation,
not the approved shop layout. Older checkpoints below are historical.

## Latest access and sandbox refund checkpoint

Asif explicitly requires sandbox-only testing, with no live charges or refunds. The prepared Cloudflare token action was completed after Asif instructed autonomous continuation. The owner-account administrator application and policy are saved and independently read back: whole admin hostname, Cloudflare identity provider, two approved emails AND owner-account membership, one-hour sessions, no Bypass. The temporary credential has only Access Apps and Policies Write and Identity Providers Read, local IPv4 restriction and expiry 28 September. See `infra/admin-access-verification-2026-09-27.json`. It is not a production deployment credential. Administrator DNS/deployment and approved/denied sign-in tests remain pending; the broken browser form was not retried.

Two more actual owner-sandbox checkouts verified pending and later-failed refunds. A provider succeeded-to-failed transition revealed a reconciliation bug; fixed and verified against actual events, duplicate and stale-payload replay, and the local administrator screen. Failed refund now means paid order, failed refund and zero returned money; other successful partial refunds and fulfilment remain intact. Four synthetic orders now exist in the private fixture; all eleven email jobs are skipped and no real mail or live money movement occurred. See `infra/stripe-refund-edge-rehearsal-2026-09-27.json`. Actual provider retry transport, delayed methods, wallets and PayPal remain open.

Owner direction after review: keep R2 inactive during testing and allow its subscription decision only at go-live; no test charges are authorized. The prepared page showed zero due now but recurring terms and possible usage charges. Final terms acceptance remains an action-time go-live step. See `infra/storage-activation-readiness-2026-09-27.json`. Resend now redirects to sign-in; the owner must restore their session before credential setup and delivery tests. Owner review of both database structures, live mapping, current stock and packed weights still gates production import. Existing postcode footer acknowledgements were verified locally; deployed-candidate attribution remains a launch check. No production import, shop launch or DNS change occurred.

Validation: 155 unit tests passed; committed-snapshot build passed with 112 route shells and 41 referenced media files. Temporary Pages and Stripe forwarding processes stopped; the fixture-only admin bypass was removed. Private sandbox credentials remain in the approved protected fixture. Earlier checkpoints below are historical and superseded where this checkpoint records later evidence.


## Latest migration preparation checkpoint

The saved Stripe sandbox network restriction is verified in `infra/stripe-sandbox-policy-verification-2026-09-27.json`. The complete national postcode capture and local import measurement passed: 1,760,216 non-BT rows, 39,669,760 SQLite bytes, all 45 chunks replayed without changes, indexed prefix lookup and integrity check passed. See `infra/postcode-full-measurement-2026-09-27.json` and `salty-lamps-site/docs/postcode-import-plan.md`. Source SQL and the full database/chunk manifest remain ignored under `salty-lamps-site/d1/postcodes/` and `backups/postcodes/full-plan-2026-09-27/`. Actual remote write accounting, public attribution and owner-reviewed production import remain pending; no remote import was performed.

A narrowly scoped Cloudflare account-token draft is ready for confirmation in the verified owner account. It grants only Access Apps and Policies Write plus Identity Providers Read, allows only the current local IPv4 /32, is active from 27 September and expires 28 September. `infra/admin-access-token-draft-2026-09-27.json` records the exact draft. The user has been asked for the browser-required action-time confirmation to create it, save it privately on this Mac and use it for the reviewed two-person administrator protection. **No token or Access policy has been created.** Do not repeat the broken Emails-selector browser form. If approval arrives, complete this prepared API route and verify the persisted selectors before any administrator deployment or DNS. Deployment credentials and this Access-only credential are distinct.

The current public holding page was visibly verified in Chrome; Zoho mail-routing records remain intact. An automated Python request separately received Cloudflare 1010/403, so it is not counted as a customer outage or a fresh 503 proof. See `infra/migration-public-check-2026-09-27.json`. Production preflight still fails closed for missing explicit credentials. Source validation passed 153 unit checks, three postcode planner tests and the committed-snapshot build with 112 route shells and all 41 referenced media files. No real payment, customer email, production import, full-shop deployment or DNS change occurred. Older checkpoints below are historical.

## Later approved sandbox rehearsal

Owner sandbox connection is now verified in a disposable local fixture. Actual embedded checkout passed decline, success, failed and successful 3D Secure authentication, signed provider webhook delivery, local duplicate replay, partial/full refund reconciliation and expired-reservation release. Two simulated GBP orders were created; one fully refunded. Five email jobs were skipped and no real mail was sent. Production connection, remaining provider edge cases, payment-method parity and live validation remain pending. See `infra/stripe-sandbox-rehearsal-2026-09-27.json`. The sandbox network policy has now been saved and read back: one existing test key, current local IPv4 /32 only, new-key default off. Allowed-network API access passed; denied-network enforcement is untested. See `infra/stripe-sandbox-policy-verification-2026-09-27.json`. Do not repeat the credential approval request; Asif approved it. Preserve the private local fixture separately from production. Prior checkpoints below are historical.


## Stripe owner-completion follow-up

The owner’s completion report has now been verified in the signed-in dashboard. Both live and the separate owner sandbox have no active tasks and Payments/Payouts Active. The earlier sandbox owner/director verification blocker is cleared. Both accounts still have no webhook destination. A fresh isolated local fixture is ready; the existing owner-sandbox key has not been saved or used, and explicit local credential-storage approval is pending. Read `infra/stripe-owner-completion-verification-2026-09-27.json` before repeating provider work. Account activation is complete; replacement connection and payment lifecycle verification remain pending. Do not use historical proposal credentials.

## Later checkpoint from this continuation

Read `infra/checkout-runtime-follow-up-2026-09-27.md` first for the latest evidence. The fresh disposable Pages postcode gap is now resolved with unmocked desktop/mobile checks. Unsupported redirect sources and the loop-prone rewrite were removed; middleware also now preserves four legacy redirects previously masked as 404. All 56 saved path rules were checked against the local built candidate. The independent approved-price/shared-stock catalogue rehearsal passed again. The national postcode list contains 1,760,216 non-BT rows; one-day Free import is not feasible. Full-size measurement, actual write accounting and a resumable daily plan remain open. Continue owner stock/weight/mapping review and independent provider preparation; do not repeat the closed fixture investigation or mistake these local passes for production acceptance. The original handoff below is retained as history.

## Original handoff

Continue the Wix-to-Cloudflare migration from the current `develop` checkout. First read `AGENTS.md`, `infra/account-ownership.md`, `salty-lamps-site/docs/migration.md` and `infra/migration-checklist-audit-2026-09-27.md`; inspect Git status and current public evidence before treating recorded dashboard observations as still current. Keep the twelve-stage checklist accurate, with completed, in-progress, blocked and pending work clearly distinguished.

Asif explicitly closed checklist step 1 for the **verified owner account and migration destination**, and step 2 for **one verified local recovery copy sufficient for preparation**. This does not prove every provider permission or a complete business restore. Preserve the missing Wix media/settings, fresh production backup and launch restore requirements in their later stages. Do not request a second independent copy as a prerequisite for independent preparation unless Asif changes that decision. The complete unit suite passed 151 checks on 27 September.

Use only the Cloudflare account owned by `Saltylamps@hotmail.com`. The Gmail member is an administrator within that account; its personal account is not a production destination. Never access or use the retired Asif Hotmail Cloudflare account, resources, project, database or credentials. Keep Wix exports and their rehearsal database separate from the replacement shop database. Do not import customer data or change the public holding page without the required owner review and launch authorization. Keep Wix service and Zoho mail running.

Start with the independent local checkout gap: the earlier postcode suggestion browser pass was mocked. The unmocked test failed because the Pages development server used a shop fixture database without the `uk_postcodes` table. A separate `wrangler d1 execute --local` command reached a different local database; its schema and two test postcode rows did not fix the Pages runtime. Use a **fresh disposable** local Pages/D1 fixture, bootstrap the postcode table and sample rows into the exact bound database, then rerun the real suggestion journey on both checkout pages and manual entry. Record the command, database boundary and response. Do not copy either existing local database into production. Then investigate the two invalid local redirect rules and validate the intended routes against the built candidate.

Continue the separate catalogue and delivery reconciliation where the owner has already approved bath-salt rehearsal prices and shared frame stock by size. Current opening stock, packed weights, active promotion, voucher or gift-card obligations, legal contact/policy wording and exact live mapping still need review. The owner must review the Wix archive and replacement structure before any production schema change or import. Check the planned UK postcode dataset against D1 Free database size, daily write and statement limits rather than assuming the full import fits or completes in one day.

Treat provider gates as separate. The Cloudflare Access browser policy form repeatedly crashed; do not retry it. The reviewed API design is still offline, with no scoped token, saved policy, admin DNS or sign-in proof. The owner Stripe live account was previously shown Active, but its separate sandbox had a past-due owner/director verification task; no matched owner-account test credentials, webhook or provider payment lifecycle have been proven. Resend public sending records and Zoho MX remain present, but no API key or real buyer/owner inbox delivery has been proven. Do not perform a live purchase/refund, customer email send, deployment, DNS change, service cancellation or customer-data import without the relevant business authorization.

The public `www.saltylamps.co.uk` currently serves the approved holding page; the bare domain redirects there. The replacement shop is not launched. Continue work that is independent of Jared's Stripe verification, run appropriate source tests and real browser checks, update the checklist only for observed evidence, and report remaining blockers plainly. Commit and push reviewed repository changes after validation, as Asif previously requested.
