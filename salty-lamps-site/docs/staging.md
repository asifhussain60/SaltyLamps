# Owner-account sandbox shop

This is a separate test publication. `salty-lamps-staging.pages.dev` is the shop
preview; `admin.saltylamps.co.uk` is the intended Access-protected administrator
host. The customer-facing `www.saltylamps.co.uk` holding page and empty production
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
Default enrollment for future keys is off. The policy protects **zero keys**
until the staging restricted key is created and explicitly assigned. No
Cloudflare deployment token or staging webhook endpoint has been created yet.
The existing Wrangler OAuth session sees only the separate Gmail personal
account and cannot read the approved owner account; do not use it for deploys.

Before an upload or database write, run `python3.13 scripts/staging-preflight.py`.
`scripts/prepare-staging-bootstrap.py` produces a fresh import outside the repo;
it uses the replacement demo seed and migrations, two sample postcode suggestions,
zero orders, and no Wix archive. It is only for the new staging D1. Do not apply
it to production. The local Wrangler rehearsal executed all 550 statements.

Build the staged frontend with `VITE_STAGING=1` and content fetched from a local
fixture of the **same** seed. Restore the committed content snapshot after the
build, because it belongs to the general source tree; the generated `dist` keeps
the staged build. Use Wrangler Direct Upload so the `functions` directory is
compiled. Dashboard drag-and-drop does not compile Pages Functions.

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
