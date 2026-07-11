# Salty Lamps — Migration runbook (Wix → Cloudflare + Stripe)

A step-by-step runbook for taking Salty Lamps live: moving off Wix onto the owner's own Cloudflare and Stripe accounts. Follow the phases in order — everything up to the domain switch can be prepared without touching the live Wix shop.

> This page mirrors the in-admin **Documentation → Migration** page. Both render the same diagram from [`diagrams/`](diagrams/).

> **How this fits with the scripts:** the Cloudflare provisioning (database, image storage, deploy) is automated by `deploy-production.sh` and documented in [`PRODUCTION-HANDOVER.md`](../PRODUCTION-HANDOVER.md). This page is the wider human runbook around them — accounts, data, Stripe, and the domain.

![Seven migration phases: Cloudflare account, provision, migrate data, Stripe handoff, domain + email, cutover, decommission Wix.](diagrams/migration-flow.svg)

> ⚠️ **The golden rule:** keep the Wix shop **live and untouched** until the new site is fully tested on the real domain. Don't cancel Wix, delete Wix data, or remove DNS records until the switch is confirmed working. Migration is copy-then-switch, never move-and-hope.

## Before you start — confirm these

- Who is the **new owner** (name, email, business/bank details for Stripe)?
- Is **saltylamps.co.uk registered through Wix**, or bought elsewhere and connected to Wix? (Changes the domain steps.)
- Is there **email on the domain** (e.g. info@saltylamps.co.uk via Wix/Google)? If so, its DNS records must be preserved — this is the #1 thing people break.
- Do you have **login access to Wix** (as domain/account owner) and to the current Stripe account?

## Phase 1 — Set up the owner's Cloudflare account

Create a fresh Cloudflare account in the *owner's* name — production must live on their account, not the developer's.

| Step | Where |
|---|---|
| Sign up (owner's email) | https://dash.cloudflare.com/sign-up |
| Enable R2 (needs a card on file; free tier — see the Pricing page) | Dashboard → R2 Object Storage |
| Note the Account ID (needed by the deploy script) | Dashboard → any domain → right sidebar |

## Phase 2 — Provision the infrastructure (D1, R2, secrets, admin sign-in)

Run `./deploy-production.sh` with the owner's account (see [`PRODUCTION-HANDOVER.md`](../PRODUCTION-HANDOVER.md)). It creates the D1 database, the R2 bucket, applies the schema, seeds the catalogue, and deploys. Then set the admin sign-in and Stripe secrets.

| Item | What / where |
|---|---|
| D1 database | Created by the script; [D1 docs](https://developers.cloudflare.com/d1/) |
| R2 image bucket | Created by the script; [R2 docs](https://developers.cloudflare.com/r2/) |
| Admin sign-in (Cloudflare Access) | Self-hosted Access app over `/admin`; add the owner's email. [Access app guide](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/) · [Zero Trust dashboard](https://one.dash.cloudflare.com) |
| Set secrets `ACCESS_AUD`, `ACCESS_TEAM_DOMAIN` | `wrangler pages secret put` |
| Remove `DEV_ADMIN_BYPASS` | Must NOT exist in production — it opens the admin to anyone |

> ⚠️ **Admin must be locked in production.** The dev/UAT site uses `DEV_ADMIN_BYPASS=1` for open testing. Production must instead use Cloudflare Access with the owner's email. Never carry the bypass into production.

## Phase 3 — Migrate the data from Wix (catalogue, inventory, orders)

Export from Wix as CSV, then load into D1. The catalogue seed process already exists (`scripts/generate-d1-seed.mjs`).

| Data | Export from Wix | Into Cloudflare |
|---|---|---|
| Products & variants | [Export product list](https://support.wix.com/en/article/wix-stores-exporting-your-product-list) | Regenerate `d1/seed.sql`, apply to D1 |
| Inventory / stock levels | Included in the product export (per-SKU quantity) | Loaded with the catalogue; adjust in the admin Inventory page |
| Orders history | [Export orders](https://support.wix.com/en/article/exporting-orders-3126323) (note: times are UTC; one row per order) | Optional — import as historical rows, or start fresh and keep the Wix export as an archive |

> **Decide: import historical orders, or start clean?** Past Wix orders were paid through Wix/its processor, not this Stripe account, so they can't be refunded or fulfilled from the new admin. Common choice: **start orders fresh** and keep the Wix orders CSV as a read-only archive.

## Phase 4 — Hand off the Stripe account to the new owner

Two separate things: (a) transfer *account ownership*, and (b) update the *contact email, business and bank details* so payouts and tax sit with the new owner.

| Task | Where / notes |
|---|---|
| Transfer ownership | Dashboard → Team → add the new owner as **Super Administrator** → their row → **Transfer ownership**. Both parties are notified by email/SMS. [Change the owner](https://support.stripe.com/questions/change-the-owner-of-a-stripe-account) |
| Change the account email | Done as part of / after the ownership transfer |
| Update business + bank details | Settings → Business details & Bank account & payout |
| Legal-entity change (if the business is being sold) | Needs Stripe support / KYC re-verification. [Transfer to a different entity](https://support.stripe.com/questions/transfer-a-stripe-account-to-a-different-entity-due-to-a-business-sale-or-acquisition) |
| Live API keys | New owner creates their **live** secret key and sets `STRIPE_SECRET_KEY` as a Pages secret (they enter it — never share it) |
| Re-point the webhook | Add endpoint `https://www.saltylamps.co.uk/api/webhook` for `checkout.session.completed`; put its signing secret in `STRIPE_WEBHOOK_SECRET` |

## Phase 5 — Move the domain from Wix (the careful part)

> ⚠️ **Inventory the DNS records FIRST.** Before changing anything, write down every current DNS record at Wix — especially **MX** (email), **TXT** (SPF/DKIM/verification), and any subdomains. If you move the domain without recreating these, **email stops working**. This is the most common migration failure.

There are two ways to point the domain at Cloudflare. Pick one:

| Route | What it means | When to use |
|---|---|---|
| **A. Change nameservers** (recommended) | Add the domain to Cloudflare (it gives you 2 nameservers), recreate the DNS records there incl. email, then set those nameservers at Wix. Registration can stay at Wix. [Full setup guide](https://developers.cloudflare.com/dns/zone-setups/full-setup/) | Fastest route to Cloudflare hosting; reversible |
| **B. Transfer the registration** | Move the domain registration out of Wix. [Transfer away from Wix](https://support.wix.com/en/article/transferring-your-wix-domain-away-from-wix-2477749) · [Transfer to Cloudflare](https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/) | Full ownership on Cloudflare; slower (~7 days) |

> ⚠️ **Two UK-specific notes for .co.uk:** (1) Wix issues a transfer authorization (EPP) code when you request it and auto-unlocks the domain — but **.co.uk domains are managed by Nominet and transfer via an "IPS tag" change, not a standard auth code**, so the steps differ from .com. (2) Confirm your chosen registrar supports `.co.uk` before committing to a transfer. If unsure, Route A (nameservers) avoids the transfer entirely.

Then connect the domain to the site: in Cloudflare Pages add the custom domain `www.saltylamps.co.uk` (and the apex). Cloudflare issues the SSL certificate automatically. [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)

## Phase 6 — Cutover & verify

- Lower the domain's DNS **TTL** a day ahead so the switch propagates quickly.
- Flip the nameservers / finish the transfer. Propagation can take minutes to a few hours.
- Confirm the site loads on `www.saltylamps.co.uk` with a valid padlock (SSL).
- Confirm **email still works** (send + receive on the domain).
- Place one **real low-value test order** end-to-end; check it appears in the admin and in the owner's Stripe, then refund it.
- Confirm the admin requires Cloudflare Access sign-in (bypass is gone) and shows **zero** demo orders.
- Set `SITE_URL` to the production domain so Stripe redirects are correct.

## Phase 7 — Decommission Wix

Only after everything above is confirmed working for a few days: cancel the Wix Premium/Store plan and any Wix email add-ons you've replaced. Keep the exported CSVs as an archive. If you used Route A and left the registration at Wix, you can transfer it out later at your leisure.

## What people forget (the checklist)

- ☐ DNS records inventoried before the switch (especially email MX + SPF/DKIM)
- ☐ Cloudflare Access configured; `DEV_ADMIN_BYPASS` removed in production
- ☐ Stripe webhook re-pointed to the production domain
- ☐ `SITE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` set as production secrets
- ☐ Backups taken (Wix CSV exports + a D1 export) before cutover
- ☐ A rollback plan: keep the old Wix nameservers noted so you can switch back if needed
- ☐ Test purchase + refund done on the live domain
- ☐ Wix cancelled *last*, only after days of confirmed operation
