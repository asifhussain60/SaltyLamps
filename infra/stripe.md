# Stripe

## Account

- Currently a **test-mode sandbox account** named "New business sandbox" — not yet a verified real
  business, not yet in live mode. No real payments have ever been processed.
- Account ID (visible in dashboard URLs): `acct_1TbPB1FXfoyPTVZN`
- Dashboard: https://dashboard.stripe.com/acct_1TbPB1FXfoyPTVZN/test/dashboard

## API key in use

The site currently uses a **Standard secret key** (full API access), stored only as the
`STRIPE_SECRET_KEY` Cloudflare Pages secret (see [`cloudflare.md`](cloudflare.md)) and in local
`.dev.vars`. It is never written to this repo.

A narrower **restricted key** also exists in the Stripe dashboard, named `salty-lamps-checkout`,
built from Stripe's "One-time payments" permission template (Checkout Sessions, Products, Prices,
etc. — 30 permissions, all scoped to what a checkout integration actually needs). It was created
but deliberately **not** put into use — the standard key was kept for simplicity while everything
is test-mode only. Before going live, switch `STRIPE_SECRET_KEY` to a live-mode restricted key
instead of a live-mode standard key — a leaked restricted key can't touch refunds, payouts, or
customer data; a leaked standard key can.

## What the code actually calls

- `functions/api/checkout.js` creates a Checkout Session (`stripe.checkout.sessions.create`) in
  `payment` mode, GBP only, UK-only shipping address collection, one line item per cart entry with
  `price_data` built server-side from D1 (never trusts a client-sent price). Product metadata on
  each line (`sku_id`) is how the webhook later maps a paid line back to a specific D1 `skus.id`
  without trusting anything echoed from the client.
- `functions/api/webhook.js` listens for `checkout.session.completed` only. On receipt: verifies
  the signature with `stripe.webhooks.constructEventAsync` (the async variant — required in a
  Cloudflare Worker, which only has Web Crypto, not Node's `crypto`), looks up line items via
  `stripe.checkout.sessions.listLineItems` with `expand: ['data.price.product']`, writes one
  `orders` row and one `order_items` row per line, and decrements `skus.quantity` — but **only**
  for `quantity`-tracked SKUs. Binary in-stock/out-of-stock SKUs are left alone on purpose (see
  the comment in the file for why).

## Webhook endpoint

- Name: `salty-lamps-checkout-webhook`
- Destination ID: `we_1Trm2NFXfoyPTVZNf5PbbqGd`
- Listening to: `checkout.session.completed` (only this one event)
- Endpoint URL: `https://salty-lamps-proposal.pages.dev/api/webhook`
- Status: Active (confirmed in the Stripe dashboard)
- Manage it at: https://dashboard.stripe.com/acct_1TbPB1FXfoyPTVZN/test/workbench/webhooks
- The signing secret it issued is stored as the `STRIPE_WEBHOOK_SECRET` Cloudflare Pages secret
  and in local `.dev.vars` — never in this repo. **Every webhook endpoint gets its own unique
  signing secret** — if you ever add a second endpoint (e.g. for a staging domain), it needs its
  own `STRIPE_WEBHOOK_SECRET`, you cannot reuse this one.

## Test-mode verification performed

- A real Checkout Session was created live against production
  (`https://salty-lamps-proposal.pages.dev/api/checkout`) and the browser genuinely redirected to
  a `checkout.stripe.com` URL with the correct product name and price.
- Out-of-stock and invalid-SKU cart lines were confirmed to return 409/400 with clear messages,
  both locally and against the live endpoint.
- **Not yet verified**: an actual completed test purchase (Stripe test card `4242 4242 4242 4242`)
  confirming the webhook fires and the order lands correctly in D1. This is the one open item —
  see the task list / [`known-issues.md`](known-issues.md).
