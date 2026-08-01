# Transactional email (Resend)

Everything the shop sends — order confirmations, despatch notices, and the admin alerts for new
orders, enquiries, refund requests and low stock. One provider, called from one place:
`salty-lamps-site/functions/lib/mailer.mjs`.

**No secret values in this file** — only where each one lives. See [`README.md`](README.md).

## Why not Cloudflare

Asked and answered on 2026-08-01, so it doesn't get re-opened. Cloudflare cannot send this shop's
email, for two independent reasons:

- **Email Routing is a receiving product.** It forwards inbound mail to a mailbox elsewhere.
- **The Workers `send_email` binding only delivers to pre-verified destination addresses**
  (`E_RECIPIENT_NOT_ALLOWED` otherwise). Order confirmations go to customers nobody has verified in
  advance, so it is structurally unusable for a shop. Admin-only alerts would work; the customer
  half, which is most of the system, would not.
- **And it isn't available here anyway** — that binding is a Workers feature, and this site runs on
  Cloudflare **Pages**, which supports only a subset of bindings. Email Routing is not among them.

Cloudflare's role is holding the API key as a Pages secret. That is all.

## Account and credentials

| What | Where |
|---|---|
| Resend account | `asifhussain60@gmail.com` |
| API key | Cloudflare Pages secret `RESEND_API_KEY` (set 2026-08-01). Also needed in `salty-lamps-site/.dev.vars` for local sends |
| Dashboard | https://resend.com/domains · https://resend.com/logs |

Pages binds secrets at deploy time — **setting the key does not affect the running deployment until
you redeploy**. Same trap as `STRIPE_WEBHOOK_SECRET`; see [`cloudflare.md`](cloudflare.md).

## Current state (UAT, 2026-08-01)

Sending is **on**, using Resend's shared test sender:

| Setting | Value | Why |
|---|---|---|
| Send transactional email | On | |
| Sender address | `onboarding@resend.dev` | No domain is verified yet, so the shop's own address cannot be used |
| Sender name | `Salty Lamps` | |
| Admin notification address | `asifhussain60@gmail.com` | Also the Resend account address, which is what makes the test sender work |

**What this configuration can and cannot do.** Per Resend's documentation, the `resend.dev` test
sender only delivers to the address on the Resend account — every other recipient is refused with a
403 directing you to verify a domain. Resend's own simulator addresses (`delivered@resend.dev`,
`bounced@resend.dev`) are also accepted; that exemption is not a general one and should not be read
as evidence that arbitrary recipients work.

In practice on UAT:

- **Admin alerts work fully** — new order, enquiry, refund request and low stock all go to the
  account address.
- **Customer emails work only when the customer is you.** A test order placed with
  `asifhussain60@gmail.com` gets its full journey. A real customer address will fail and be logged
  in Emails → Activity as `failed`.

This is a deliberate, reversible UAT state. Changing the sender address back is one field in
Admin → Settings.

## What has to happen before customer email works

A verified sending domain. This is blocked today, and the reason matters:

`saltylamps.co.uk` uses **Wix nameservers** (`ns4.wixdns.net`, `ns5.wixdns.net`), and **Wix cannot
create MX records on subdomains**. Resend places an MX record on `send.<domain>` for bounce
handling regardless of whether you add the root domain or a subdomain, so the Wix limitation blocks
both routes. Resend's own dashboard detects this and refuses to proceed.

Note the domain is *registered* at **123-Reg**, not Wix — Wix only provides the nameservers, so a
nameserver change is made in the 123-Reg control panel and needs nothing from Wix.

A domain was added to Resend on 2026-08-01 and hit exactly this wall. If it is still listed at
https://resend.com/domains in an unverified state, delete it before re-adding, so a stale entry
doesn't confuse a later attempt.

**Two ways out**, both covered in [`migration-playbook.md`](migration-playbook.md):

1. Move `saltylamps.co.uk` DNS to Cloudflare (Scenario A). Deferred — the live Wix site and the
   Zoho mailbox both depend on that DNS.
2. Use a **new domain** whose DNS is on Cloudflare from day one (Scenario D). This is the chosen
   direction as of 2026-08-01.

When a domain is finally verified, pick **Ireland (`eu-west-1`)** as the Resend region — UK
business, UK/EU customers, and the existing mailbox is already in Zoho's EU region. The region can
be changed later only by deleting and re-adding the domain plus redoing DNS, so choose deliberately.

## What the code does

- `functions/lib/mailer.mjs` — the only place that talks to Resend. One HTTP call in `sendMail()`
  to `https://api.resend.com/emails`. Swapping providers means rewriting that one function.
- `sendTemplated()` **never throws.** An email may never break a business transaction — a send is
  always made *after* the write it accompanies has committed, and every outcome is recorded in
  `email_outbox` rather than propagated.
- Statuses are `sent`, `failed` and `skipped`. **`skipped` is not a failure** — it means the send
  was deliberately suppressed (sending switched off, template paused, no recipient, no API key, or
  `MAIL_DRY_RUN`). A quiet UAT environment must not read as an outage.
- There is **no automatic retry** — Pages has no scheduler. Anything that failed is resent by hand
  from Emails → Activity.
- Wording lives in the `email_templates` table and is admin-editable; layout and markup live in
  `functions/lib/email-render.mjs` and are not. A copy edit must never be able to break rendering in
  someone's mail client.

## Settings that drive it

All in Admin → Settings, whitelisted in `functions/lib/validation.mjs` (`SETTING_SPECS`):

| Setting | Notes |
|---|---|
| `email_enabled` | Master switch. Test sends deliberately bypass it |
| `email_from_name` | Interpolated into `From: <name> <address>`; rejects `< > " , ; :` and line breaks, which would malform the header |
| `email_from_address` | Must be on the verified domain, or every send fails |
| `admin_notify_email` | Where all admin alerts go — **and** the address the shop publishes on the storefront, via `contactEmail` in `/api/content` |
| `low_stock_alerts_enabled` | Feature toggle. Off means no alerts and no log rows; a *missing address* is a fault and is logged |
| `site_url` | Link base for every email. Must be an absolute `http(s)` URL — a bare domain breaks every link and the logo |

`MAIL_DRY_RUN` (local only, in `.dev.vars`) renders and logs every send without handing it to the
provider. Remove it to send for real from a local run.
