# Salty Lamps production deployment plan and launch ledger

Last reviewed: 27 September 2026. This is the single operational index for the
replacement-shop release. The twelve-stage migration checklist in
`../salty-lamps-site/docs/migration.md` remains the detailed requirements source;
this plan records the deployment sequence, current evidence, owners, unresolved
items and go/no-go decision in one place. Update each row when evidence changes.
Never infer completion from a local test or from a page merely loading.

## Release decision

**Current decision: NO GO for public commerce.** The owner has authorized a
private Cloudflare test shop with Stripe sandbox and a public holding page. The
owner has not given the later go-live instruction to replace that holding page.
No production data import, live credential connection, real payment, service
cancellation or public commerce switch is included in the test publication.

The current test deployment is `b4ec4cc2-af0c-44ea-9dcf-c4a8e3533b8c`. It was
built from the reviewed file tree before the corresponding source commit. The test deployment uses the replacement application's code, built with a
staging flag and bound to an isolated **demo** D1 database. The owner-account
production D1 database is empty. Passing tests against the demo database will
not make its catalogue, stock, orders, customer identities, shipping values or
email settings production truth. The go-live candidate should use the same
reviewed source commit, but a separately built and configured production
artifact, followed by validation against the reviewed production database.

| Surface | Current destination and state | Release boundary |
| --- | --- | --- |
| Public site | `www.saltylamps.co.uk` serves the approved wooden-frame under-construction page from owner-account Pages project `salty-lamps`; verified in browser after the test publication. Its HTTP 503 response is the deliberate holding-page behavior, not commerce readiness. | Do not replace before the final go-live decision. |
| Private test shop | `test.saltylamps.co.uk/shop` serves owner-account project `salty-lamps-staging`, protected by the two-person Cloudflare Access policy. Current deployment: `b4ec4cc2-af0c-44ea-9dcf-c4a8e3533b8c`; previous: `33bd0781-dcb5-475a-8ad3-e6bf335af9cd`. | Test data and settings only; no customer traffic. |
| Private test administrator | `admin.saltylamps.co.uk/admin` uses that same project, database binding and owner/operator sign-in policy. Its bare hostname now opens `/admin`, while customer pages redirect to the protected test shop. The shop has no Admin navigation link. | The admin hostname and API must stay protected. |
| Sandbox webhook | `salty-lamps-staging.pages.dev/api/webhook` is the path-specific Access exception. The application still verifies the Stripe signature. | Keep this signed sandbox endpoint reachable; do not point a live webhook here. |
| Production database | Owner-account EU D1 `4637fb18-2b0a-498d-b6c0-a90d6e50d3f4`, currently empty. | Owner review, schema/import plan, backup and reconciliation precede writes. |
| Staging database | Owner-account EU D1 `981a6d7b-8eb7-4057-8023-d2a4894c21e4`, synthetic fixture. | Never import or merge this data into production. |
| Wix and mail | Existing Wix shop retained for rollback; Zoho mail routing remains in place. | No cancellation until later monitored handover and separate approval. |

The sole Cloudflare production destination is the account owned by
`Saltylamps@hotmail.com` (`e35d5918c507bc2cf4e920fe38b5e318`).
`asifhussain60@gmail.com` is an administrator **within that account**; its
personal Cloudflare account is not a destination. The retired
`asifhussain60@hotmail.com` account, resources and credentials are prohibited.
See `account-ownership.md` before any remote operation.

## Evidence and status rules

Use **Complete** only when the target environment and business behavior were
observed and the evidence is linked. **In progress** means some checks passed
but a required result remains. **Blocked** means a concrete dependency prevents
the next safe step. **Pending** means work has not started or awaits the later
go-live window. Record the date, environment, operator, result, and evidence for
each change; preserve failed checks as well as passes. Do not paste secrets,
personal customer data, one-time codes or payment credentials into this ledger.

| Stage | Current status | What closes it | Primary evidence / open limit |
| --- | --- | --- | --- |
| 1. Owner destination | Complete for account identity | Owner account and membership match the approved boundary. | `account-ownership.md`; provider permissions remain separate. |
| 2. Wix recovery preparation | Complete for one local preparation copy | Preserve the accepted recovery bundle and identify its gaps; take fresh backups for cutover. | `migration-checklist-audit-2026-09-27.md`; two media references and full original-media archive remain unresolved. |
| 3. Production environment | In progress | Verified production schema, reviewed initial catalogue, isolated deployment credentials, recovery copy and guarded deployment. | Empty EU D1 and holding site exist; R2, production database data and credential gate remain open. |
| 4. Administrator access | In progress | Signed-out denial, owner and operator acceptance, revoked-user denial, API denial and recovery route on the final host. | Two-person policy and signed-in operator dashboard verified; owner/revoked-user paths remain open. |
| 5. Catalogue and archive mapping | In progress | Owner compares Wix archive and replacement structure, signs field/identity mapping, import exceptions and reversible plan; repeat import preserves all approved data. | Local 294-field/480,778-value recovery passed. Staging Wix archive deliberately says it is not connected. No production import authorized. |
| 6. Delivery and stock | In progress | Every saleable basket has approved actual stock, packed weights, postage bands and supported address; quote-only items stay quote-only. | Staging uses synthetic packed weights and a zero-cost SW1A test rate. These cannot become live rates. |
| 7. Payments | Sandbox payment and full refund verified; production pending | Owner approves live setup and a controlled real payment/refund proof after cutover preparations. | A fresh test-card payment produced a paid order, decremented stock and then fully refunded in Stripe sandbox. Provider retries, delayed methods, wallets/PayPal and live lifecycle remain open. No real charge in testing. |
| 8. Customer email and business mail | In progress | Each required buyer/owner template is delivered and reply handling is received in the business mailbox; Zoho continuity is proved. | One separate outbound delivery was received. Staging customer email is off and `MAIL_DRY_RUN=true`; the business mailbox reply was not verified. |
| 9. Shop/admin rehearsal | In progress | Full desktop and phone journey, safe administrator writes/readbacks, checkout outcomes, error states, access denial and no high-severity defect. | Full disposable local suite: 268 passed, 26 skipped, zero failed. Live shared-stock, paid-order/refund and host-route checks passed; see limits below. |
| 10. Domain and holding page | Complete for holding state | Authoritative Cloudflare zone, public holding page, and retained Wix/Zoho routing are verified. | `private-test-domain-verification-2026-09-27.json`; public holding page reconfirmed after the 27 September staging update. |
| 11. Public cutover | Pending | Owner's explicit go-live instruction after all blocking gates; publish approved commit with reviewed production bindings, then run immediate acceptance. | No public shop deployment has occurred. |
| 12. Legacy-service retirement | Pending | Monitor orders, payments, emails, inventory and recovery, then obtain separate cancellation approval. | Wix and Zoho remain active. |

## Private test acceptance ledger

The following is the state of the **published sandbox**, not an assertion that
all future production features work. The 27 September work changed routing and
sandbox wording without redesigning or restyling the user-approved shop.
The full disposable local browser suite passed 268 tests, skipped 26 fixture-
dependent cases and failed none; all 162 unit tests passed. The staging build,
preflight and bundled Function also passed. The owner-account dashboard reported
380 files uploaded and deployment success. Signed-in shop readback showed 33
demo products in eight categories with **no Admin navigation link**. The live
admin and shop both use owner-account Pages project `salty-lamps-staging`; its
production-environment `DB` binding was read back after publication as staging
D1 `981a6d7b-8eb7-4057-8023-d2a4894c21e4`. The distinct production D1
`4637fb18-2b0a-498d-b6c0-a90d6e50d3f4` is not bound. A saved stock change
in admin appeared on the shop product page and was restored. A fresh Stripe
**test-mode** card payment created a paid order and reduced stock, then an admin
refund marked it refunded; stock was manually restored to its original demo
value. Transactional emails stayed off and outbox jobs were skipped. These
actions moved no real money, sent no customer mail and touched no production
database. Post-deployment browser checks confirmed admin `/` to `/admin`, admin
shop pages to `test.saltylamps.co.uk` with path/query preserved, and old shop
admin links to `admin.saltylamps.co.uk`. Signed-out shop and admin requests still
landed on Access sign-in; the public holding page still returned its deliberate
503; the signed sandbox webhook remained reachable. `SITE_URL` was aligned to
`https://test.saltylamps.co.uk` in both deployment variables and shop settings.

| Test area | Observed result on 27 September | Next acceptance action |
| --- | --- | --- |
| Administrator home | Dashboard totals, chart, recent order, top product and stock alerts loaded at the dedicated host. | Check owner identity and signed-out/revoked-user gates after each Access change. |
| Orders | A new sandbox order appeared paid with the test amount, item, postage and skipped emails. Admin full refund changed it to Refunded; no real money moved. Despatch, cancellation, partial refund and failure paths were not exercised live. | Exercise remaining safe transitions on disposable orders and verify reload, audit and sandbox reconciliation. Never use a live charge. |
| Products | 35 records listed with search/filter, shipping-weight and visibility columns. | Create/edit/visibility/image/delete on disposable records, then verify shop readback and rollback. |
| Categories | Ten categories listed with edit/delete controls. | Create/edit/hide/delete a disposable category and confirm shop navigation and product reassignment. |
| Inventory | Admin stock 9→0 made the live shop product out of stock and disabled Add; 0→9 restored saleability. A sandbox sale decremented 9→8, and the test value was restored to 9 after refund. Refund does not auto-restock. | Exercise other stock and weight edits on disposable options; verify alerts, checkout and reload. |
| Reports | Sales, category revenue and inventory data loaded. After the fresh refund, £29.99 from the prior paid sandbox order remained in sales while the refunded order was excluded. | Check postage report completion and exports, date boundaries and agreement with orders. |
| Emails | Templates and activity loaded; fresh order and refund jobs were skipped because mail remained disabled/dry-run. A separate one-time outbound service test was received, but a reply at the business mailbox was not verified. | Verify templates, retry/idempotency and recipient delivery only in an approved controlled email test; keep customer sending disabled until launch gate. |
| Settings | Shop threshold, Delivery test rate, and Email & alerts loaded. Site URL was saved and read back as the protected test host. Transactional email switch remained Off. | Save/read back other reversible demo settings and restore; verify production values separately. |
| Wix records | The page loaded and explicitly reported that the historical archive is not connected to this environment. | Connect only an approved separate historical archive binding after owner mapping review; do not point it at shop D1. |
| Operator test suite | Checklist page loaded; results are browser-local and currently unrecorded. | Run the full desktop and phone walkthrough and export evidence. |
| Documentation | Navigation is present. | Review each page against the final release and keep the migration mirror in sync. |

### Administrator data-source and route audit

| View or route | Source and current result | Deliberate boundary or remaining check |
| --- | --- | --- |
| Dashboard, Orders, Products, Categories, Inventory, Reports, Emails activity/enquiries, Settings | These views use `/api/admin/*` on the same staging Pages project and its single `DB` binding. Signed-in pages loaded current test data; inventory and order changes were read back across admin and shop. | Some individual create/delete, export, despatch and error paths remain for rehearsal; do not treat page load as full feature acceptance. |
| Shop catalogue, product availability, basket and checkout | Customer APIs use that same staging `DB` binding. A live admin stock edit changed the product purchase state; a sandbox payment changed both order and stock state. | Staging prices, stock, weights and postage are demo values, not launch data. |
| Wix records | Separate historical archive binding is absent, and the view explicitly says it is not connected. | Remains separate until owner approves mapping at checklist item 5. Never bind the shop database as the archive. |
| Documentation and operator test suite | Documentation ships with the application; test-suite notes are stored in the operator browser. | Neither is a shop database view, so no D1 write is expected. |
| Administrator hostname `/`, public page paths and API paths | `/` redirects to `/admin`; customer page paths redirect with query to the test hostname; unrelated `/api/*` paths return 404 on the administrator hostname. Administrator APIs remain behind Access and origin authentication. | `/api/images/*` remains allowed on the admin hostname for future image serving, but R2 upload storage is not active in this staging deployment. |

## Production data decision and preparation

1. Owner and operator compare the separate original Wix exports, local recovery
   database, replacement shop schema, approved copy/media, product/option IDs,
   prices, stock pools, tax, discounts, shipping and customer identities. Record
   every field as live mapping, history-only, or unresolved. Historical records
   require a separate archive binding; never load the archive into shop D1.
2. Agree the initial production catalogue and opening-stock authority. Replace
   synthetic weights and SW1A zero-cost rate with approved actual values.
   Resolve two missing media references and establish the image-storage terms
   and resource only at the separately approved go-live action.
3. Take fresh source and destination backups. Rehearse schema/import into a
   disposable copy, verify row/field/value totals and round-trip export,
   idempotent rerun, search, prices, options and checkout totals. Record the
   exact migration versions and hashes. Require an actual restore drill.
4. Require an explicit owner decision at checklist item 5 before **any** write
   to the empty production D1. Do not copy staging orders, customers or demo
   catalogue into it. Reconcile Wix changes again immediately before cutover.

## Production service and release gates

- **Access:** Keep the exact two-person administrator sign-in rule, no bypass,
  correct approved-account membership and an owner recovery route. Test direct
  page and API denial, approved owner/operator access, and revoked-user denial.
- **Payments:** Preserve sandbox on the test hostname. Prepare distinct live
  credentials and a live signed webhook only after owner authorization. Check
  payment methods against Wix inventory, success/decline/3DS, retry and webhook
  idempotency, reservation release, partial/full refund and dashboard order
  state. A real-money proof needs a separate explicit business authorization.
- **Email:** Keep Zoho MX and mailbox running. Verify sender domain, buyer and
  owner templates, delivery logs, bounce/failure behavior, business reply
  receipt and unsubscribe/consent behavior where applicable. Do not enable
  outbound customer email merely because a dashboard template renders.
- **Shop/admin:** Run full desktop and phone purchase and management journeys
  using approved production data and rates, including empty/error states,
  accessibility basics, administrator writes and persistence after refresh.
- **Infra:** Validate the owner account and binding IDs before upload; confirm
  production build, routes, noindex/canonical behavior, capacity/quotas,
  monitoring, rollback artifact and immutable source commit. Keep temporary
  access or deployment credentials narrow and revoke after use.

## Go-live sequence (not yet authorized)

| Order | Action | Required recorded proof before advancing |
| --- | --- | --- |
| 0 | Freeze the approved source commit, catalogue and launch window; name the owner, operator and rollback lead. | Owner's explicit go-live decision and completed gate matrix above. |
| 1 | Record fresh Wix, Zoho, catalogue, production D1 and current holding-page recovery points; verify restore instructions and existing project deployment IDs. | Backup hashes, restore drill, source-change cutoff and rollback links. |
| 2 | Apply only the reviewed production schema and catalogue/import plan to the approved empty production D1. | Migration ledger, row/value reconciliation, idempotent rerun and no staging/Wix-history cross-contamination. |
| 3 | Configure owner-account production secrets and bindings, protected admin, real delivery rates/media and customer email after their separate approvals. | Readback of modes and resource IDs without exposing secret values; independent sender, payment and access checks. |
| 4 | Build the frozen commit for production with a fresh production content snapshot; deploy it initially without switching `www`. | Asset/function checks, direct preview acceptance, signed-out protections and no preview leaks. |
| 5 | Re-run catalogue, basket, postcode, shipping, checkout, email and admin journeys against the production target. Resolve every release-blocking defect. | Dated desktop/phone results and provider logs; real-money proof only if separately authorized. |
| 6 | At the owner-approved moment, switch the public custom domain from holding page to the approved commerce deployment. | DNS/Pages mapping, TLS, redirect/canonical, public content and monitoring readback. |
| 7 | Perform immediate public smoke checks and observe orders/payments/email/stock, with owner and operator available to revert. | Time-stamped customer and admin results, provider events, alert status and incident log. |
| 8 | After the agreed observation period, decide separately on Wix and Zoho retirement. | Owner's explicit cancellation approval and verified ongoing recovery/mail continuity. |

**Rollback rule:** If public navigation, checkout, administrator protection,
payments, email or database integrity fails, stop new releases. Restore the
approved holding deployment/domain mapping or previous known-good production
deployment, keep Wix and Zoho available, and reconcile any orders/events that
arrived during the window before retrying. Database rollback must be based on
the fresh restore drill and transaction/event ledger; never overwrite legitimate
new orders with an old snapshot. Preserve failure evidence and obtain another
owner go-live decision after repair.

## Change log and next update

| Date | Change | Evidence / remaining limitation |
| --- | --- | --- |
| 27 September 2026 | Protected test shop and administrator custom hosts attached; exact owner/operator Access rule verified; public holding site retained. | `private-test-domain-verification-2026-09-27.json`; owner and revoked-user sign-in checks remain. |
| 27 September 2026 | Removed Admin from shop navigation and published the same staging application's updated build to the owner-account test project. | Final deployment `33bd0781-dcb5-475a-8ad3-e6bf335af9cd`; signed-in shop readback showed no Admin link, admin dashboard and direct test-shop shortcuts loaded, public holding page unchanged. Intermediate deployment `85c23578-1e38-4e21-babc-5924112eafae` was superseded after correcting the administrator shop shortcuts. |
| 27 September 2026 | Rechecked the complete local shop/admin suite, proved live shared inventory, completed a Stripe sandbox payment and full refund, and corrected conflicting shop/admin host paths. | Current deployment `b4ec4cc2-af0c-44ea-9dcf-c4a8e3533b8c`; 162 unit passes, 268 browser passes, 26 fixture-dependent skips. Owner-account binding remains the isolated staging D1. Signed-out Access, sandbox-only flags and public holding page were rechecked. |
| Next | Complete remaining reversible admin transitions, owner access acceptance/revocation, phone shopping suite, then owner catalogue/database mapping. | Record specific pass/fail evidence here and in the twelve-stage migration checklist; keep public launch marked NO GO until every blocking gate closes. |
