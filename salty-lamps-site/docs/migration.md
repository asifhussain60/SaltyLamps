# Salty Lamps — Wix to Cloudflare migration plan

Reviewed 27 September 2026. Generated from the same plan as the admin Migration page; test/migration-plan.test.mjs enforces parity.

> Cloudflare domain management is active. Following separate explicit owner authorization, www.saltylamps.co.uk now shows the wooden-frame holding page; the bare domain redirects there. Wix remains retained for rollback and Zoho routing is unchanged. The replacement shop, payments and customer data are not live. Administrator Access remains blocked and unprotected; independent migration preparation continues using the accepted single verified backup.

Use the existing replacement shop on Cloudflare. Wix pages cannot simply be exported as a working site to another host. Transfer the business data, images, addresses and domain settings in controlled stages. Retain Wix for recovery and keep the Zoho mailbox running while the public domain displays the approved holding page.

## Numbered migration status

| Number | Item | Status | Evidence and remaining work |
| --- | --- | --- | --- |
| 1 | Verify ownership and the exact permissions | In progress | Saltylamps@hotmail.com is the approved owner account. Asifhussain60@gmail.com signed in to that account and appears as an Active member; its entire-account policy lists Administrator and Super Administrator - All Privileges. An empty EU-jurisdiction D1 database was created there, establishing that resource-creation action only. The former asifhussain60@hotmail.com account is retired and prohibited and did not appear in the displayed member list. Shop administrator Access sign-in and other business account permissions remain open. Owner-account Pages creation, holding-only deployment and www custom-domain attachment are now verified; this does not establish other untested permissions. Follow-up member/invitation audit completed: the unfiltered owner-account All members page lists exactly the owner and Gmail, both Active, and no Invite Pending entries. Official Cloudflare guidance confirms pending invitations appear in this member list; no separate invitation page is required. No membership changes were necessary. Provider follow-up verified the owner Resend account and Free plan. The signed-in Stripe dashboard now verifies a Salty Lamps Ltd. account owned by saltylamps@hotmail.com, with a separate sandbox; live Payments and Payouts now show Active with no active account tasks following owner setup. Wix payment-method inventory was completed read-only. This does not establish PayPal or Zoho account access, the replacement shop's live payment connection, or Resend API-key access from the replacement shop. The owner created the Resend account and its sole listed member is saltylamps@hotmail.com. Stripe account access and live Payments and Payouts capabilities are verified; provider integration and payment lifecycle tests are not. |
| 2 | Take complete backups and prove they restore | Verified copy available; preparation unblocked | Fresh continuation verification passed after correcting a local SQL dump ordering defect: all four original export files recovered byte-for-byte and 294 fields / 480,778 cells survived import, SQL restore and CSV re-export. A private recovery bundle restored and hash-verified 236 captured files on this Mac; this is a partial-material recovery test, not a complete business restore or independent second copy. Full HTML saved for 56 inventoried pages; the three public policy pages were hash-verified and their visible text extracted. Checkout policy settings were subsequently inspected read-only: terms, privacy and returns policies are enabled; policy agreement is enabled and prechecked, while marketing opt-in is enabled but not prechecked. Terms, returns/privacy and contact details name differing addresses and phone numbers; terms also contain legacy .com references. Capture of those settings is not approval of their text or replacement behavior. Exact checkout-editor text archival and owner reconciliation remain pending. 142 of 144 catalogue media references recovered, with two still returning access denied. Wix Storage Manager reports 443 site files using 819.09 MB. A selected batch of 100 offered Download, but Chrome blocked the Wix archive destination and no file was saved; full original media remains unbacked up. A historical proposal database backup restored locally, but its retired account does not satisfy the owner-account production backup gate. Signed-in review recorded both promotions, zero Wix subscriptions, gift-card setup state, stock timing and checkout toggles. Owner-account R2, remaining settings and a complete business restore remain open. The owner accepts the single verified local recovery bundle for continued preparation and explicitly defers the independent second copy. Missing media/settings stay recorded; they do not block independent catalogue review, account checks or local shop testing. This does not authorize production import, launch, payments or cancellation. |
| 3 | Prepare a separate production environment | In progress | An empty EU-jurisdiction D1 database was created in the verified Salty Lamps owner account and its identifier was pinned in the separate production configuration. The dashboard shows the European Union jurisdiction and Eastern Europe region, with no shop or Wix data imported. The retired Asif Hotmail proposal account and database remain prohibited; its old deployment paths are disabled. The owner-account salty-lamps Pages project serves only the approved seven-file holding bundle. Its www custom domain is Active with SSL enabled; the public wooden-frame page and email links were verified in desktop and phone browsers. A separate old proposal preview still returned public storefront HTML on 27 September; it is not the production shop and must not be used or changed through the retired account. No commerce application, customer data or database bindings were uploaded. R2, protected administrator Access, scoped credentials and the reviewed production schema/catalogue remain outstanding. |
| 4 | Protect the admin before importing through it | Blocked; browser form deferred | Admin menu now targets the dedicated administrator hostname. Deployed bypass disabled; local direct-page and API denial tests pass. The approved owner dashboard now reports Zero Trust Free active, and Cloudflare is its only listed identity provider. No Access application or policy was saved: selecting the exact Emails rule in the application policy form crashed the dashboard with Maximum call stack size exceeded on two attempts. The owner independently reproduced the same crash. Browser form retries are deferred. A narrowly scoped API design has been reviewed offline, including the two-address allowlist intersected with owner-account membership; no token, application or policy was created. The administrator site is not protected. No public DNS answer for the administrator hostname; live Cloudflare sign-in, approved-user and revoked-user tests remain open. |
| 5 | Reconcile the catalogue without changing identities | In progress | Fresh separate local rehearsal verified 294 source columns and 480,778 cells after a SQL dump ordering repair; four original export files were recovered byte-for-byte and repeat import made no changes. Five Python regression checks passed. The proposed Wix schema is excluded from automatic production migrations. Historical views/search/downloads and review notes require a dedicated archive database binding, not the shop database; no production binding is configured. The owner and operator must revisit the two database structures and approve any live mapping at this stage. No production import performed. Local catalogue comparison found 35 Wix parent records versus 34 public replacement groups; the missing public bath salt is an existing hidden product. Asif approved including its three sizes, retaining wooden-frame size/orientation choices and sharing stock per size. Local database copies disagree with the saved snapshot; prices, stock, copy and exact working source still require reconciliation. No duplicate products or orientation inventory were created. Owner approved bath-salt rehearsal prices of £4.49/£11.99/£16.99. Separate local rehearsal preserved all 76 public option objects, added three bath sizes with existing identities and retained three frame stock pools for six size/orientation choices. Shared-stock contention, release/reuse and SQL restore passed. Bath stock remains unavailable pending current counts and packed weights. Local orientation integration now preserves choices through basket, checkout metadata and immutable order-item JSON; no remote schema change or import occurred. |
| 6 | Prove delivery prices and stock rules | In progress | Observed and privately recorded 11 Wix weight bands, free shipping threshold, pickup and inactive international shipping. Recorded UK automated tax, included-in-price setting and four non-VAT assignments. Wix updates stock after payment and has no minimum shipping subtotal. Active culinary-salt promotion remains a launch requirement. These are preserved settings, not validated replacement behavior. Local mixed-orientation frame reservations use the existing per-size stock pool; last-unit contention and replay/release checks pass. Actual opening counts and packed weights still require business review. Eight desktop/mobile weight journeys now pass for editor save/reload, validation, product/basket display, unit conversion and exact export rows. The two export cases also pass independently after removing test-order dependence. The owner explicitly left current bath/frame counts and packed weights pending; no historic values were substituted. |
| 7 | Preserve payment methods and verify the chosen processors | Current methods inventoried; replacement verification pending | Stripe plus existing PayPal is the conditional preference. Alternatives and administrator handoff are prepared. Business Stripe ownership is verified. Its live Payments and Payouts capabilities are active; PayPal administrator approval, fees, method decisions and sandbox/live tests remain outstanding. No replacement route connected or tested. The ignored local Stripe test entries are documented as historical proposal credentials; their current account match is unverified, so they were not used and must be replaced or verified against the owner account before provider testing. Wix dashboard now confirms cards, Apple Pay, Google Pay, Clearpay and Klarna with Checkout Active and Payouts Active, plus PayPal with Checkout Active. This completes the existing-method inventory only. The owner Stripe live and sandbox payment settings both show cards, Apple Pay and Klarna enabled, with Google Pay, PayPal and Clearpay disabled. The owner sandbox has a past-due business-owner/director verification task; Stripe says its payments and payouts will not be active until the owner completes it. No owner-sandbox credential was created or used and no provider checkout was attempted. The live account has no payment-method domain or webhook destination registered. These switches do not prove replacement checkout behavior. Owner method choices and provider lifecycle testing remain pending. |
| 8 | Keep business mail working and verify customer emails | Local rehearsal complete; provider delivery pending | Zoho mail routing rechecked unchanged. Mailbox archive, account access and actual customer email delivery remain unverified. All eleven templates rendered through the real local Pages Functions renderer with nonempty subject/plain text, no unresolved tokens and valid local image assets. Eleven synthetic test attempts were deliberately skipped under MAIL_DRY_RUN and reconciled to eleven outbox records. No emails were sent and no provider credentials were loaded; actual provider/inbox delivery remains pending. Fourteen desktop/mobile email checks passed with zero retries, covering the admin page, previews, assets, outbox, incomplete-delivery notices and draft preservation. Fresh public DNS review matched all 36 preserved web/mail comparisons. The signed-in owner Resend dashboard shows the Ireland sending domain. Its exact three records were added manually to the approved Cloudflare zone after confirmation and matched on two authoritative servers and two public resolvers; Zoho MX stayed unchanged. Resend reports the domain and all three records Verified and ready to send. Resend receiving remains off. The owner Resend dashboard confirms Transactional Free, 0/3,000 monthly and 0/100 daily sends, and no payment method. No API key exists; provider delivery remains untested. Asif approved customer emails via Resend and shop notifications to Saltylamps@hotmail.com. Production recipient settings are staged separately with sending disabled; two in-memory checks verify buyer/owner routing, enquiry replies, replay suppression and public-contact separation using mocked providers. No remote shop settings were applied; actual inbox delivery and customer-reply handling remain pending. |
| 9 | Rehearse every critical shop and admin journey | In progress | Local build passed. The complete local unit suite passed 138 checks; three additional holding-route safety checks passed. Twelve rebuilt desktop/mobile checks for product saves, refunds, images, search metadata and the Admin link passed. The earlier broad browser run had 250 passes and 12 failures before local fixture repair; the earlier isolated weight/export failure was a test-order dependency, now repaired with explicit per-test setup. All eight desktop/mobile weight journeys pass, and both export cases pass when run alone with no retries. These checks used a new disposable local Pages/D1/R2 runtime with synthetic fixture data and no provider credentials. Live protected admin, redirects and full shop acceptance remain open. Current complete unit suite: 148 passed. New frame checks cover mixed choices, server validation, shared stock, payment metadata, order/receipt preservation and webhook replay using a mocked provider. Compiled local browser checks passed for mixed orientations, refresh, size edits, shared quantity cap and 390-pixel layout. Bath prices were verified across all three sizes in a separate read-only rehearsal. A fresh local build and 13 desktop checkout/recovery browser checks passed on 27 September. A direct shopper walkthrough added an in-stock lamp to the cart, opened order review, carried a manually entered postcode to the address step and confirmed empty required fields keep the shopper there. The local postcode suggestions request returned 503 because this fixture database lacks the postcode table; manual entry worked, but destination postcode data remains unverified. This local runtime used existing fixture catalogue data with Stripe credentials withheld; payment-provider, customer email, and production acceptance remain unverified. |
| 10 | Move DNS while preserving the current website and mail | Complete for DNS-only move | The original DNS-only move passed 46 comparisons. Asif subsequently explicitly authorized a holding-only public website switch. Only www changed from cdn3.wixdns.net (DNS only) to salty-lamps.pages.dev (Proxied); the Pages domain is Active with SSL enabled. The apex remains on its original Wix addresses and redirects to www. Thirty-six post-change comparisons across both authoritative servers and two public resolvers confirmed unchanged apex and mail-related records. Wix service remains retained for rollback. This is not full-shop launch or proof of delivered mail. |
| 11 | Switch the shop after a final reconciliation | Pending | Holding-only public website switch completed under separate explicit owner authorization. The replacement shop remains unpublished. Final delta, order reconciliation, timed full-shop rollback rehearsal and explicit business launch approval remain required. Exact prior Wix www routing and holding bundles are retained. |
| 12 | Monitor before retiring Wix or the old mailbox | Pending until after launch | Keep Wix, Zoho and additional redirect domains. No cancellation or service retirement performed. |

## Access evidence

| Service | Required access | Verified state |
| --- | --- | --- |
| Wix | Site owner or collaborator rights to export products, all order lines, contacts, media and site settings; inspect payment provider and domain records. | Signed-in Salty Lamps site and complete domain settings verified. All 14 service records backed up and reconciled. Export rights verified: 35 products, 62 variant rows, 148 media rows, 609 orders across 770 item rows and 4,412 contacts downloaded privately. Wix Payments and PayPal are active; 609 order-summary rows also match the item export by order ID. Local export round-trip and recovery checks have passed; partial settings and media backups are recorded in the numbered status. Complete business backup and operational parity remain outstanding. Two additional Wix-registered redirect domains must be preserved before cancellation. |
| Retired Cloudflare proposal | Historical provenance only; no further account, project or database access. | The old proposal belonged to the prohibited Asif Hotmail account. Its historical backup does not satisfy a production backup or access gate. |
| Cloudflare production | Owner account; Pages, D1 and R2 management; zone and DNS management; Access applications/policies and service tokens; Email Routing if selected. | Owner account dashboard verified. Gmail signed in and appears as an Active member with an entire-account policy listing Administrator and Super Administrator - All Privileges. An empty D1 database was created in the owner account with European Union jurisdiction and Eastern Europe region; this confirms that resource-creation action only, not other rights. Zero Trust Free is active with Cloudflare as the only listed identity provider, but no administrator Access application exists yet. Primary saltylamps.co.uk Free zone originally preserved all 14 source records. The separately authorized holding-page change updates only www to the Pages target with proxying; the other records remain unchanged. Zoho mail priorities 10/20/50 verified. Assigned nameservers: james.ns.cloudflare.com and tani.ns.cloudflare.com; registrar and Nominet delegation now use that pair; Cloudflare activation and propagation through Cloudflare/Google public resolvers are confirmed. Existing salty-lamps.com remains separate. Owner-account Pages creation, holding-only deployment and www domain attachment are now verified. Scoped deployment token, R2 and Access application still require setup. |
| Domain registrar | Nameserver and DNSSEC management for saltylamps.co.uk, with recovery access. | Nominet RDAP confirms 123-Reg. Wix identifies registration as third-party and cannot edit nameservers. Registrar login and domain management access verified. After explicit owner approval, temporarily unlocked the domain, saved james.ns.cloudflare.com and tani.ns.cloudflare.com, and restored Domain Lock. Registrar read-back and Nominet verify the new pair and restored update/transfer/delete/renew restrictions. Delegation remains unsigned. Old Wix pair is preserved in the rollback procedure. |
| Stripe / PayPal | Owner business account, active GBP payments, matched live credentials, webhook configuration and refund rights. | Replacement code uses Stripe. The signed-in Salty Lamps Ltd. account lists saltylamps@hotmail.com as its sole sandbox team owner; live Payments and Payouts show Active with no active account tasks. Live and sandbox method settings are recorded separately; no live payment-method domain or webhook destination is registered. An existing business PayPal account is reported by the owner; its live access and capabilities remain unverified. The retained Wix business has Wix Payments and PayPal configured, while the public site shows a holding page; replacement connection, method parity and payment lifecycle must be checked separately. |
| Email | Zoho mailbox/archive access, destination inbox verification, Resend account and sending-domain records. | Public MX records point to Zoho EU; all 36 preserved web/mail comparisons matched on the latest read-only check. The signed-in owner Resend team and Free quota are verified. saltylamps.co.uk is added for Ireland sending. Its three exact records are public and Zoho MX is unchanged; Resend reports the domain and all three records Verified. No API key or delivered mail exists; Zoho mailbox access remains unverified. |

## Free-first service choices

| Need | Choice | Boundary |
| --- | --- | --- |
| Website and backend | Cloudflare Pages and Functions free tier: $0/month within limits | 500 Pages builds per month and 100,000 shared Worker/Function requests per day, with 10 ms CPU per invocation. Static requests do not use the Function allowance. Free-limit exhaustion can interrupt dynamic requests. |
| Database | Cloudflare D1 free tier: $0/month within limits | 5 million rows read and 100,000 rows written per day; 5 GB total account storage. The new EU-jurisdiction database is empty. Daily limit exhaustion interrupts queries; there is no assumed automatic paid upgrade. |
| Administrator sign-in | Cloudflare Zero Trust Free: $0/month for the two approved users | The owner account now shows the Free plan active, with a 50-user limit and Cloudflare as the only listed identity provider. The checkout required agreement to terms and authorization for charges beyond included limits. The administrator application and exact two-user allow policy are not yet configured. |
| Uploaded images | Cloudflare R2 Standard free allowance: estimated $0/month within limits | 10 GB-month storage, 1 million Class A and 10 million Class B operations per month. Wix reports 819.09 MB of site files, but full original media is not yet backed up, so final size is unverified. R2 requires the owner to accept a recurring, usage-billed subscription; no subscription or bucket has been created. Standard overages are $0.015 per GB-month, $4.50 per million Class A requests and $0.36 per million Class B requests; billed units round up. |
| Incoming email | Cloudflare Email Routing is free | Forwarding to an existing verified inbox; it is not a mailbox archive or a complete business reply service. Keep Zoho until inbound and branded replies are proven. |
| Customer order emails | Retain Resend free plan initially | Already integrated. Official public pricing lists 3,000 emails per month and 100 per day on Free. Verify the actual owner account plan, remaining allowance, sending domain and all message types before launch; public pricing is not account verification. |
| Cloudflare outgoing email | Requires Workers Paid | Sending to arbitrary customers is unavailable on Workers Free. Paid starts at $5 USD/month, including 3,000 outgoing emails, then $0.35 per 1,000. Optional later choice, not approved spend. |
| Estimated incremental Cloudflare total | $0/month if all free limits hold | This is a conditional estimate, not a spending cap or launch approval. Existing Wix, Zoho, registrar, payment-processing and email-service charges are separate; usage must be measured before and after launch. |
| Payments and domain | Stripe and registrar | Stripe and PayPal processing fees and domain renewal remain separate. Cloudflare does not replace the payment processor. |

## 1. Verify ownership and the exact permissions

Use the owner’s own production accounts, separate from the test shop. Confirm access by reading the intended resources before changing them.

Owner: Salty Lamps account holder or Asif as delegated reviewer, with migration operator.

- [ ] Confirm the destination Cloudflare account and record its account, project, database and bucket identifiers privately.
- [ ] Use only the Cloudflare account owned by Saltylamps@hotmail.com for Salty Lamps resources. Asifhussain60@gmail.com signed in and is listed as an Active member with an entire-account administrator policy; record any write scope that future operations actually exercise. Never use the retired asifhussain60@hotmail.com account, its project, database or credentials. The unfiltered All members audit shows only the owner and Gmail as Active, with no Invite Pending entries; the retired address is absent. Recheck before launch and remove any future invitation for that address without using it. Shop administrator Access policies are separate and still need confirmation.
- [ ] Open the specific Salty Lamps Wix site; verify export permissions and inspect its current payment provider without changing it.
- [ ] Verify registrar nameserver and DNSSEC rights, plus recovery access and the current Wix connection method.
- [ ] Verify owner Stripe, Zoho and Resend access; record which permissions still require the owner.
- [ ] Use scoped credentials in the platform secret store or Keychain. Never paste credentials into chat, documents, source control or command history.

**Exit gate:** Every required account is identified and accessible; read access alone is not recorded as proof of write permission.

## 2. Take complete backups and prove they restore

Capture the old business and the replacement catalogue before imports or domain changes. A successful command is not enough: verify the files and restore into a disposable database.

Owner: Migration operator with Wix export access.

- [ ] Export all Wix products/options, orders in both order and line-item form, contacts with consent fields, discounts, tax and delivery rules, outstanding refunds, vouchers and any subscriptions.
- [ ] Download original media, public page copy, blog posts, policy versions and all indexed URLs; record counts and hashes in a private manifest.
- [ ] Export the entire DNS zone, including Wix web records, Zoho MX, SPF, DKIM, DMARC, CAA, subdomains and DNSSEC status. Automatic DNS scans are not complete backups.
- [ ] Export D1 and all R2 objects with exact key mapping, size and checksum verification. Use the verified backup helper with bucket-scoped R2 Object Read credentials. It validates a local database restore and exact object keys, lengths and checksums; incomplete backup remains a launch/recovery gap but does not block independent preparation under the owner-approved single-copy decision.
- [ ] Restore the database to a disposable target; compare table counts, product/option identities, order totals, image references and foreign-key integrity.
- [ ] Store customer exports privately outside the public repository. The owner accepts one verified recoverable local copy for continued preparation; an independent second copy is explicitly deferred and must not be recorded as complete. Record the last export boundary for the final delta.

```sh
node scripts/backup-wix.mjs --no-images --compare-redirects
```

**Exit gate:** Independent preparation may continue using the verified local recovery bundle, as accepted by the owner. Full backup completion still requires all required pages/data/media and a documented restore; deferred second-copy and missing-material gaps remain visible. This gate grants no production import, launch or cancellation approval.

## 3. Prepare a separate production environment

Keep the authorized public holding page separate from the commerce build. Prepare the remaining owner-account resources and build the shop only from a reviewed production catalogue.

Owner: Owner and migration operator.

- [ ] Keep the newly created, empty EU-jurisdiction D1 database in the confirmed owner account. The separate Pages project and www holding-page attachment are completed under explicit authorization. Provision R2 Standard only after its billing step is approved. Do not replace the holding bundle with the shop until launch gates pass.
- [ ] Verify the production configuration pins the owner account and new database and contains no proposal account or database binding.
- [ ] Prepare a reviewed schema/import plan: schema first, initial catalogue only when empty, then applicable migrations. Never reseed an existing catalogue.
- [ ] Use a hash-verified migration ledger. Existing databases with unknown or partly applied migrations require explicit reconciliation before adoption; never assume duplicate-column errors mean completion.
- [ ] Require a fresh production content snapshot with production credentials. Authentication/network failures must block release, not substitute the proposal snapshot.

**Exit gate:** Production target, schema history, source catalogue and backup evidence are verified; the guarded deployment entry point accepts the target.

## 4. Protect the admin before importing through it

Set up the protected admin hostname before any tool depends on the admin service. The public shop must never inherit the proposal’s open access.

Owner: Cloudflare account administrator.

- [ ] The shop Admin menu must open https://admin.saltylamps.co.uk/admin (admin.{primary domain}). Protect the entire admin hostname with Cloudflare Access SSO using Cloudflare itself as the identity provider (Sign in with Cloudflare), restricted to account members plus an explicit approved owner/operator allowlist. Verify this option in the owner account before activation; do not grant broad account membership just to enable shop administration.
- [ ] Set ADMIN_HOSTS, ACCESS_AUD and ACCESS_TEAM_DOMAIN. Keep DEV_ADMIN_BYPASS disabled and ADMIN_OPEN_HOSTS empty on production.
- [ ] Use a scoped Access service token for migration automation and confirm the application identity is accepted by the backend.
- [ ] Test the Admin menu from desktop and mobile: it opens the admin subdomain, signed-out users must complete Cloudflare SSO, approved users reach the requested page, and unapproved users are denied. Protect direct admin links and admin APIs as well as the menu.
- [ ] Test anonymous reads and writes: public shop admin paths return no private data; unauthenticated admin-host requests are denied. No legacy hostname or direct deployment URL may bypass SSO.
- [ ] Verify authorized access, private no-cache responses and owner recovery steps, then revoke temporary migration access after handover.

**Exit gate:** Admin authorization works before the catalogue importer runs; no temporary public admin bypass is permitted.

## 5. Reconcile the catalogue without changing identities

Keep Wix backups and rehearsals in a separate private database. The replacement shop already has its own structure and working catalogue; do not load Wix records into it as a side effect of backup, rehearsal or deployment. At this stage, review both structures and the existing shop with the owner before deciding whether any live merge is needed.

Owner: Migration operator and shop owner.

- [ ] Before any production schema change or import, pause with the owner to compare the separate Wix archive and replacement database. Agree which source fields need live behavior, which stay as history, how identities map, and how approved shop copy, media and stock remain intact. Record that decision and require a fresh backup and reversible, reviewed import plan. Historical admin views must use a dedicated archive database binding; never point them at the shop database.
- [ ] Inventory every exported column and nested value for products, variants, media, orders, line items, contacts, consent, discounts and business settings. Create a field-by-field source-to-destination mapping before import; preserve source names, types, blanks, units, identifiers and relationships.
- [ ] Add matching storage fields, validation, import/export support and admin views for operational data that the replacement lacks. Keep original values alongside normalized values; do not truncate addresses, option choices, notes, payment/refund details or consent states. An archive alone does not satisfy operational field parity.
- [ ] Preserve every source field in a protected, lossless record linked to its original identity. Historical records must remain searchable and exportable in the admin without replaying charges, refunds or customer emails. Any unsupported behavior or archive-only field requires an explicit owner decision before launch.
- [ ] Dry-run the import and review additions, changes, omissions, duplicate stock codes and source-to-destination identities. Source identifiers must remain stable.
- [ ] Prove that applying the same import twice creates no extra products/options and preserves historical order references, weights and owner edits.
- [ ] Transfer every gallery and option-specific image to owned storage; verify dimensions, hashes, references and absence of runtime dependency on Wix media.
- [ ] Reconcile product, option and category counts, prices, stock, visibility, descriptions and image assignments against the reviewed export.
- [ ] Reconcile every source column and populated value after import, including row counts, relationships, totals, media hashes and consent statuses. Round-trip export and compare against the source; unknown columns, unexplained omissions or lossy conversions block launch. Keep historical orders clearly identified and prevent old payment or email actions.

**Exit gate:** Owner and operator approve the boundary and mapping before any live schema change or import. Every source field has a verified destination and every populated value is preserved; required operational fields work in the admin. Round-trip reconciliation passes, import rerun is a no-op, existing shop content survives, and every discrepancy or archive-only exception has an explicit resolution. Fresh export rehearsal and schema gaps remain open.

## 6. Prove delivery prices and stock rules

Confirm the business inputs the application cannot safely invent. Missing weights or uncovered postcodes must lead to a quote request rather than an incorrect charge.

Owner: Shop owner with migration operator.

- [ ] Review actual product/packed weights and parcel grouping for every purchasable option, including multi-packs.
- [ ] Approve postage bands, remote-area exclusions, postcode prefixes, free-delivery rules and tax treatment with the owner.
- [ ] Verify UK address suggestions have a populated, licensed dataset and a working manual-entry fallback; an empty table is not a complete address service.
- [ ] Exercise light/heavy baskets, multiple parcels, unavailable stock, excluded postcodes and postcode changes before payment.
- [ ] Prove competing purchases cannot pay for the same last unit and that expired/failed sessions release only their own reservations.

**Exit gate:** Every saleable basket has a truthful final charge and deliverable address; quote-only products remain explicitly quote-only.

## 7. Preserve payment methods and verify the chosen processors

Preferred route: Stripe for cards and eligible wallets plus the existing business PayPal account, subject to account access, fees and payment-method checks. Assess PayPal through Stripe first, with direct PayPal alongside Stripe as an alternative. Wix-managed checkout remains a documented alternative with continuing Wix dependency. No replacement route is connected or tested. Follow the payment decision and administrator handoff below.

Owner: Business owner, Stripe administrator and existing PayPal administrator.

- [ ] Have the separate PayPal administrator sign in and personally approve the connection in their own browser only after the business Stripe account, fees and settlement choice are confirmed. Never share passwords, codes or secrets in chat. Verify the existing PayPal business account and current Wix connection without changing it. Direct PayPal requires a provider-aware order model, server-side create/capture/refund handling, verified webhooks, replay protection, pending/reversed payment handling and the same stock/email reconciliation as Stripe. A PayPal login alone does not make the current Stripe integration compatible.
- [ ] Record owner confirmation of the legal business type and settlement bank; confirm GBP capability in the active live account. Check required wallets/payment methods and embedded-checkout domain registration. Current Wix checkout accepts Wix Payments and PayPal; preserve the completed Wix dashboard inventory of active cards, Apple Pay, Google Pay, Clearpay and Klarna alongside PayPal. Verify each required method in the destination account and actual device checkout; source-dashboard status does not establish replacement availability.
- [ ] Set matching STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY, plus STRIPE_WEBHOOK_SECRET and SITE_URL, in the production secret store.
- [ ] Register every event consumed by the current webhook, including completed/expired checkout, asynchronous success/failure and refund lifecycle events. Redeploy after secret changes.
- [ ] Run sandbox success, decline, authentication, cancellation, expiration, webhook retry and pending/failed refund cases. Confirm orders, stock and email jobs agree.
- [ ] The owner approves and performs a low-value live purchase and refund at launch validation; confirm bank-facing payment and actual refund status. Do not record a pending refund as returned money.

**Exit gate:** Both sandbox lifecycle checks and owner-authorized live payment/refund proof pass; a mocked payment page is not evidence of Stripe readiness.

## 8. Keep business mail working and verify customer emails

Prefer free Cloudflare services where they fit. Retain Resend for customer emails and preserve Zoho until incoming mail, archives and branded replies have a proven replacement.

Owner: Mailbox owner and migration operator.

- [ ] Verify the owner’s Resend sending domain and sender/reply-to identity, publish the required records and test delivery to an unrelated mailbox.
- [ ] Check the free account’s daily/monthly allowance against all receipts, dispatch notices, support alerts, refunds and retries, with alerting before exhaustion.
- [ ] If using free Cloudflare Email Routing, verify the destination inbox and export Zoho mail first. Do not replace MX records during the initial website switch.
- [ ] Test incoming mail and replies sent as the business address. Routing alone does not provide outbound mailbox replies; keep Zoho if the replacement cannot do this.
- [ ] Verify each customer/admin template, bounce/failure logging, durable retry and no duplicate receipts. Cancellation notices must not promise a refund that has not completed.

**Exit gate:** Customer emails and business correspondence are proven end-to-end; no mailbox is cancelled merely because forwarding works.

## 9. Rehearse every critical shop and admin journey

Run the same tests on desktop and phone against the exact candidate release. Track skipped, mocked and blocked checks separately from passes.

Owner: Migration operator and owner tester.

- [ ] Run unit and real-runtime browser suites with a disposable database; verify full production build and media references.
- [ ] Exercise browsing, search, filters, option/gallery selection, basket edits, address, payment, refresh, Back/Forward and receipt reconciliation.
- [ ] Exercise product/category edits, images, inventory, orders, dispatch, refunds, reports, exports, settings, email retry and unsaved-change recovery.
- [ ] Verify keyboard focus, readable errors, loading/empty/failure states and narrow-screen layout. Inspect current screenshots, not only automated scores.
- [ ] On the protected production candidate, verify authorization, signed webhook delivery, provider email, quotas, monitoring and restore procedure. Record exact release identity and unresolved blockers.

```sh
npm run test:unit
```

```sh
CONTENT_SNAPSHOT_SOURCE=committed npm run build
```

```sh
cd tests && npm test
```

**Exit gate:** No unresolved high-severity defect; required production/provider checks are completed rather than skipped. The committed-snapshot build above is local validation only.

## 10. Move DNS while preserving the current website and mail

Separate the nameserver move from the website cutover. Cloudflare must initially reproduce the working Wix and Zoho records so the move has a clear rollback.

Owner: Registrar and Cloudflare administrators.

- [ ] Verify the complete copied zone against the private export, including both root and www records, mail records and all subdomains.
- [ ] Prepare the registrar DNSSEC transition correctly; stale DS records can make the whole domain unreachable. Re-enable DNSSEC only with the new matching records.
- [ ] Confirm the Wix site will remain connected by pointing under its current plan. Keep the recorded Wix web targets while switching nameservers.
- [ ] Change nameservers only in an agreed window after review; verify several independent resolvers, website TLS and incoming/outgoing mail before proceeding.
- [ ] Record observed propagation and rollback targets. Do not promise instant recovery: cached DNS and nameserver delegation can delay it.

**Exit gate:** Cloudflare serves the authoritative zone while Wix web traffic and Zoho email still work.

## 11. Switch the shop after a final reconciliation

Use an agreed sales/content freeze and final delta export to prevent lost orders or stock drift. The actual customer-domain change is a separate release decision after this plan is reviewed.

Owner: Owner approves; migration operator executes.

- [ ] Freeze Wix catalogue changes and new checkout during the final handover window; record pending Wix payments/orders and complete the final stock/order delta.
- [ ] Take fresh recoverable backups, reconcile totals/identities and verify zero demo orders in the production destination.
- [ ] Attach the production domain, verify certificates, SITE_URL, canonical URLs, sitemap, redirects and payment-domain registration. Keep test deployments unindexed.
- [ ] Publish only through the guarded production deployment entry point with the verified production configuration; switch the saved web records while preserving mail records.
- [ ] Verify real customer journeys and the owner-approved purchase/refund, webhooks, stock and emails; record a go/no-go outcome and retain the old shop for rollback.
- [ ] If payments, orders, mail or critical pages fail, pause new checkout and restore the recorded Wix web records. Reconcile every order accepted on either platform before reopening; never overwrite new sales with an old backup.

**Exit gate:** Owner accepts the release and reconciliation is complete; unresolved production access or provider checks block the switch.

## 12. Monitor before retiring Wix or the old mailbox

Keep the old services through a documented observation and reconciliation period. Close them only after their data and responsibilities have been accounted for.

Owner: Shop owner.

- [ ] Monitor paid orders against Stripe, fulfillment, failed webhooks, pending refunds, stuck reservations, email jobs, errors and free-tier limits daily during stabilization.
- [ ] Check old indexed URLs and redirects, submit the new sitemap and monitor search coverage and customer support reports.
- [ ] Document ownership, backups, restore steps, access recovery, monthly limits and support responsibilities; revoke temporary migration credentials.
- [ ] Cancel Wix only after final exports, outstanding orders/refunds/subscriptions and renewal implications are checked and the owner authorizes cancellation.
- [ ] Retire Zoho only after archive, inbound delivery and business-address replies pass independently. Domain renewal continues with the registrar unless separately transferred.

**Exit gate:** No unresolved handover obligation and explicit owner approval for each service cancellation.

## Payment decision and administrator handoff

Reviewed 27 September 2026. Live Payments and Payouts are active; shop connection and testing remain outstanding.

## Preferred route and present evidence

Preferred, conditional decision: leave Wix using Stripe for cards and eligible wallets, plus the existing Salty Lamps business PayPal account. First assess PayPal through Stripe; use direct PayPal alongside Stripe if eligibility, access or commercial terms make that necessary. The preference is recorded, but no replacement payment route is connected or tested.

The retained Wix business has Wix Payments and PayPal configured; the public site currently shows a holding page. Replacement code implements Stripe. The signed-in Stripe dashboard verifies a Salty Lamps Ltd. account owned by saltylamps@hotmail.com, with a separate sandbox. Following owner setup, the live account status now shows Payments and Payouts Active with no active account tasks. This verifies live account capabilities, not a connected or tested replacement checkout. A separate administrator controls the existing PayPal business account. Preserve the current Wix connections throughout preparation.

The earlier onboarding state, including its Individual / Sole Trader selection, remains historical evidence in `infra/stripe-owner-readiness-2026-09-27.json`; the later live-account check is recorded separately in `infra/stripe-live-follow-up-2026-09-27.json`. The current legal business type and settlement-bank details were not independently read back. The live payment-method settings show cards, Apple Pay and Klarna enabled, while Google Pay, PayPal and Afterpay / Clearpay are disabled. No live payment-method domain or webhook destination is listed. The account status also lists Cartes Bancaires as Paused, distinct from the active Payments capability.

In the separate sandbox, cards, Apple Pay and Klarna show Enabled; Google Pay, PayPal and Afterpay / Clearpay show Disabled. No payment-method domain or webhook destination is listed. Its account status now shows a past-due Verify your business owners and directors task, marked Not Started, and says payments and payouts will not be active until it is completed. The owner must complete that provider verification; no sandbox payment test was attempted while capabilities are paused. The ignored local development file still contains test-mode Stripe entries documented as part of the earlier proposal sandbox; they were not used and must not be treated as owner-account credentials. Fresh owner-account test credentials must be verified before provider testing. No credential was revealed or created and no account setting, payment or PayPal connection was changed.

## What the Stripe owner must establish before the PayPal handoff

The Salty Lamps Stripe account and its owner are identified, and live Payments and Payouts are active. Record owner confirmation of the legal business type and settlement bank, then confirm GBP processing and refund/dispute responsibilities before live shop connection. Do not substitute a developer or proposal account.

In the intended business account, review PayPal availability and the exact checkout integration in test and live modes. Record only a redacted account reference and capability status in the private evidence ledger. Determine the least permissions the PayPal administrator needs to complete the connection; use an official account invitation if required, never shared credentials.

Prepare the shop address, business identity, agreed statement descriptor, customer support contact, policies, chosen settlement destination and fee comparison. The business owner must approve both commercial terms and settlement before anyone enables the live connection.

## PayPal administrator handoff — use your own browser

Purpose: connect the existing Salty Lamps business PayPal account to the confirmed business Stripe account for the replacement shop, while leaving the Wix shop operating. This handoff is prepared only; access, eligibility, fees and settlement approval remain outstanding.

Once those prerequisites are satisfied, the authorized administrator opens the intended Stripe account in their own browser, goes to Settings → Payment methods → PayPal → Turn on, checks the agreed settlement choice, then chooses Continue to PayPal. They sign in to the existing business PayPal account and personally review and approve the connection. If Stripe access is needed, arrange a separately approved official invitation first. Do not copy a private authorization session into a public document or chat.

Choose deliberately between settling PayPal funds into Stripe and keeping them in PayPal. Keeping funds in PayPal requires PayPal payout management and separate reconciliation. Record the decision privately before proceeding; later settlement changes may require Stripe support.

After returning to Stripe, the administrator checks the connection status. Report only approved, pending or failed, the selected settlement route and any non-sensitive outstanding checks. A pending status is not success. Passwords, one-time codes, recovery codes, keys, bank details and secrets stay in the provider browser or approved secret store, never chat.

The migration operator subsequently verifies checkout availability and the payment lifecycle in a sandbox. Administrator approval alone is not a passed payment test. No message has been sent to the administrator and no connection has been approved by this project.

## Alternatives and their consequences

Direct PayPal alongside Stripe: retains the existing PayPal account independently. Requires additional implementation for server-side order creation and capture, verified webhooks, duplicate-event protection, refunds, pending/reversed payments and provider-aware order records. Stock, totals, fulfillment and receipts must reconcile across both processors. This route is not implemented or tested.

Wix-managed checkout: an external Cloudflare storefront can redirect customers to Wix-hosted checkout through Wix Headless. This retains Wix commerce, subscriptions and operational dependencies; it is not a complete exit from Wix. Wix Payments and PayPal availability for that specific setup, return domains, inventory ownership, order synchronization and ongoing costs must be checked. This alternative has not been connected or tested.

## Fees and payment methods still require business approval

Compare the account-specific card and wallet rates, PayPal processing and any Stripe PayPal fees, fixed charges, cross-border/currency conversion, dispute fees, refund fee treatment, payout charges and retained Wix plan costs. Record a dated quote or dashboard evidence and the approver privately. No assumed universal rate or promised saving is approved.

Cards, Apple Pay, Google Pay, PayPal, Clearpay and Klarna each need an explicit decision: required or optional; evidenced on current Wix checkout or unconfirmed; eligible in the destination account; enabled; device/currency restrictions checked; sandbox result; and owner-authorized live result. Read-only Wix Accept Payments review on 26 September 2026 shows cards, Apple Pay, Google Pay, Clearpay and Klarna each marked Checkout Active and Payouts Active, and PayPal marked Checkout Active. Tap to Pay on mobile is also active; Wix Point of Sale still presents an Accept action and manual payments are not connected. These are Wix dashboard states, not proof of availability on every customer device or in the replacement account. No payment or connection change was performed.

Check payment-domain registration, embedded-checkout support, redirect return and cancellation, mobile/browser wallet eligibility and GBP availability. Do not promise that enabling Stripe automatically preserves every Wix payment method.

## Acceptance evidence and authorization boundaries

Before launch: verify matching publishable/secret keys and webhook configuration through the platform secret store; test success, decline, authentication, abandonment, expiration, duplicate/out-of-order webhooks, delayed payments, refund success/failure/pending and reconciliation of stock and email jobs. Confirm the provider dashboard agrees with the shop and no secret appears in logs.

Keep setup approval, sandbox results and live money movement as separate evidence. A low-value live purchase and refund require explicit business authorization and must be performed by the authorized person. Reconcile the actual refund and payout status; a pending refund is not returned money. No live charge, refund, launch or cancellation is authorized by this document.

## Provider instructions

- [Stripe PayPal activation](https://docs.stripe.com/payments/paypal/activate)
- [Stripe PayPal eligibility](https://docs.stripe.com/payments/paypal)
- [Stripe PayPal settlement](https://docs.stripe.com/payments/paypal/choose-settlement-preference)
- [Stripe UK pricing](https://stripe.com/gb/pricing)
- [Direct PayPal integration](https://developer.paypal.com/studio/checkout/standard/integrate)
- [Wix-managed checkout](https://dev.wix.com/docs/go-headless/business-solutions/wix-hosted-pages/redirect-using-the-js-sdk)

## Sources verified for this review

- [Wix external hosting restriction](https://support.wix.com/en/article/exporting-or-embedding-your-wix-site-elsewhere)
- [Cloudflare account sign-in for Access](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/cloudflare/)
- [Wix checkout from an external frontend](https://dev.wix.com/docs/go-headless/business-solutions/wix-hosted-pages/redirect-using-the-js-sdk)
- [PayPal Checkout integration](https://developer.paypal.com/studio/checkout/standard/integrate)
- [PayPal through Stripe eligibility](https://support.stripe.com/questions/paypal-payment-method-availability?locale=en-GB)
- [Wix product export](https://support.wix.com/en/article/wix-stores-exporting-your-product-list)
- [Wix Media Manager download limits](https://support.wix.com/en/article/wix-media-downloading-files-from-the-media-manager)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Pages free limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/)
- [Cloudflare Zero Trust onboarding](https://developers.cloudflare.com/cloudflare-one/setup/)
- [Cloudflare Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/)
- [Cloudflare inbound email setup](https://developers.cloudflare.com/email-service/get-started/route-emails/)
- [Resend pricing](https://resend.com/pricing)

Checklist ticks are personal browser notes, not proof of account permissions or completed checks. The revised checklist uses a new storage key; prior ticks remain stored and are not silently treated as current verification.
