# Go-live state (written 2 October 2026, branch `golive`, from commit 754223d)

## Latest status — 3 October 2026

Public shop opened with Asif’s explicit approval and reported confirmation of all owner checks.
The www holding Block and public launch URL rewrite are disabled, with their definitions retained
for rollback. All 11 read-only launch checks pass; an outside-network reader sees the storefront.
Administrator sign-in and the protected test hostname remain in place. Wix and Zoho are retained.
See `infra/public-launch-verification-2026-10-03.json` for current evidence.
The following 2 October sections are historical and must not be treated as current launch blockers.

## What is live and what is not

- **Not live.** www.saltylamps.co.uk still shows the holding page (Pages project `salty-lamps`).
  The shop runs on `test.saltylamps.co.uk` and `admin.saltylamps.co.uk` (Pages project
  `salty-lamps-staging`) in **Stripe sandbox mode**, behind Cloudflare Access.
- Wix and Zoho are untouched and still serve the old shop and mail.

## Done

- Test shop is running the latest code: picture labels removed shop-wide; optional "Special
  instructions" box at checkout, saved with the order, shown to the owner in the admin order page
  and the new-order alert email (not in customer emails).
- Migration 018 (`orders.special_instructions`) applied to the shop database with its log row.
  `deploy-live.sh` now refuses unless the database's migration log matches `d1/migrations`.
- Price snapshot refreshed 2 Oct 2026 (deploy-live refuses one older than 24 hours).
- Sandbox clean-up done: 16 test orders and their records deleted. 0 live orders. Recovery point:
  `~/salty-lamps-private/clear-sandbox-20261002T202201Z` (export + Time Travel bookmark).
- Photo bucket `salty-lamps-images` exists; 13 photos copied in on 30 Sep.
- Offline half of the live release passes (`LIVE_DRY_RUN=1 ./deploy-live.sh`).
- Tools: `npm run live:check` (read-only system + SEO check), `scripts/migration-ledger.mjs`.

## Still to do (this is what the guide walks through)

1. **Owner-only prerequisites:** restore stock counts; live Stripe setup; install four secrets
   (three Stripe + `RESEND_API_KEY`); R2 budget alert; decisions on notify address and methods.
   As of the last check only the three Stripe secret names exist, and the records say they hold
   **sandbox** values. `RESEND_API_KEY` is **not** installed, so the live release refuses.
2. Live deploy, temporary www holding rule, move www, Stripe test event, email setup and tests,
   owner real-payment test and refund, **final switch**, then back up and remove the test address,
   then SEO (Search Console, Bing, bare-domain redirect rule, weekly checks).

## Stock the test orders used up (clean-up never edits stock; the owner restores it in the admin)

Fire Bowl lamp (RSL-B3) now 0, used 9. Himalayan Rock Salt Bricks (ST-842) now 0, used 10. Platters
(SPS-8) now 0, used 19. Also check every option in this list, which shows current count and units
used by paid test orders: RSL-A 8/3, RSL-B 12/1, RSL-BL 29/1, PC2 102/2, RSL-B1 49/0, RSL-F 50/2,
CUL-1000C 91/2, CUL-1000F 91/2, TCB 49/0, TCH 49/2, SW1 10/7. Refunded orders may or may not have
put stock back; the owner knows the true shelf counts.

## Ids (none of these are secrets)

- Owner Cloudflare account `e35d5918c507bc2cf4e920fe38b5e318` (Saltylamps@hotmail.com). Asif signs in
  as `asifhussain60@gmail.com`, an Active admin inside it. Always set
  `CLOUDFLARE_ACCOUNT_ID=e35d5918c507bc2cf4e920fe38b5e318` for remote wrangler commands.
- Pages: live-bound project `salty-lamps-staging` (hosts: test, admin, `salty-lamps-staging.pages.dev`);
  holding project `salty-lamps` (hosts: www, `salty-lamps.pages.dev`). Keep `salty-lamps` unchanged
  for rollback.
- Database `salty-lamps-staging-db` (`981a6d7b-8eb7-4057-8023-d2a4894c21e4`). The empty
  `salty-lamps-db` stays in reserve.
- Stripe live account `acct_1UK2aFHzre0vVbX5` (Salty Lamps Ltd); sandbox `acct_1UK2aVQVtEzHT783`.
- Access application `c13f24a5-4b11-4bcf-9b88-4d34bfab15ee` protects **both** admin and test; its
  audience tag is pinned in `wrangler.live.toml`. Never delete it. Leftover items to tidy after
  launch: Access app `78f202fa-...` (sandbox webhook path bypass), disabled WAF rule
  `111cde5602a241f690d03c48f4441282`, the sandbox Stripe webhook destination.

## Facts that bite

- **Claude's/Codex's sandbox may not reach Cloudflare.** In the previous session remote wrangler
  calls from the agent's own shell failed (API error 7403) while the same command worked in Asif's
  terminal. Plan to have Asif run remote commands and paste back the output.
- The Mac's default `python3` is 3.9. The deploy scripts now pick Python 3.11+ themselves
  (`/opt/homebrew/bin/python3.13` exists).
- Secrets bind at **deploy** time. Installing live Stripe values early is safe: the test shop
  keeps its current behaviour until `deploy-live.sh` runs.
- After the live deploy the shop project runs in live mode, so **any checkout on test or admin
  hosts charges real money** from then on. Only the owner's planned payment test should use it.
- Live checkout uses Stripe API `2024-06-20`; every rehearsal used sandbox `2025-04-30.basil`. The
  first live Checkout Session is proven only by the real-payment test.
- The order-saving step reads related Stripe records, so the live restricted key needs the same
  permissions as the working sandbox key plus read on Products, Prices, Shipping rates, Charges.
  A missing permission shows as a failed webhook; Stripe retries, so the order records once fixed.
- Email is off in the shop settings (`email_enabled=0`); notify address is `info@saltylamps.co.uk`;
  stored `site_url` still names the test host. Turn email on and fix both **before** the payment
  test, or its emails are marked skipped (final; re-send from Admin > Emails activity).
- `npm run live:check`'s bare-domain line fails until the separate Cloudflare redirect rule from
  migration step 12 exists. That is expected.
- Rollback: before www is attached, `STAGING_CODE_ONLY=1 ./deploy-staging.sh` restores the sandbox.
  After www is attached never roll back to an older Pages deployment unless its message reads
  "live release <sha>"; every earlier one is sandbox mode. Otherwise move www back to `salty-lamps`.

## Never

Print or commit secrets. Use the retired Hotmail account. Re-run write scripts against the shop
database. Delete the Access application. Run `deploy-staging.sh` after www is attached. Cancel Wix
or Zoho. Open www to the public without Asif's "yes" in chat.
