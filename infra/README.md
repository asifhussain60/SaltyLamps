# Salty Lamps infrastructure

This directory documents the Cloudflare and Stripe infrastructure backing
`salty-lamps-site`, in enough detail to migrate the whole stack to a new
domain and/or a new Stripe account without re-deriving anything from scratch.

**No secret values live in this directory, ever — only where each secret is
stored (a Keychain service name, a Cloudflare Pages secret name).** This repo
is public.

## Files

- [`cloudflare.md`](cloudflare.md) — Pages project, D1 database, API tokens, secrets, Functions
- [`stripe.md`](stripe.md) — account, API key, webhook endpoint
- [`email.md`](email.md) — Resend account, why not Cloudflare, current UAT state, what unblocks
  customer email
- [`production-cloudflare.md`](production-cloudflare.md) — the owner’s own account, the domain move off Wix, and the SEO carry-over
- [`migration-playbook.md`](migration-playbook.md) — step-by-step: new domain, new Stripe account, or both
- [`known-issues.md`](known-issues.md) — things to fix before this goes live for real

## The one-paragraph version

The site is a static React/Vite build on **Cloudflare Pages**, with three
**Pages Functions** (`functions/api/products.js`, `checkout.js`, `webhook.js`)
providing a small backend: read the catalog from **Cloudflare D1**
(`salty-lamps-db`), create a **Stripe Checkout** session, and record the paid
order back into D1 via a Stripe webhook. There is no Shopify, no separate
backend server, and — as of this migration — no runtime dependency on Wix.
Wix is still the *source* the catalog was originally imported from (see
`salty-lamps-site/scripts/generate-d1-seed.mjs`), not something the live site
calls.

## Where things live (quick index)

| What | Where |
|---|---|
| Cloudflare account | `Asifhussain60@hotmail.com`, account id `844bc687926c910d5ad9d79c40ad1f2f` |
| Pages project | `salty-lamps-proposal` → https://salty-lamps-proposal.pages.dev |
| D1 database | `salty-lamps-db`, id `e8e40717-628d-481d-9175-e9c473620125` |
| Stripe account | Test mode "New business sandbox", id `acct_1TbPB1FXfoyPTVZN` |
| Email provider | Resend, account `asifhussain60@gmail.com` — see [`email.md`](email.md) |
| Domain registrar | `saltylamps.co.uk` is at **123-Reg**; its nameservers point at **Wix** |
| Deploy script | `salty-lamps-site/deploy-cloudflare.sh` |
| D1 schema | `salty-lamps-site/d1/schema.sql` |
| D1 seed (generated) | `salty-lamps-site/d1/seed.sql`, produced by `salty-lamps-site/scripts/generate-d1-seed.mjs` |
| Backend code | `salty-lamps-site/functions/` |
| Local secrets (gitignored) | `salty-lamps-site/.dev.vars` |
| Cloudflare/Stripe secrets in Keychain | see [`cloudflare.md`](cloudflare.md#credentials) |
