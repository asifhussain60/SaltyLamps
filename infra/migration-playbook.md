# Migration playbook

> **The runbook people actually follow is elsewhere.** The owner-facing, step-by-step
> version lives at `/admin/docs/migration` (`salty-lamps-site/src/admin/docs/MigrationDoc.jsx`),
> mirrored as `salty-lamps-site/docs/migration.md`. This file is the engineer's
> scenario map — which of several possible moves you are making, and what each one
> touches. Keep it; do not follow it instead of the runbook.

Three separate scenarios, because "migrate to a different domain" and "migrate to a different
Stripe account" pull on different threads. Pick the one that applies — most real moves are
Scenario A alone (adding the real domain) or B alone (going from test to live Stripe).

## Scenario A — new custom domain, same Cloudflare account, same Stripe account

This is what's actually planned next for Salty Lamps (Wix → `www.saltylamps.co.uk` on Cloudflare).
D1 and Stripe don't need to change at all.

1. In Cloudflare Pages (`salty-lamps-proposal` project) → **Custom domains** → add the new domain.
2. Update the `SITE_URL` Pages secret to the new domain:
   `wrangler pages secret put SITE_URL --project-name salty-lamps-proposal` → paste the new
   `https://...` URL.
3. In Stripe, edit the existing webhook endpoint's URL (or add a second endpoint pointed at the
   new domain, then delete the old one once cut over) to `https://<new-domain>/api/webhook`. If
   you create a *new* endpoint rather than editing the existing one, it gets a new signing secret
   — update `STRIPE_WEBHOOK_SECRET` to match.
4. Change the build-time site address in **`salty-lamps-site/src/content/site-content.mjs`**
   (`export const siteUrl`). This is easy to miss and nothing fails loudly when it's wrong: it is
   the source of every `<link rel="canonical">`, every `og:url`, all six sitemaps, the
   `Sitemap:` line in `robots.txt`, and the `url` in the schema.org Store block. Leave it stale and
   the new site tells Google it is really the old one.
5. Update the `site_url` setting in Admin → Settings to the new domain — it is the link base for
   emails when `SITE_URL` is unset.
6. Email: the sender domain must be verified with Resend before any customer mail sends. See
   [`email.md`](email.md). Resend's records go on the `send.` subdomain and do **not** replace the
   mailbox provider's SPF on the plain domain — the two coexist.
6b. If the admin is to live on its own hostname, add it as a second custom domain, front it with a
   Cloudflare Access application, and set the `ADMIN_HOSTS` Pages secret. Unset, the admin is
   served on every hostname the project answers on, which is the pre-split behaviour.
7. Redeploy (`./deploy-cloudflare.sh`) — secrets only take effect on a fresh deployment.
8. Repeat the live verification steps in [`stripe.md`](stripe.md#test-mode-verification-performed)
   against the new domain.

## Scenario B — same domain, going from Stripe test mode to Stripe live mode

Test mode and live mode are **entirely separate key/webhook/data spaces** in Stripe — nothing
carries over automatically.

1. Complete Stripe's business verification (bank details, business info) to unlock live mode.
2. Generate a **live-mode** API key. Recommended: build it from the same "One-time payments"
   restricted-key template used for the test-mode `salty-lamps-checkout` key (see
   [`stripe.md`](stripe.md#api-key-in-use)) rather than a full-access standard key — a live key is
   worth being careful with.
3. Register a **new live-mode webhook endpoint** (same URL, `checkout.session.completed` only) —
   it gets its own signing secret, separate from the test-mode one.
4. Update both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` Pages secrets to the live-mode
   values.
5. Redeploy.
6. Place one real, small, real-money order end to end before announcing the store is live.

## Scenario C — genuinely new Cloudflare account (rare — e.g. selling the business)

Everything in [`cloudflare.md`](cloudflare.md) needs recreating from scratch:

1. New Pages project, connected to the same (or forked) GitHub repo.
2. New D1 database: `wrangler d1 create salty-lamps-db`, then apply
   `salty-lamps-site/d1/schema.sql`.
3. Load the catalog. Two options:
   - Fresh from Wix (if Wix is still the source of truth): re-run
     `node scripts/generate-d1-seed.mjs <path-to-catalog_products.csv>` against a new export, then
     apply the resulting `d1/seed.sql`.
   - Carry over the existing D1 data as-is: `wrangler d1 export salty-lamps-db --remote
     --output=backup.sql` from the old account, then execute that file against the new database.
     Watch out for the `order_items.sku_id` foreign-key fragility noted in
     [`known-issues.md`](known-issues.md) if real orders exist by this point.
4. New API tokens in the new account: one Pages Read/Write token, one separate D1 Edit token — do
   not combine them (see [`cloudflare.md`](cloudflare.md#credentials) for why they're kept apart).
   Save both to Keychain under new service names (or wherever the new machine/account's convention
   is), and update `deploy-cloudflare.sh`'s expected Keychain service names to match if you keep
   using that script.
5. Update the hardcoded `database_id` in `salty-lamps-site/wrangler.toml` and in
   `salty-lamps-site/scripts/generate-seo.mjs` (`fetchProductsFromD1`'s `databaseId` constant —
   this is the one place it's hardcoded rather than read from `wrangler.toml`; see
   [`known-issues.md`](known-issues.md)).
6. Set the three Pages secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`).
7. Then follow Scenario A for the domain and, if applicable, Scenario B for going live on Stripe.

## Scenario D — a NEW domain alongside the existing Wix site

The chosen direction as of 2026-08-01. Buy a second domain, host this site on it, leave
`saltylamps.co.uk` and its Wix site completely untouched, and add a redirect from old to new later.

Scenario A is the mechanical checklist; everything below is what is *different* because the old
site stays live.

### Before you start — decide the canonical question

Two live shops serving the same catalogue is the real risk here, and it is not a technical failure
that shows up in a log. Today every built page carries
`<link rel="canonical" href="https://www.saltylamps.co.uk/">` and a `robots.txt` advertising a
sitemap at that domain, because `siteUrl` in `src/content/site-content.mjs` still says so. That
means the new site would launch telling search engines it is really the Wix site.

Pick one deliberately:

- **New domain is the real shop** → set `siteUrl` to the new domain (Scenario A step 4). Accept
  that the two sites now compete until the redirect lands, and land the redirect quickly.
- **Not ready to compete yet** → keep the new site out of the index entirely (`robots.txt`
  `Disallow: /`, or `noindex`) until the redirect is in place. Safer, and reversible in one build.

Leaving it as-is is the one option that is wrong either way.

### Steps

1. Register the domain anywhere, but **point its nameservers at Cloudflare on day one.** This is
   the whole reason this scenario unblocks email: Cloudflare has no trouble with MX records on a
   subdomain, which is exactly what Wix cannot do (see [`email.md`](email.md)).
2. Follow Scenario A steps 1–8 against the new domain.
3. Verify `send.<new-domain>` with Resend, region **Ireland (`eu-west-1`)**, and set Sender Address
   to `orders@send.<new-domain>`. Until this is done the shop is still on the `resend.dev` test
   sender and cannot email anyone but the account owner.
4. Only then consider the redirect from `saltylamps.co.uk`.

### The redirect — unverified, check before relying on it

Wix's redirect tooling handles page-level redirects *within* a Wix site. Redirecting an entire
domain to an external one normally needs registrar or DNS control, which is precisely what this
scenario is avoiding. **This has not been confirmed.** Check what Wix actually permits before
promising anyone the old URLs will forward — if it cannot, the redirect needs the DNS move that
Scenario A describes, and the two scenarios collapse back into one.

### What does NOT need to change

D1, the catalogue, Stripe keys, and the Cloudflare account all stay as they are. The Wix site is
not touched at any point.

## Things that never need to change, in any scenario

- `salty-lamps-site/functions/*` — the Functions code has no hardcoded account/domain identifiers
  except the one noted in Scenario C step 5. **The storefront is not equally clean**:
  `src/content/site-content.mjs` hardcodes `siteUrl` and drives all SEO output from it (Scenario A
  step 4).
- `salty-lamps-site/d1/schema.sql` — the table structure itself is account-independent.
- The cart/checkout flow in `src/App.jsx` — it only ever calls relative paths (`/api/products`,
  `/api/checkout`), never an absolute URL, so it moves with the domain automatically.
