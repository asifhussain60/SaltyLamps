# Restore the application on Cloudflare under a new domain

Prepared 30 October 2026 from recovered application commit
`9200ca5a4a86d49e86fe293ed6a0f60bc301e43a`, repository configuration and private
removal records. This is a future restoration runbook, not authorization to deploy,
change accounts, charge a card, send mail or modify an existing domain.

## Current state and boundaries

The three former Pages projects, all three shop databases and both image buckets
were deleted. Cloudflare subsequently returned empty inventories for Pages,
Workers scripts, D1, R2 and KV; its signed-in response stated **Cloudflare Stream
not enabled**. See [the removal record](cloudflare-removal-2026-10-30.md).

GitHub main contains the recovered code and all nine videos. Private database and
uploaded-image backups remain only on Asif's Mac. Hosting configuration files and
older launch instructions remain in Git as history: their resource IDs do not
point to surviving databases. No future deployment may assume they still work.

Use a new domain independently of the existing Wix shop. Do not edit Wix, the old
shop's DNS, mail routing, Stripe/Resend account settings or existing Access policies
as part of preparation. Actual provisioning and launch need a new explicit request.
The approved Cloudflare destination remains the Salty Lamps owner account under
`Saltylamps@hotmail.com`, account `e35d5918c507bc2cf4e920fe38b5e318`, with the
previously verified Gmail administrator. Reverify membership at restoration time.
A different domain does not authorize a different Cloudflare account. A move to a
different account requires a separately approved revision of the ownership guards;
never use the retired proposal account or its credentials.

## Hosting components

| Component | Purpose and restoration requirement |
| --- | --- |
| Cloudflare Pages, Direct Upload | React/Vite storefront and static files; upload from `salty-lamps-site`, with build output `dist` and sibling `functions/` compiled by Wrangler. Do not upload `dist` alone through dashboard drag-and-drop and assume the Functions backend exists. |
| Pages Functions | Public products/content, checkout, Stripe webhook, images and authenticated administrator APIs; root middleware enforces host/environment rules. |
| D1 binding `DB` | Catalogue, inventory, customer/orders, settings, content, reviews, audit and email state. Create a new database and restore the selected private export. |
| R2 binding `IMAGES` | Uploaded product images and the development environment marker. Restore original object keys and metadata, not backup filenames. |
| Cloudflare Access | Separate protected administrator hostname; optionally a second, fully protected development site. JWT issuer/audience must match the configured application. |
| Stripe | Embedded checkout, order verification, refunds and signed webhook reconciliation. Credentials and webhook destination must be configured for the new deployment. |
| Resend | Transactional customer and administrator email; new sending domain verified separately. Does not provide the business mailbox automatically. |
| Static videos | Nine MP4 files are already in Git under `public/media`; Cloudflare Stream is not required. Largest is 17,532,613 bytes, below Pages' currently documented 25 MiB asset limit. Recheck limits at deployment time. |
| Optional address lookup | Ideal Postcodes licensed lookup; manual address entry remains available without its key. Public postcode suggestions use postcodes.io with a D1 fallback. |
| Optional historical archive | Separate D1 binding `WIX_ARCHIVE_DB` only for an explicitly approved offline historical archive. Not required for the shop and not a live Wix connection; leave unbound by default. |

No Supabase, standalone application server, Cloudflare Stream, KV namespace,
Durable Object, Queue or scheduled Worker is required by this restored application.
Durable email state is stored in D1; webhook retries and administrator tools drive
reconciliation. Do not invent a scheduled job as a substitute for checking how
pending checkout/email/refund state is handled in the recovered code.

## Decisions and values to record before provisioning

Use `example.com` below only as a placeholder; it is not a deployment target.

| Decision | Record the future value |
| --- | --- |
| Cloudflare account | Approved owner name, account ID, verified operator and allowed scopes |
| Public shop | `https://www.example.com` or the deliberately chosen apex URL |
| Administrator | Separate `admin.example.com`, serving `/admin` and `/api/admin/*` |
| Development | Optional protected `test.example.com`, separate project/data/bucket |
| Pages names | New production and development project names; use `main` and `develop` respectively |
| Database identity | New name, generated UUID, jurisdiction/location, source backup and restore receipt |
| Storage identity | New production/development bucket names, region/jurisdiction, restored-object manifest |
| Access | Team domain, application audience, exact allowed identities, provider and session duration |
| Payments | Business account owner, live/test mode, enabled methods/currencies, webhook URL/event list/API version |
| Mail | Verified sending domain, sender, public contact, alert recipient, API-key source, mailbox provider |
| Operations | Private backup directory, release/sign-off owner, rollback plan and monitoring recipient |

Historical UUIDs and project names in `wrangler.live.toml`, `wrangler.prod.toml`,
`wrangler.staging.toml` and `wrangler.development.toml` are reference values only.
The new D1 UUID must come from the new database; it cannot be restored from an old ID.

## Build and Pages settings

| Setting | Value or rule |
| --- | --- |
| Source root | `salty-lamps-site/` within this repository |
| Dependencies | `npm ci` using committed `package-lock.json`; preserve versions for the first restore, review upgrades separately |
| Runtime tooling | Supported Node release compatible with Vite/Wrangler; scripts use `import.meta.dirname` (Node 20.11+). Python helpers require Python 3.11+ for `tomllib`. Validate the selected versions before execution. |
| Build | `npm run build`: content snapshot, Vite build, then generated SEO/prerender output |
| Output | `dist` |
| Functions source | `functions/` beside the build directory; deploy using Wrangler from the application root |
| Compatibility | Existing baseline `compatibility_date = "2024-01-01"`, `compatibility_flags = ["nodejs_compat"]`; retain initially and validate before adopting another date |
| Production branch | `main`; Direct Upload, no automatic publishing on GitHub push |
| Development branch | `develop`; a separate project, not a production preview bound to live data |
| Secret scope | Set on the new production project and separately on development as appropriate; preview deployments must never inherit production data/keys accidentally |
| Routes | Keep `public/_routes.json`: all paths invoke Functions except `/assets/*` and `/media/*`; those excluded assets are public. |
| Publication | Upload built files plus compiled Functions with the selected new configuration; confirm deployment metadata, bindings and secret names on Cloudflare afterwards. |

The offline source build can use `CONTENT_SNAPSHOT_SOURCE=committed npm run build`.
That proves source builds, not that restored live data is current. For release,
refresh the snapshot from the selected restored database and review/commit the
result. Production snapshot mode requires `CONTENT_SNAPSHOT_PRODUCTION=1` and
`CONTENT_SNAPSHOT_SOURCE=live`, explicit credentials and a validated target. It must
fail on missing/unreachable data rather than silently use the committed snapshot.

## Runtime bindings and configuration

Create a reviewed new-domain Wrangler configuration rather than executing an old
file with replacements made only in the command line. This illustrative skeleton
is not ready to run; replace every angle-bracket value with a verified destination.

```toml
name = "<new-production-pages-project>"
account_id = "<approved-owner-account-id>"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "<new-production-database-name>"
database_id = "<new-database-uuid>"

[[r2_buckets]]
binding = "IMAGES"
bucket_name = "<new-production-image-bucket>"

[vars]
DEPLOYMENT_ENV = "production"
SITE_URL = "https://www.example.com"
PUBLIC_HOST = "www.example.com"
ADMIN_HOSTS = "admin.example.com"
ACCESS_TEAM_DOMAIN = "<team>.cloudflareaccess.com"
ACCESS_AUD = "<new-admin-application-audience>"
```

| Name | Classification | Required behavior |
| --- | --- | --- |
| `DB` | D1 binding | Exactly the new restored production database |
| `IMAGES` | R2 binding | Exactly the new production bucket |
| `DEPLOYMENT_ENV` | Plain variable | `production` for live, `development` only for isolated development |
| `SITE_URL` | Plain variable | Full canonical HTTPS origin without trailing path/query; controls email links and admin-to-shop navigation; checkout currently derives its return origin from the incoming request |
| `PUBLIC_HOST` | Plain variable | Canonical shop hostname only, no scheme; drives indexing rules |
| `ADMIN_HOSTS` | Plain variable | Exact protected administrator hostname; missing means no deployed admin. Avoid broad wildcard host lists. |
| `ACCESS_TEAM_DOMAIN` | Non-secret configuration | Correct Zero Trust team host used for JWT issuer and signing-key retrieval |
| `ACCESS_AUD` | Non-secret configuration | Audience of the Access application protecting the new admin; not the old value by default |
| `STRIPE_SECRET_KEY` | Encrypted Pages secret | Matching business account; production `sk_live_` or `rk_live_`, development test key only |
| `STRIPE_PUBLISHABLE_KEY` | Stored as Pages secret; publicly usable by Stripe design | Matching `pk_live_`/`pk_test_`; backend supplies it to embedded checkout |
| `STRIPE_WEBHOOK_SECRET` | Encrypted Pages secret | Signing secret for the selected new-domain webhook endpoint/mode |
| `RESEND_API_KEY` | Encrypted Pages secret | Sending key authorized for the chosen new sender domain; do not install on development |
| `IDEAL_POSTCODES_API_KEY` | Optional encrypted secret | Licensed address lookup; absent means unavailable, manual entry remains possible |
| `POSTCODE_SUGGESTIONS_SOURCE` | Optional plain variable | Default uses postcodes.io then local fallback; `local` forces the D1 reference table |
| `STRIPE_TEST_ONLY` | Development only | Exact string `1`; absent in production, not merely `0` |
| `MAIL_DRY_RUN` | Development only | Exact string `true`; absent in production, not merely `false` |
| `DEVELOPMENT_SHARED_HOST` | Development only | Protected development host shared by shop/admin; must match all host checks after adaptation |
| `STAGING_IMAGE_STORAGE` | Historical test feature | Omit in restored production; old D1 image chunks are not a substitute for restoring active R2 objects |
| `DEV_ADMIN_BYPASS`, `ADMIN_OPEN_HOSTS` | Forbidden remotely | Omit from all deployed configurations; local-only bypass is not an Access replacement |
| `WIX_ARCHIVE_DB` | Optional separate binding | Leave absent unless historical archive access is separately approved; never merge archive into `DB` |

Changing a Pages secret/configuration requires a fresh deployment to verify its
runtime effect. The provider inventory contains secret names, not recoverable
secret values. Deleting Pages removed its stored deployment secrets. Re-obtain or
rotate credentials through the approved provider owner and store them privately;
no secret values belong in Git, this document, logs or copied recovery metadata.

Historical `infra/stripe-resend-handoff.md` records a private Resend key-file
location under `backups/private/`, but this fresh clone does not recreate that
ignored file. Its existence, account ownership, validity and new-domain scope must
be verified privately. It is not evidence that credentials are currently available.

## Database restoration and stored business settings

Use the private recovery paths in [the removal record](cloudflare-removal-2026-10-30.md).
The preferred former-live export is:

`/Users/asifhussain/salty-lamps-private/cloudflare-removal-20261030/recovery/salty-lamps-staging-db.sql`

The development export is separate; the reserve `salty-lamps-db.sql` is empty and
cannot restore a shop. The earlier October 10 snapshot is a secondary recovery
source, not automatically the latest backup.

1. Verify the selected SQL checksum against `database-verification.json`, restore
   into a disposable local SQLite database, and run integrity/foreign-key checks.
   Inspect schema, table/row counts and the production migration ledger. Preserve
   source evidence; do not print customer/order rows into logs.
2. Create a new empty D1 database in the approved account. Import the complete
   reviewed export into that database only, using current D1 import guidance.
   Do not run `schema.sql`, seed scripts, catalogue sync or historical migrations
   on top of the restored database. Reconcile any D1 import-format incompatibility
   in a private working copy and repeat the restore checks.
3. Compare restored schema and business-table counts with the local source.
   `production_migration_ledger` records migration identities and checksums; the
   repository contains 18 migration files. Some historical receipts defer media
   changes. Use `scripts/plan-production-migrations.py` offline to understand
   differences, not to replay migrations blindly. `production-preflight.mjs`
   requires every ledger entry applied, while historical live procedures allowed
   a reviewed deferred case: resolve that difference explicitly before picking
   the future release path.
4. Set/review domain and email settings on the isolated restored copy before any
   public release. Preserve order/refund/provider identifiers and idempotency state
   unless a separately reviewed sanitization plan calls for changes.
5. Production must have no `deployment_environment` value of `development`;
   the runtime treats a missing row as production. Development needs exact
   `deployment_environment = development`, test-only credentials and scrubbed
   customer/order/operational data. Never restore the full private export into a
   publicly exposed development fixture.

| Stored setting/content | Review required for a new domain |
| --- | --- |
| `site_url` | New canonical HTTPS origin; environment `SITE_URL` takes precedence for email links, but both should agree |
| `currency` | Preserve and reconcile with business/payment setup; normal settings UI treats it as non-editable, and checkout explicitly uses GBP |
| `email_enabled` | Keep disabled while restoring; enable only after authorized delivery verification |
| `email_from_name`, `email_from_address` | Approved business name and sender on the newly verified sending domain |
| `public_contact_email` | Public customer contact; separate from the private alert recipient |
| `admin_notify_email` | Approved operational alert destination |
| `low_stock_threshold`, `low_stock_alerts_enabled` | Review inventory alert behavior before email is enabled |
| Email templates/content pages/snippets/themes | Check links, sender identity, policies, address, contact details and references to the old domain |
| Catalogue/SKUs/prices/stock/weights/postage rules | Review current business accuracy before accepting payment; backups preserve history, not present-day stock truth |
| Orders/refunds/checkout reservations/email jobs | Review pending operational state before reconnecting webhooks or enabling retries; do not resend historical mail automatically |
| `uk_postcodes` | Restored copy has a small fallback dataset; postcodes.io provides default suggestions. Review address coverage/licensing separately. |

## Restore the 41 uploaded objects and keep the videos

Private removal-time `recovery/images-manifest.json` maps each original bucket/key
to a local `.object` file with byte size and SHA-256. The saved per-bucket JSON
inventories contain the original content types and other metadata. Restore the
27 production objects into the new production bucket and the 14 development
objects into a separate development bucket. Upload with the **original object
key**, correct content type/cache/custom metadata and verified body checksum.
Uploading the hashed backup filename as the key breaks existing database links.

Re-list the destination and compare every key, size and metadata field. Verify
public `/api/images/<key>` URLs against catalogue/gallery references. Do not assume
historical `staging_image_objects` or `staging_image_chunks` tables are the active
image source; production uses R2 via `IMAGES`.

The development bucket contains `_environment/development.json`. The runtime
requires it in development and refuses a production bucket containing that marker.
Its JSON includes `environment: development` and the old bucket name; update the
marker AND the hard-coded expected bucket name in the runtime/release checks if
renaming the development bucket. Never copy it into production.

All nine MP4s are already versioned in `salty-lamps-site/public/media/` and are copied
into the build. Verify file hashes against Git and test playback, mobile loading,
MIME type, range requests and file-size limits. There is no Stream video export to
restore and no requirement to buy a Stream plan. Static media is public by design.

## New-domain DNS, certificates and administrator Access

Add the new domain to the approved account only when provisioning is authorized.
Use the nameservers Cloudflare assigns to the **new** zone, not nameservers copied
from old records. A Pages apex domain requires the zone on Cloudflare; a subdomain
can use external DNS with the Pages-provided CNAME after association in Pages.
Register each hostname in Pages Custom domains first, then follow the actual
provider-generated DNS target and certificate state. DNS alone is not a complete
Pages custom-domain attachment.

| Host/service | Required target and behavior |
| --- | --- |
| `www.example.com` | New production Pages project; active custom domain and valid HTTPS certificate |
| `admin.example.com` | Same production Pages project, separately protected by Access across the entire hostname |
| `example.com` | Deliberate HTTPS redirect to the canonical hostname if `www` is canonical; preserve path/query, avoid loops |
| `test.example.com` | Optional separate development project with full-host Access protection and no indexing |
| Sender DNS | Exact Resend-provided DKIM/SPF/bounce records on the chosen new sending domain; do not copy old values |
| Mailbox DNS | Only the intended new-domain mailbox provider's MX/SPF records; preserve existing-domain Zoho/Wix settings |

Recreate or explicitly review the Access application for the new admin hostname.
Historical Access policies were left untouched by removal and may still reference
the old hosts. Do not edit them incidentally. Record exact approved email identities,
identity provider and session duration (historical evidence used one hour). Never
use an allow-everyone or bypass rule for convenience. Copy the observed new
application audience/team domain into the selected Pages configuration. The app
checks RS256 signature, issuer, audience, expiry and identity; front-door Access
alone does not replace those origin checks.

Test signed-out and approved/denied users, direct `/admin` links, `/api/admin/*`,
expired tokens and Pages aliases. The public host redirects admin-page visitors to
the protected hostname, while admin APIs on the public host should be unavailable.
Protect the *whole* admin host rather than only `/admin`, so API paths cannot sit
outside the Access policy. Validate sign-out and account recovery. Never deploy
`DEV_ADMIN_BYPASS` or assume static asset exclusions are authenticated.

Review new-zone redirects, SSL/TLS, certificate coverage, HTTPS enforcement, cache
rules, WAF/challenges and temporary maintenance rewrites. Never cache administrator,
checkout, webhook or other private responses; preserve middleware no-store headers.
The public payment webhook must be reachable without interactive Access sign-in or
a browser challenge. Checkout currently uses the incoming request origin for its
return URL, rather than `SITE_URL`; ensure payment sessions start only on the chosen
public hostname and explicitly review any Pages-alias checkout exposure. `noindex`
alone does not prevent an alias accepting requests. Scope any future adjustment to the new application's route;
do not weaken unrelated account security. Do not recreate the old temporary
`/going-live` zone rewrite without a deliberate maintenance requirement.

## Stripe and Resend

Configure Stripe in the approved business account with matching secret/publishable
keys. The recovered code pins Stripe API version `2024-06-20`; revalidate event
payload compatibility at setup. For restricted credentials, derive permissions
from customer creation, checkout-session creation/retrieval, payment-intent retrieval and refund
creation/retrieval used by this exact code; do not assume a checkout-only key can
also support refunds. Register new-domain payment-method domains where required
for the enabled wallet/embedded methods. A change of business Stripe account
requires a separate review of historical order/refund identifiers.

Webhook URL: `https://www.example.com/api/webhook`, on the public shop host.
Subscribe to all seven events actually handled by `functions/api/webhook.js`:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `refund.created`
- `refund.updated`
- `refund.failed`

Use the signing secret for that endpoint and mode. Verify the raw-body signature,
retry behavior, duplicate-event idempotency, stock reservation/release, paid order
creation and refund reconciliation. A rejected signature should fail, not create
an order. Do not forward old production events into an unreconciled copy. Never
perform a real purchase/refund without business authorization.

For Resend, verify the new sender domain/subdomain and install a key allowed to
send from it. Add precisely the provider's displayed records; a bounce MX/SPF on a
sending subdomain must not overwrite mailbox-provider records on the root. Review
DMARC and reply routing. Resend sending and business inbox hosting are separate.
Update stored sender/public-contact/alert settings and email template links. Enable
email only after authorized test deliveries show correct sender, branding, logo,
new-domain links, inbox/spam handling and notifications. Development must have
`MAIL_DRY_RUN=true` and no Resend sending key.

## Source and tooling changes required before a different domain works

Changing only `SITE_URL` is insufficient. Make a dedicated change and run affected
unit/host/security tests. The following are concrete known coupling points:

| File or area | What must be reviewed/changed |
| --- | --- |
| `src/content/site-content.mjs` | `siteUrl` controls SEO; review contact/policy copy and business identity |
| `functions/_middleware.js` | Apex/HTTP canonical redirect explicitly names `saltylamps.co.uk` and `www.saltylamps.co.uk`; adapt to the new canonical hosts |
| `functions/lib/development-host.mjs` | Shared test-host predicate explicitly names `test.saltylamps.co.uk`; new development hostname otherwise fails closed |
| `functions/lib/environment-guard.mjs` | Development image marker expects `salty-lamps-development-images`; update if renamed |
| `functions/lib/email-render.mjs` | Visible footer domain text is hard-coded; environment `SITE_URL` alone does not change the label |
| `functions/lib/content-queries.mjs` | Default public contact email names the old domain; change along with database content |
| `functions/lib/launch-review.mjs`, administrator docs and policy content | Historical contact addresses, review steps and old-host links need contextual review, not blind replacement |
| `wrangler.live.toml`, `wrangler.development.toml`, `wrangler.prod.toml`, `wrangler.staging.toml` | Old projects, deleted UUIDs, hostnames, audiences and buckets; replace or add reviewed destination config |
| `scripts/live-preflight.py`, `deploy-live.sh` | Pin the old live project, database, canonical URL, admin hostname and owner account; not a generic new-domain deploy route |
| `scripts/publish-release.py` | Fixed development project, owner account and receipt/sign-off paths; old receipt files cannot approve a new deployment |
| `scripts/development-replica.py`, `scripts/cloudflare-owner.py`, `scripts/snapshot-live.sh` | Review account/resource pins, copy destinations, marker identity and backup tooling before use |
| `scripts/production-target.mjs` | Owner-account guard; parser currently accepts only root/D1/R2 sections and rejects `[vars]`, so it cannot simply consume the illustrated runtime config above |
| `scripts/production-preflight.mjs` | Expects existing Pages bindings/secrets, explicit `PROD_SITE_URL`/`PROD_ADMIN_HOST`, reconciled ledger and safe admin configuration; it does not create resources |
| `deploy-production.sh` | Alternate older route; default `PROD_BRANCH=master` must become reviewed `main`; not interchangeable with the promoted-live route |
| Snapshot/build/live-check/test scripts | Pin old configs/hosts or use old examples; adapt positive AND negative checks to the new destination |
| `public/_redirects`, generated SEO, `index.html`, database content and image URLs | Review old absolute origins and redirect targets; maintain useful same-site legacy paths without redirecting customers back to the old site |
| `tests/playwright.config.js` and specs | New target URLs, test-only fixtures and Access identity requirements; do not point write-capable tests at restored live records |

Search the repository for the old domain, deleted database UUIDs, old project and
bucket names, `ACCESS_AUD`, `ACCESS_TEAM_DOMAIN`, `SITE_URL` and mail addresses.
Separate historical evidence from executable configuration: retain factual old
records, update active runtime/release files and their tests. Do not remove
account protections merely to bypass a failing check.

Choose one reviewed release path after adapting these constraints. For the older
parameterized production path, runner-only variables include `CLOUDFLARE_ACCOUNT_ID`,
`CLOUDFLARE_API_TOKEN`, `PROD_CONFIG`, `PROD_PROJECT`, `PROD_DB_NAME`, `PROD_BUCKET`,
`PROD_BRANCH`, `PROD_SITE_URL`, `PROD_ADMIN_HOST` and matching
`CLOUDFLARE_D1_DATABASE_ID`. Keep those distinct from runtime Pages variables.
`CLOUDFLARE_D1_TOKEN`, if used, must agree with the production token. Actual scoped
operator permissions must cover the selected Pages/D1/R2 operations; create no
account-wide credential as a shortcut. DNS/Access setup can be performed separately
by the owner. Do not use the retired proposal credential helper or
`deploy-cloudflare.sh` (disabled intentionally).

## Restore sequence, acceptance and rollback

| Order | Work and completion evidence |
| --- | --- |
| 1 | Approve destination/domain/owners, choose new resource identities and private recovery input; verify fresh backup hashes and full local restore. |
| 2 | Adapt domain/resource-bound code, configs, tests and backup tooling; commit reviewed changes. No live-provider writes needed for this step. |
| 3 | Provision new isolated projects/database/buckets/Access with explicit authorization; restore data and objects into verified empty destinations. |
| 4 | Reconcile ledger and environment markers, update business/domain content, keep email/payment operations isolated until reviewed. |
| 5 | Configure new custom domains/certificates/Access and approved provider credentials; record secret names privately, not values. |
| 6 | Build from the reviewed restored catalogue, publish the exact immutable candidate and record commit, fingerprint, deployed bindings and destination. GitHub push alone is not deployment evidence. |
| 7 | Walk through desktop/mobile shop, catalogue/gallery/video/image loads, basket, shipping/address and all administrator journeys. Verify unauthorized/alias requests and private-response caching. |
| 8 | Verify provider sandbox checkout, signed webhooks/retries/refunds and email; any real-payment rehearsal needs separate approval. Confirm no historical notifications are replayed. |
| 9 | Approve launch of the exact candidate; remove only deliberately chosen new-site maintenance protections, confirm indexing/canonicals/sitemaps and monitor errors. Leave Wix and its domain untouched. |

Run `npm run test:unit` and an offline build for source changes. The browser suite
is under `tests/`, with its own lockfile and dependencies; some administrator tests
write. Use only a disposable isolated target/approved test identity, never the
private recovery database. Check test service-token identities against application
JWT expectations: the admin middleware needs an identity claim, so a token being
accepted at Access is not proof it works end to end.

Acceptance includes every active migration/state check, restored catalogue/stock
accuracy, all 27 production image objects and nine videos, new-origin SEO/social
metadata/sitemaps, old-domain-free email labels, private administrator access,
valid payment signatures and duplicate/retry handling. `scripts/live-check.mjs`
needs its old-host assumptions adapted before its result is meaningful.

Before each release, preserve a new private SQL export, verified R2 manifest/body
backup, Git source bundle, config/hosting/domain metadata and provider configuration
inventory without secret values. Store fresh deployment receipts outside Git. A
D1 Time Travel bookmark from a deleted database is historical evidence, not a way
to restore the new database; preserve new bookmarks for the newly created D1.

Rollback code to a previously verified candidate only after checking schema
compatibility; never overwrite newly received orders by restoring an older dump.
If operational safety fails, restrict the new shop/disable its checkout through a
reviewed new-site-only change, retain current data and reconciliation evidence,
and repair forward or restore under an explicit recovery plan. Do not repoint or
alter Wix as an automatic rollback action.

## Reference material and unresolved setup work

Source-of-truth code: `functions/_middleware.js`, `functions/api/admin/_middleware.js`,
`functions/lib/environment-guard.mjs`, `functions/lib/development-host.mjs`,
`functions/lib/mailer.mjs`, `functions/api/webhook.js`, `scripts/production-target.mjs`,
`wrangler.live.toml`, `wrangler.development.toml` and the committed package lockfile.

Before future launch, the destination domain, new resource IDs, restored-data
reconciliation, private credential availability, exact Access allowlist, payment
business settings, sender verification, provider quotas/costs and new-domain
release tooling still need to be selected or verified. This documentation does not
claim those steps have been executed. Older provider handovers are historical
pointers and may describe keys/settings that no longer exist.

Provider references checked 30 October 2026; recheck before provisioning:

- [Pages Direct Upload and asset limits](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Pages configuration and bindings](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Pages custom domains and DNS requirements](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [D1 import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Access application JWT audience/issuer](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)
- [Stripe webhook setup and signatures](https://docs.stripe.com/webhooks)
- [Stripe payment-method domain registration](https://support.stripe.com/questions/register-domains-for-payment-methods)
- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
