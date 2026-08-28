# Production Cloudflare — the owner's own account

The plan and the reference for standing Salty Lamps up on the **owner's** Cloudflare
account (`saltylamps@hotmail.com`), moving `saltylamps.co.uk` off Wix DNS, and
verifying a real sending domain with Resend.

This is the **production** counterpart to [`cloudflare.md`](cloudflare.md), which
documents Asif's dev/UAT stack on `Asifhussain60@hotmail.com`. Nothing here touches
that. The two stacks share only source code.

**No secret values in this directory, ever — only where each one lives.** This repo
is public.

Status as of **2026-08-11**: nothing below has been executed. Every DNS figure in §3
was read live from `1.1.1.1` on that date, not copied from an earlier document.

---

## 1. The three accounts, and which is which

Mixing these up is the single easiest way to break something, so they are named
together here once.

| Account | Holds | Role |
|---|---|---|
| `saltylamps@hotmail.com` | *(nothing yet)* | **Target.** The owner's own account — production Pages project, D1, R2, and the `saltylamps.co.uk` zone |
| `Asifhussain60@hotmail.com` | `salty-lamps-proposal` Pages, `salty-lamps-db` D1 | Dev/UAT. Stays exactly as it is |
| `asifhussain60@gmail.com` | `safinaverse.com` zone, Podcast Factory Worker | Unrelated. Nothing Salty Lamps may ever deploy here |

The global deploy helper `~/PROJECTS/cloudflare-safina/cf-deploy.sh` is bound to the
**gmail** account and hard-aborts on any other. It is the wrong tool for this work.
The right tool is already in the repo: `salty-lamps-site/deploy-production.sh`, which
hardcodes no credentials and takes the account id and token from the environment.

## 2. What gets provisioned on the owner's account

The shape mirrors what the Podcast Factory Library runs on the gmail account — D1 for
records, R2 for media, one custom domain, secrets held by Cloudflare — with one
structural difference worth knowing before reading anything across: **Podcast Factory
is a Worker; Salty Lamps is Cloudflare Pages.** Pages supports a strict subset of
bindings, which is why the shop cannot use the Workers `send_email` binding and needs
Resend (settled in [`email.md`](email.md), not to be re-opened).

| Resource | Name | Binding | Notes |
|---|---|---|---|
| Pages project | `salty-lamps` | — | Production build output `dist`, branch `master` |
| D1 database | `salty-lamps-db` | `DB` | Fresh and empty; catalogue seeded once, **never** demo orders |
| R2 bucket | `salty-lamps-images` | `IMAGES` | Admin-uploaded product photos, served at `/api/images/<key>` |
| Zone | `saltylamps.co.uk` | — | Moved from Wix nameservers, see §3 |
| Custom domain | `admin.saltylamps.co.uk` | — | Second custom domain on the SAME Pages project. Cloudflare Access fronts the whole hostname; `ADMIN_HOSTS` makes `/admin` and `/api/admin/*` answer there and 404 everywhere else. Unset, the admin is served everywhere, exactly as before the split existed — so the code ships safely ahead of the cutover |

R2 needs a **one-time account opt-in** in the dashboard before any bucket can be
created; without it every create is refused with error `10042`. This caught the gmail
account out on 2026-08-03 and will catch this one too.

### The API token

One token on the owner's account with exactly three permissions:
`Account › Cloudflare Pages › Edit`, `Account › D1 › Edit`,
`Account › Workers R2 Storage › Edit` — which is what `deploy-production.sh`
requires. Add `Zone › DNS › Edit` on `saltylamps.co.uk` only if DNS is to be managed
by script rather than by hand; Pages custom domains create their own records without
it.

The owner creates this token. It is stored in the macOS Keychain by the owner, never
pasted into chat and never committed:

```bash
security add-generic-password -U -a "$USER" -s saltylamps_prod_cloudflare_token -w
```

The command prompts for the value, so it never enters shell history. Read it back
only into an environment variable, stripping the trailing newline that otherwise
produces API error `6111 Invalid format for Authorization header`:

```bash
export CLOUDFLARE_API_TOKEN="$(security find-generic-password -s saltylamps_prod_cloudflare_token -w | tr -d '[:space:]')"
```

---

## 3. The domain move — what is actually on `saltylamps.co.uk` today

The domain is **registered at 123-Reg**; Wix only supplies the nameservers. The
nameserver change is made in the 123-Reg control panel and needs nothing from Wix.

Read live on 2026-08-11:

| Name | Type | Value | What it serves |
|---|---|---|---|
| `saltylamps.co.uk` | NS | `ns4.wixdns.net`, `ns5.wixdns.net` | The whole zone. **This is what changes** |
| `saltylamps.co.uk` | A | `185.230.63.107`, `.171`, `.186` | The live Wix site at the apex |
| `www.saltylamps.co.uk` | CNAME | `cdn1.wixdns.net` | The live Wix site at www |
| `saltylamps.co.uk` | MX | `mx.zoho.eu` (10), `mx2.zoho.eu` (20), `mx3.zoho.eu` (50) | **The owner's mailbox.** Breaking these loses inbound mail |
| `_dmarc.saltylamps.co.uk` | CNAME | `_dmarc.wixemails.com` → `v=DMARC1; p=none` | Wix's DMARC, monitoring only |
| `saltylamps.co.uk` | TXT | *(none)* | **There is no SPF record on this domain at all** |
| — | CAA | *(none)* | No certificate-authority restriction, so nothing blocks Cloudflare issuing one |

Two findings worth acting on rather than filing:

- **No SPF record exists.** Any mail the domain sends today is unauthenticated. This
  is not a new problem the migration creates, but Resend verification is the natural
  moment to fix it.
  **Corrected 2026-08-28:** an earlier version of this note said the root SPF record
  had to list Zoho *and* Resend together. That is wrong for this setup and acting on
  it would break the mailbox's own authentication. Resend places its SPF, DKIM and
  bounce MX on the **`send.` subdomain**; the mailbox provider's SPF belongs on the
  plain domain. They are separate records in separate places and neither replaces the
  other. Verify the exact names Resend shows in its dashboard rather than assuming —
  it can place records at the root depending on how the domain was added.
- **DMARC is Wix's, by CNAME.** Once the zone leaves Wix that CNAME still resolves,
  but it is Wix's policy on the owner's domain. Replace it with the domain's own
  record during the move.

### The safe cutover order

The point of this order is that **the Wix site and the Zoho mailbox never go dark**,
and every step before the last is reversible by putting the old nameservers back.

1. **Add `saltylamps.co.uk` as a zone** on the owner's Cloudflare account. Cloudflare
   scans the existing DNS and imports what it finds.
2. **Check the imported records against the table above, by hand.** A scan is not a
   guarantee — the three MX rows and their priorities are the ones that must be exact.
   Wix's own A/CNAME records are kept as-is at this stage on purpose: they are what
   keeps the old shop serving.
3. **Change the nameservers at 123-Reg** to the pair Cloudflare assigns. Propagation
   is usually under an hour. Nothing visible changes: the same records now answer from
   Cloudflare instead of Wix.
4. **Confirm the old site and mail still work** before going further. Load
   `www.saltylamps.co.uk`, and send a message *to* the Zoho mailbox and read it.
5. **Verify the Resend sending domain** (§4). This is the step Wix made impossible,
   and it is now unblocked — Cloudflare has no trouble with an MX record on a
   subdomain.
6. **Provision and deploy production** (§5) — still on `salty-lamps.pages.dev`, not
   on the real domain. Test the whole shop there.
7. **Only then attach the custom domain** to the Pages project, which repoints `www`
   and the apex away from Wix. This is the one irreversible-feeling step, and by this
   point everything behind it has already been proven.

The Wix site becomes unreachable at step 7 and not before. Whether it should be kept
alive somewhere is an open decision, not a technical one.

---

## 4. Resend — the sending domain

The account and the code are already in place; see [`email.md`](email.md) for what
`mailer.mjs` does and why Cloudflare cannot send this mail itself. What was blocked is
purely DNS, and step 3 above unblocks it.

- **Region: Ireland (`eu-west-1`).** UK business, UK/EU customers, mailbox already in
  Zoho's EU region. Changing region later means deleting the domain and redoing DNS,
  so it is chosen once, deliberately.
- **Verify the domain, and expect records on `send.saltylamps.co.uk`** — Resend puts
  an MX there for bounce handling plus DKIM. This subdomain MX is exactly what Wix
  could not do.
- **Sender address `orders@send.saltylamps.co.uk`**, set in Admin → Settings. Add
  `saltylamps.co.uk` as the domain in Resend and let it create the `send.` subdomain
  itself — adding `send.saltylamps.co.uk` as the domain produces
  `send.send.saltylamps.co.uk` and verifies nothing.
- **The two SPF records are separate, and that is not a compromise.** Resend's SPF,
  DKIM and bounce MX go on `send.saltylamps.co.uk`; the mailbox provider's SPF goes on
  the plain domain. Adding the shop's does not disturb the mailbox's, and merging them
  into one root record — which an earlier version of this file recommended — would.
- A domain was added to Resend on 2026-08-01 and hit the Wix wall. If it is still
  listed unverified at <https://resend.com/domains>, **delete it before re-adding** so
  a stale entry doesn't confuse the attempt.

Until a domain is verified the shop stays on Resend's `resend.dev` test sender, which
delivers only to the Resend account's own address — admin alerts work, customer email
does not.

---

## 5. Provisioning and deploying

Already scripted. From `salty-lamps-site/`, with the owner's token exported (§2):

```bash
export CLOUDFLARE_ACCOUNT_ID=...          # owner's account id
export PROD_PROJECT=salty-lamps
export PROD_SITE_URL=https://www.saltylamps.co.uk
export SEED_CATALOG=1                     # ONLY on a brand-new empty database
./deploy-production.sh
```

It creates the D1 database, applies schema and migrations, seeds the catalogue only
when the database has no orders, creates the R2 bucket, builds, and deploys. Re-running
is safe; the one destructive step is opt-in and refuses to run once orders exist.

The first run stops after creating D1 and prints a `database_id` that has to be written
into `wrangler.prod.toml` before the deploy step can bind it. **That id is different from
the dev one, which lives in `wrangler.toml`** — the two accounts each have their own
config file precisely so this can never be pasted into the wrong one.

Then, entered by the owner and never by anyone else:

```bash
npx wrangler pages secret put STRIPE_SECRET_KEY      --project-name salty-lamps
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET  --project-name salty-lamps
npx wrangler pages secret put SITE_URL               --project-name salty-lamps
npx wrangler pages secret put RESEND_API_KEY         --project-name salty-lamps
```

**Pages binds secrets at deploy time.** Setting a secret does nothing to the running
deployment until you redeploy. This has already bitten this project once.

The remaining Stripe steps — live keys, the UK-registered account requirement, and the
webhook endpoint — are in
[`../salty-lamps-site/PRODUCTION-HANDOVER.md`](../salty-lamps-site/PRODUCTION-HANDOVER.md)
and are unchanged by any of the above.

### The one build-time value that must not be forgotten

`salty-lamps-site/src/content/site-content.mjs` exports `siteUrl`, and it is the source
of every canonical link, every `og:url`, all six sitemaps, the `Sitemap:` line in
`robots.txt`, and the schema.org Store block. Nothing fails loudly when it is wrong.
It already says `https://www.saltylamps.co.uk`, which is correct for production and
was misleading on the dev site — verify it rather than assume it.

---

## 6. Decisions taken, 2026-08-11

| Question | Decision | Consequence worth remembering |
|---|---|---|
| The Wix site | **Retired at cutover** | §7 becomes the point of no return; nothing else changes |
| The Zoho mailbox | **Replaced by Cloudflare Email Routing** | Forwarding, not a mailbox — see below |
| Resend account | **New, owned by `saltylamps@hotmail.com`** | Asif's gmail Resend account is not carried over |
| Stripe live keys | **Before the cutover**, tested on `pages.dev` | The webhook endpoint is configured twice |

**Email Routing forwards; it does not host a mailbox.** Inbound mail lands in a
destination account that must be verified by clicking a link Cloudflare sends. The
Zoho archive stays behind in Zoho, and sending *as* `info@saltylamps.co.uk` needs a
"send as" configuration in the destination mailbox — it is not automatic. Keep Zoho
paid and live until forwarding is proven, and export the archive before cancelling.

**Stripe before the cutover** means the webhook is registered against
`salty-lamps.pages.dev` first and repointed at the real domain at step 7. Editing the
existing endpoint's URL keeps its signing secret; creating a second endpoint issues a
new one, which means updating `STRIPE_WEBHOOK_SECRET` and redeploying.

---

## 7. Search visibility — what was found and what was done

The on-page SEO in `scripts/generate-seo.mjs` was already thorough: prerendered HTML
per route with canonical, robots, Open Graph, Twitter cards and JSON-LD, plus six
sitemaps. Two real gaps were found and closed on 2026-08-11.

### The Wix site's rankings were about to be thrown away

The live Wix sitemap listed **54 indexed URLs**. Only 17 exist unchanged on the new
site, because the new shop publishes one page per **variant** where Wix published one
page per **product** — every salt lamp, every salt lick and every bulb has a different
address now. `public/_redirects` carried four legacy rules; **37 indexed URLs would
have returned 404** the moment DNS moved.

One of those four rules was itself broken: `/product-page/tequilla-shot-glass` 301'd
to `/product-page/tequila-shot-glass`, a slug this site has never built — a redirect
straight into a 404.

`public/_redirects` now carries 38 rules covering every one of them. Both directions
are checked mechanically rather than by eye: every redirect target resolves to a real
route in the built sitemaps, and every old URL is either unchanged or redirected.

**The Wix site had a blog** — two posts and a category — which this site has no
equivalent for. Those three URLs currently redirect to the category each post is
about. Reinstating the posts as real content would recover more than a redirect can;
that is an open decision, not a defect.

### Breadcrumbs were missing

`BreadcrumbList` structured data is what turns a search result's grey URL line into a
clickable trail. It is now emitted on 95 of the 103 built pages — skipped on the
homepage and on top-level pages where a Home › Self trail would say nothing.

The taxonomy's `all-products` category had to be excluded explicitly when choosing a
product's parent crumb: every product belongs to it, so it won on every page, and
`categoryRoutes` deliberately never builds `/category/all-products`. Left in, every
product page would have carried a breadcrumb pointing at a 404, which Google reports
as an invalid-structured-data error for the whole page.

### Page weight, fixed 2026-08-11

Image weight dominates Largest Contentful Paint, which is a direct ranking signal and,
on a phone on mobile data, the difference between a sale and a bounce. The catalogue
carried 81.5 MB of images because photographs had been saved as PNG at full Wix
resolution.

`npm run media:optimise` re-encodes them in place — **81.5 MB → 23.2 MB, and the
homepage from 12.9 MB of images to 3.9 MB.** No filename changes, so nothing that
references an image had to know it ran. Full reasoning in `known-issues.md` §3, which
also records the two remaining opportunities: 71 MB of video, and ~32 MB of images
nothing references but which deploy anyway.

### Still outstanding

- **No search-engine registration exists at all** — Google Search Console, Bing
  Webmaster Tools, the Google Business Profile for the Stoke-on-Trent address, and a
  Merchant Center assessment. All of these need the domain on Cloudflare first, and
  all are owner-account actions.
