# Salty Lamps infrastructure

This directory documents the Cloudflare and Stripe infrastructure backing
`salty-lamps-site`, in enough detail to migrate the whole stack to a new
domain and/or a new Stripe account without re-deriving anything from scratch.

**Current account rule:** [account-ownership.md](account-ownership.md) is authoritative. `Saltylamps@hotmail.com` is the approved owner account; `asifhussain60@gmail.com` is an Active administrator in it, verified in the owner account's member list and policy. The former `asifhussain60@hotmail.com` account is retired and must never be used. Older proposal instructions below are historical evidence, not a deployment route.

**No secret values live in this directory, ever — only where each secret is
stored (a Keychain service name, a Cloudflare Pages secret name).** This repo
is public.

## Files

- [`account-ownership.md`](account-ownership.md) — approved owner and administrator identities; retired-account prohibition
- [`cloudflare.md`](cloudflare.md) — Pages project, D1 database, API tokens, secrets, Functions
- [`stripe.md`](stripe.md) — account, API key, webhook endpoint
- [`email.md`](email.md) — Resend account, why not Cloudflare, current UAT state, what unblocks
  customer email
- [`production-cloudflare.md`](production-cloudflare.md) — the owner’s own account, the domain move off Wix, and the SEO carry-over
- [`migration-playbook.md`](migration-playbook.md) — step-by-step: new domain, new Stripe account, or both
- [`known-issues.md`](known-issues.md) — things to fix before this goes live for real

## The one-paragraph version

The replacement site is a static React/Vite build intended for **Cloudflare Pages**, with
**Pages Functions** (`functions/api/products.js`, `checkout.js`, `webhook.js`)
providing a small backend: read the catalog from **Cloudflare D1**
(`salty-lamps-db`), create a **Stripe Checkout** session, and record the paid
order back into D1 via a Stripe webhook. There is no Shopify, no separate
backend server. The customer shop is **still live on Wix**; only its DNS authority
has moved to Cloudflare. The replacement has not launched, and its payment,
email and admin paths need production verification.

## Where things live (quick index)

| What | Where |
|---|---|
| Cloudflare production account | `Saltylamps@hotmail.com` owner; `asifhussain60@gmail.com` authorized administrator pending grant verification |
| Retired proposal account | `asifhussain60@hotmail.com` — prohibited; historical records only |
| Pages project | Owner-account production project not provisioned |
| D1 database | Owner-account production database not provisioned |
| Stripe account | Test mode "New business sandbox", id `acct_1TbPB1FXfoyPTVZN` |
| Email provider | Resend, account `asifhussain60@gmail.com` — see [`email.md`](email.md) |
| Domain registrar | `saltylamps.co.uk` is at **123-Reg**; Cloudflare nameservers are active while Wix still serves the shop |
| Deploy script | `salty-lamps-site/deploy-production.sh` is blocked until owner-account resources and launch checks are ready |
| D1 schema | `salty-lamps-site/d1/schema.sql` |
| D1 seed (generated) | `salty-lamps-site/d1/seed.sql`, produced by `salty-lamps-site/scripts/generate-d1-seed.mjs` |
| Backend code | `salty-lamps-site/functions/` |
| Local secrets (gitignored) | `salty-lamps-site/.dev.vars` |
| Cloudflare/Stripe secrets in Keychain | see [`cloudflare.md`](cloudflare.md#credentials) |
