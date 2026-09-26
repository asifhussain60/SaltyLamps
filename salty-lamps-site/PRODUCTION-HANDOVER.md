# Production handover — reviewed 26 September 2026

The current authoritative walkthrough is [the migration plan](docs/migration.md), also rendered in Admin → Documentation → Migration. It separates preparation, account access, backups, protected administration, catalogue reconciliation, payments, email, rehearsal, DNS and cutover.

**Status: local review complete; DNS-only migration active on Cloudflare, confirmed through two public resolvers. No replacement-shop production deployment, Wix cancellation, mailbox migration or paid upgrade has been performed.** Existing proposal credentials do not establish production authorization. Owner browser sign-in and account-wide Super Administrator privileges are now verified. The owner confirmed saltylamps.co.uk remains primary; the separate salty-lamps.com domain is already active in the account. A scoped production deployment credential and production database still require setup.

**Account boundary:** The owner reports the former Asif Hotmail Cloudflare account deleted and forbids further use of it or related credentials. A proposal database backup earlier on 26 September used that legacy target; its two source-count passes recorded 3,522,376 rows read before the account alert. The alert's total usage cannot be attributed from the email alone. Local builds now use the committed content snapshot by default, the historical proposal deployment/demo-refresh paths stop, and production validation rejects the legacy account. Do not run remote proposal data commands or treat its resources as the owner destination.

The approved production owner is `Saltylamps@hotmail.com`. `asifhussain60@gmail.com` is an Active administrator **within that owner account**; the member policy applies to the entire account and lists Administrator and Super Administrator - All Privileges. An empty EU-jurisdiction D1 database was created there, but other rights and shop administrator Access are separate, unverified controls. Gmail's separate personal Cloudflare account is not the shop destination. `asifhussain60@hotmail.com` is retired and must never be used. The full account rule is in [account ownership](../infra/account-ownership.md).

For a future approved-account backup, the backup helper now omits remote source-count scans of the large postcode reference table. It still restores and checks those exported rows locally and marks their source count as unverified in the manifest. Business-table source counts and schema are compared before and after the export. The full owner-account backup remains pending.

Owner Wix sign-in now works in normal Chrome. Source DNS was captured in `../infra/dns-source-2026-09-26.zone`: 14 service records, plus the old nameservers for rollback reference. Cloudflare now contains all 14 service records as DNS-only; four email/verification CNAMEs omitted by its scan were added and Zoho priorities 10/20/50 verified. Cloudflare assigned `james.ns.cloudflare.com` and `tani.ns.cloudflare.com`, and registrar/Nominet now confirm this delegation. Domain Lock has been restored after the owner-approved temporary unlock; Cloudflare activation is confirmed; both Cloudflare and Google public resolvers now return the new pair. Nominet RDAP confirms 123-Reg as registrar and unsigned delegation. Registrar sign-in and nameserver write access are verified. Rollback and before/after DNS evidence are preserved under infra; all 14 records match, both HTTPS addresses return 200 and Zoho MX records are unchanged. Preserve the Wix-registered redirect domains rocksaltexchange.com and himalayansaltexchange.com before any Wix retirement.

## Business backup and owner additions — 26 September 2026

Private, ignored exports under `../backups/wix/business-2026-09-26/` contain 35 products, 62 variant rows, 148 media rows, 609 order summaries, 770 order-item rows and 4,412 contacts. Order identities match across both order exports. Contacts include email/SMS subscription status. The private manifest records counts and SHA-256 hashes. All 294 source columns and 480,778 cells round-tripped through a separate local archive and disposable restore; this is historical preservation, not approval to merge Wix data into the replacement shop. The historical admin service now requires a separate archive database binding, which production does not have. The public archive captured 56 pages; 142 of 144 referenced originals were recovered and two return access denied. Signed-in Wix checks recorded promotions, zero subscriptions, gift-card setup state, stock timing and checkout toggles. This remains a partial business backup: full Media Manager originals, complete settings and policy versions, independent second-copy recovery and a complete restore rehearsal remain open.

The owner requires matching new-shop fields for all source data. Extend operational schema, validation, imports/exports and admin views where needed; preserve originals and verify field-by-field round-trip coverage. An archive alone does not satisfy operational parity. Historical orders must not replay payments or send receipts. No production import before reconciliation.

The Admin menu must lead to `https://admin.saltylamps.co.uk/admin`, protected by Cloudflare Access using **Sign in with Cloudflare**. Restrict authentication and authorization to intended owners/operators, protect direct URLs and APIs, and prove deployment hostnames cannot bypass access. This is a launch requirement, not a claim that SSO is configured.

Current Wix provider inspection confirms Wix Payments and PayPal active. Wix Payments includes cards, Apple Pay, Google Pay, Clearpay and Klarna; replacement code currently implements Stripe. Owner is unsure whether a Stripe business account exists and reports an existing PayPal business account. Verify PayPal access and compare direct integration against PayPal through eligible UK Stripe; neither route is selected or configured yet. Do not drop existing payment methods without an explicit decision.

Public archive redirect comparison found two uncovered blog URLs: `/post/how-to-choose-the-right-himalayan-salt-lamp-for-your-home` and `/post/rock-salt-lamps-benefits-uses-care-tips-and-plug-in-vs-usb-guide`. Resolve content/redirect destinations before launch.

## Environment boundary

The proposal project and its demo orders stay separate from the owner’s production Pages project, D1 database and R2 bucket. The owner account now has an empty EU-jurisdiction D1 database; its ID is pinned in the production config, but Pages and R2 are not provisioned and no Wix or shop data has been imported. Supply an explicit production account, configuration and scoped token. Never copy the proposal database wholesale into production or replace the production config with the default Wrangler config.

## Production deployment now fails closed

`deploy-production.sh` no longer provisions resources, seeds the catalogue or blindly replays migrations. It first runs `scripts/production-preflight.mjs`, which validates the selected target, reads the hash-verified migration ledger, checks catalogue/foreign keys and verifies resource bindings. It then builds from a fresh production content snapshot and deploys with the selected production configuration. Missing source data is a release failure, never a reason to substitute proposal content.

Use the owner dashboard or a separately reviewed provisioning procedure to create the target resources and configure bindings. Production deployment is intentionally blocked until the schema/import history is proven. Read-only preflight does not establish write rights or provider readiness.

## Rehearse migrations offline

Run `python3 scripts/plan-production-migrations.py --help` for the supported options. Fresh rehearsal uses `--seed --output /tmp/salty-bootstrap-review.sql`; it refuses to overwrite an existing plan. Existing local database exports are opened read-only and copied into memory. Unknown historical migration state requires reconciliation, not automatic adoption.

The checked-in catalogue currently fails the reviewed-media migration guard. Do not disable that guard. A plan with media deferred is useful for rehearsal but cannot pass production preflight. Complete catalogue/image mapping and verify the resulting media assignments before release.

Generated SQL still requires reviewed application to the intended remote target, a private backup, a maintenance window and post-import reconciliation. It is not a promise that remote imports are atomic.

## Required application configuration

- `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`: matching keys from the owner account and intended mode.
- `STRIPE_WEBHOOK_SECRET`: signature secret for that environment’s endpoint.
- `SITE_URL` and `PUBLIC_HOST`: the intended customer origin and host.
- `ADMIN_HOSTS`, `ACCESS_AUD`, `ACCESS_TEAM_DOMAIN`: protected admin configuration. No open-host bypass in production.
- `RESEND_API_KEY`: owner sending account, with a verified domain and reviewed sender/reply-to settings.
- D1 binding `DB` and R2 binding `IMAGES`: the owner resources selected in production configuration.

Never put secrets in this repository or chat. Set them in the platform secret store and redeploy. Register the events used by the current webhook: checkout completion/expiry, asynchronous success/failure, and refund lifecycle changes. Verify embedded-checkout domain registration and live payment methods with the owner.

## Email and costs

The selected Cloudflare tiers are Pages/Workers Free, D1 Free, Zero Trust Free for the two approved users, and R2 Standard's free allowance. Estimated incremental Cloudflare charge is $0/month while usage remains inside those limits. The owner dashboard now shows Zero Trust Free active; its $0/month checkout required agreement to terms and authorization for charges beyond free limits. The administrator Access application is not configured: selecting the exact Emails policy rule crashed the dashboard twice. R2 onboarding separately offers a recurring, usage-billed subscription; its bucket does not yet exist. Keep Resend for customer order emails; Cloudflare outgoing email to arbitrary recipients requires Workers Paid. Free Email Routing forwards incoming mail to a verified inbox, but is not a complete mailbox/reply service. Preserve existing Zoho mail until archives, inbound messages and branded replies have all been tested. See [pricing](docs/pricing.md).

## Launch evidence

Record the candidate release, complete backups and restore, catalogue/stock totals, image coverage, redirect coverage, anonymous/authorized admin checks, desktop/mobile journeys, signed webhook replay, actual provider email, and the owner-authorized low-value live purchase/refund. Skipped or mocked tests do not satisfy live-service gates.

Only after those checks pass should the owner approve customer-domain cutover. Keep Wix available for rollback, freeze changes for the final delta, and reconcile any orders accepted on either system before reopening after a rollback. Cancel Wix or Zoho only under separate owner authorization after stabilization.
