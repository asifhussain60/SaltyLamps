# Salty Lamps — Production hand-over to the owner

This guide moves the shop from the **dev / UAT** environment (which Asif runs on
his own Cloudflare account at `salty-lamps-proposal.pages.dev`) onto the
**owner's own** Cloudflare account and the **owner's own** Stripe account, so the
owner controls hosting, data, and payments end-to-end.

Nothing here touches the dev environment. Production is a clean, separate stack.

---

## The two environments, side by side

| | Dev / UAT (Asif) | Production (owner) |
|---|---|---|
| Cloudflare account | `Asifhussain60@hotmail.com` | **owner's account** |
| Pages project | `salty-lamps-proposal` | `salty-lamps` (or owner's choice) |
| URL | `salty-lamps-proposal.pages.dev` | owner's domain (e.g. `www.saltylamps.co.uk`) |
| D1 database | `salty-lamps-db` (hotmail) | `salty-lamps-db` (owner's) |
| Orders data | **simulated** demo orders for UAT | **real** customer orders only |
| Stripe | Asif's test keys | **owner's live keys** |

---

## What the owner needs before starting

1. A **Cloudflare account** (free tier is fine to begin).
2. A **Cloudflare API token** on that account with these three permissions:
   `Account › Cloudflare Pages › Edit`, `Account › D1 › Edit`,
   `Account › Workers R2 Storage › Edit`.
3. A **Stripe account** in the owner's name, activated for live payments.

> **Why the owner creates the token and enters the Stripe keys, not Asif:** live
> payment keys and account credentials must only ever be handled by the owner.
> The scripts below never store a key in this repo — every secret is entered
> interactively by the owner and held by Cloudflare.

---

## Step 1 — Provision + deploy the code and catalog

From `salty-lamps-site/`:

```bash
export CLOUDFLARE_API_TOKEN=...          # owner's token (Pages+D1+R2 Edit)
export CLOUDFLARE_ACCOUNT_ID=...         # owner's account id
export PROD_PROJECT=salty-lamps          # or the owner's preferred project name
export PROD_SITE_URL=https://www.saltylamps.co.uk
export SEED_CATALOG=1                     # ONLY on a brand-new empty database

./deploy-production.sh
```

The script will:

1. Create the **D1 database** if it doesn't exist (first run prints a
   `database_id` — paste it into the `[[d1_databases]]` block of `wrangler.toml`
   for the owner's account, then re-run).
2. Apply the **schema + migrations**, and — only when `SEED_CATALOG=1` on an
   empty database — load the **product catalog** (`d1/seed.sql`). It refuses to
   reseed if any orders already exist, so it can never wipe real sales history.
3. Create the **R2 image bucket** (`salty-lamps-images`) for admin-uploaded
   product photos.
4. Build the site and **deploy** it to the owner's Pages project.

No demo/simulated orders are ever loaded into production — that data lives only
in the dev environment.

---

## Step 2 — Attach the owner's live Stripe keys

After the deploy, the script prints these commands. The owner runs them and
pastes each value when prompted:

```bash
npx wrangler pages secret put STRIPE_SECRET_KEY      --project-name salty-lamps
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET  --project-name salty-lamps
npx wrangler pages secret put SITE_URL               --project-name salty-lamps
```

- `STRIPE_SECRET_KEY` — the owner's **live** secret key (`sk_live_…`) from
  Stripe → Developers → API keys.
- `SITE_URL` — the production domain, e.g. `https://www.saltylamps.co.uk`.
- `STRIPE_WEBHOOK_SECRET` — see Step 3.

---

## Step 3 — Point Stripe's webhook at production

In the **owner's** Stripe Dashboard → Developers → Webhooks → Add endpoint:

- Endpoint URL: `https://<owner-domain>/api/webhook`
- Event to send: `checkout.session.completed`

Copy the endpoint's **Signing secret** (`whsec_…`) and set it as
`STRIPE_WEBHOOK_SECRET` (Step 2). This is what lets the site mark orders paid.

---

## Step 4 — Custom domain

In the owner's Cloudflare dashboard → Pages → `salty-lamps` project → Custom
domains → add `www.saltylamps.co.uk` (and the apex if wanted). Cloudflare issues
the certificate automatically. The site's `SITE_URL` secret should match.

---

## Step 5 — Verify before announcing

1. Load the production URL — catalog and images render.
2. Sign into the admin portal (`/admin`) — dashboard shows **zero** orders
   (clean prod), products and stock are correct.
3. Place one real low-value test order end-to-end; confirm it appears in the
   admin Orders list and in the owner's Stripe Dashboard, then refund it.
4. Confirm no `demo_order_` rows exist:
   `wrangler d1 execute salty-lamps-db --remote --command "SELECT COUNT(*) FROM orders WHERE id LIKE 'demo_order_%';"`
   → must return `0`.

---

## About "handing over Stripe"

There are two separate things, and both are owner-driven:

- **Using the owner's own Stripe account (recommended):** the cleanest hand-over.
  The owner creates their own Stripe account and their own live keys, and Steps
  2–3 wire the site to it. Payouts, tax, and liability sit with the owner from
  day one. Nothing of Asif's carries over.
- **Transferring an existing Stripe account:** Stripe does not let you reassign a
  live account's ownership by API. If the shop's Stripe account was opened under
  Asif's details and must become the owner's, that's done in the Stripe
  Dashboard (Settings → Business/Account, and Stripe support for a legal-entity
  change) by the account holder — not something these scripts do.

Asif never enters or transmits live Stripe keys on the owner's behalf; the owner
enters them directly into Cloudflare via the commands above.

---

## Known catalog-update caveat (fix before heavy prod use)

`d1/seed.sql` currently **deletes and reinserts** all products/skus. Because
`skus.id` is autoincrement, re-running it after real orders exist would orphan
`order_items.sku_id`. `deploy-production.sh` guards against this (it refuses to
reseed once orders exist), but for ongoing catalog edits in production, use the
admin portal or a targeted `UPSERT` keyed on `(product_id, sku)` rather than the
full seed file.
