# Owner-account sandbox shop

This is a separate test publication. `test.saltylamps.co.uk` is the private shop;
`salty-lamps-staging.pages.dev` remains a protected staging address, with a
path-specific exception for Stripe's signed sandbox webhook.
`admin.saltylamps.co.uk` is the Access-protected administrator host. Both custom
hostnames use the existing exact owner/operator sign-in policy. The
customer-facing `www.saltylamps.co.uk` holding page and empty production
D1 database remain unchanged until the go-live review.

The staging project is pinned in `wrangler.staging.toml` to the approved owner
account and EU staging D1. It has no R2 binding, `MAIL_DRY_RUN=true`, and
`STRIPE_TEST_ONLY=1`. Use only a separate Stripe **sandbox** restricted key,
`pk_test_` publishable key, and sandbox webhook signing secret. The local rehearsal
key has an IP policy tied to this computer and must not be reused on Cloudflare.

On 27 September the owner created the separate Stripe sandbox access policy
`Salty Lamps Cloudflare sandbox staging`. Dashboard readback showed Advanced
access restricted to Cloudflare ASN 13335, all countries, and denials for
anonymous VPNs, public proxies, residential proxies, and Tor exit nodes.
Default enrollment for future keys is off. The staging restricted key is now
assigned to this policy. A separate temporary owner-account deployment token
was used for the staging publication, and a sandbox webhook destination targets
the staging shop. These credentials are distinct from the local rehearsal key
and future live credentials. Do not use the separate Gmail personal account or
the retired account for deploys.

Before an upload or database write, run `python3.13 scripts/staging-preflight.py`.
`scripts/prepare-staging-bootstrap.py` produces a fresh import outside the repo;
it uses the replacement demo seed and migrations, two sample postcode suggestions,
zero orders, and no Wix archive. Every demo SKU has an undisclosed synthetic
packed weight and the two sample `SW1A` postcodes have a zero-cost rate labelled
"Sandbox test delivery (no fulfilment)". These values are only for test checkout;
they are not approved shipping weights or tariffs. It is only for the new staging D1. Do not apply
it to production. The local Wrangler rehearsal executed all 550 statements.

Build the staged frontend with `VITE_STAGING=1` and content fetched from a local
fixture of the **same** seed. Restore the committed content snapshot after the
build, because it belongs to the general source tree; the generated `dist` keeps
the staged build. Use Wrangler Direct Upload so the `functions` directory is
compiled. Dashboard drag-and-drop does not compile Pages Functions.

The owner-account staging shop is published at the private custom hostname,
and the administrator hostname is attached to the same project behind
Cloudflare Access. Signed-out root, shop, checkout and administrator requests
redirect to sign-in; an approved session loaded the 33-product demo shop and
administrator dashboard. A simulated Stripe payment reached the
staging order list; the resulting email jobs were skipped under dry-run mode.
The signed-out administrator API also redirects to Access sign-in. A revoked-user
check remains open.
The public customer domain still serves the holding page, and Zoho MX records
remain in place. None of this verifies production checkout or customer email.

After publication, verify the owner-account project and D1 binding, test-only
secrets, dry-run mail, fail-closed Function limit behavior, noindex headers,
products and checkout APIs, signed sandbox webhook, zero real-money activity,
the holding page, and the admin hostname's Access sign-in and denied states.
Test payment details must be Stripe's sandbox test values; never use a real card.

Go-live work is separate: owner review of production catalogue/database structure,
remaining media and backup gaps, live Stripe credentials and webhook, actual
customer-email delivery, R2 terms and activation, final Wix reconciliation,
customer-domain switch, and production order/payment/rollback checks. No staging
test proves those gates complete.

## Publishing a reviewed release to the test shop

`deploy-staging.sh` is the one supported way to put a committed release on the
private test shop. It is run by the owner (or the approved Gmail administrator
inside the owner account) after `npx wrangler login`, never with a saved token.
`STAGING_DRY_RUN=1 ./deploy-staging.sh` runs only the offline half: the
fail-closed preflight, a clean-commit check, the test build from the committed
snapshot, and the guarded price correction, with no network use.

A full run then confirms the login can reach the owner account and cannot reach
the retired one, saves a D1 export and Time Travel bookmark, creates the
image-storage tables (`CREATE TABLE IF NOT EXISTS`), applies the price
correction (each `UPDATE` fires only while the price still equals the old demo
value), reads all 43 prices back, and deploys to `salty-lamps-staging`. Every
remote write waits for an explicit `yes`. It cannot address production, DNS,
Access, secrets or R2. Nothing it prints or saves contains a credential.

Its final step lists the checks a machine cannot make for this shop: a real
photo upload, reorder and primary change in the Access-protected admin, and the
same photo and prices in the shop, in Chrome.

`scripts/capture-public-preview.py` re-captures the owner-confirmed public
catalogue read-only, twice per endpoint, into the folder that
`scripts/rehearse-public-catalogue.py` reads. It has been run against a local
server only; run it against the real preview from a machine with network access.
