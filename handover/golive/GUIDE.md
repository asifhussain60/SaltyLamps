# Go-live guide: one step at a time

For the agent walking Asif through it (Codex). Follow it in order. `STATE.md` has the facts and the
never-do list. Tags: **[You]** = the agent does it; **[Asif]** = only Asif can (his accounts, his
keys, a dashboard click); **GATE** = stop and get an explicit "yes" in chat before doing it.

Pace: say what the step is in one line, do it, report one line of real output, move on. Stop only at
GATES and at **[Asif]** steps. If a step's check already passes (see the table below), skip it.

## 0. Where are we? [You]

Run `handover/golive/status.sh` from the site folder (or have Asif run it and paste the output). It
only reads. Compare with this table, then start at the first step whose check fails.

| Line in the output | Good looks like | If not, go to |
|---|---|---|
| uncommitted files | 0 | commit or stash first |
| snapshot age | under 20 hours | step 6 refreshes it |
| secret names | `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` | steps 2 to 3 |
| Pages domains | www on `salty-lamps` (before step 9), on `salty-lamps-staging` (after) | step 9 |
| shop database | 0 test orders (`cs_test_`), live orders as expected | stop and report |
| migration log | "Shop database has all 18 migrations (1 deferred)" | apply the missing migration, backup first |

## Phase A: owner prerequisites

### 1. Restore the stock counts [Asif]
The test orders used up real stock. In the admin (Products or Inventory) set the true shelf count for
each option listed in `STATE.md`, especially the three at 0: Fire Bowl lamp, Rock Salt Bricks,
Platters. Success: none of them reads sold out unless it truly is.

### 2. Live Stripe setup [Asif, you coach, one screen at a time]
In **live mode** of the Salty Lamps Ltd Stripe account (not the sandbox toggle):
1. Clear the phone-verification prompt on the Business settings page.
2. Create a restricted key named `salty-lamps-shop-live`. Give it the same permissions as the working
   sandbox key. At minimum: Checkout Sessions write, Customers write, Refunds write, PaymentIntents
   read, plus read on Products, Prices, Shipping rates and Charges. Copy it now; Stripe shows it once.
3. Copy the matching live publishable key (starts `pk_live_`).
4. Developers, Webhooks, add a destination: URL `https://www.saltylamps.co.uk/api/webhook`, events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`, `refund.created`,
   `refund.updated`, `refund.failed`. Reveal and copy its signing secret (starts `whsec_`).
5. Settings, Payment methods: choose methods; decide whether Stripe receipts stay on; check the
   statement name. Add `www.saltylamps.co.uk` as a payment method domain.
Never ask Asif to paste any of these values.

### 3. Install the four secrets [Asif]
Give Asif these one at a time, each in its own block, to run in his terminal from `salty-lamps-site`.
wrangler asks for the value with hidden typing.

```bash
CLOUDFLARE_ACCOUNT_ID=e35d5918c507bc2cf4e920fe38b5e318 npx wrangler pages secret put STRIPE_SECRET_KEY --project-name salty-lamps-staging
```

```bash
CLOUDFLARE_ACCOUNT_ID=e35d5918c507bc2cf4e920fe38b5e318 npx wrangler pages secret put STRIPE_PUBLISHABLE_KEY --project-name salty-lamps-staging
```

```bash
CLOUDFLARE_ACCOUNT_ID=e35d5918c507bc2cf4e920fe38b5e318 npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name salty-lamps-staging
```

The email key is already a private file on this Mac; this feeds it straight in without printing it:

```bash
tr -d '[:space:]' < ../backups/private/resend-owner-transactional-sending.key | CLOUDFLARE_ACCOUNT_ID=e35d5918c507bc2cf4e920fe38b5e318 npx wrangler pages secret put RESEND_API_KEY --project-name salty-lamps-staging
```

Safe to do early: nothing changes for the public or the test shop until the live deploy.
Then [You] check the four **names** with `status.sh`.

### 4. Two quick decisions and one alarm [Asif]
- Notify address for new-order alerts: keep `info@saltylamps.co.uk` or switch to `Saltylamps@hotmail.com`.
- Add a budget alert of about $1 on the Cloudflare R2 page (R2 has no hard spending cap).

## Phase B: the release

### 5. Pre-flight [You]
`git status` clean on this branch, then `LIVE_DRY_RUN=1 ./deploy-live.sh` (offline). It must end with
"Dry run complete". Also run the migration check from `STATE.md`'s tool list, or rely on
`status.sh`. If the snapshot is older than 24 hours, step 6 first.

### 6. Refresh the price snapshot if stale [You]
Only if `status.sh` shows 20+ hours. Asif must say the owner has stopped editing. Then:
`npm run content:refresh-staging` (read-only on the database, in Asif's terminal if needed), review
`git diff --stat src/content`, commit it. Repeat if the owner edits again later.

### 7. GATE G1: live deploy [You, with Asif's yes]
Tell Asif plainly: "After this, the test and admin addresses run in live mode, so any checkout there
charges real money. www still shows the holding page." On his yes:
```bash
./deploy-live.sh
```
It re-checks everything (clean tree, tests, snapshot, owner login, photo bucket, all four secret
names, migration log), saves a database backup and bookmark, and asks for the typed words
`deploy live`. Asif types them. Success: "Published." Then [Asif] in the Pages dashboard
(salty-lamps-staging, Settings, Variables) confirm the variables come from the configuration file
and no `STRIPE_TEST_ONLY`, `MAIL_DRY_RUN` or `STAGING_IMAGE_STORAGE` is listed. Then [You] check one
product photo address returns 200 on the test host.

### 8. Temporary holding rule [Asif, you coach]
Cloudflare dashboard, the saltylamps.co.uk zone, Security, Security rules (custom rules). Create a
rule that, for host `www.saltylamps.co.uk`, **blocks everyone except** Asif's current IP address and
the exact path `/api/webhook` (Stripe must reach that), with a short plain-text maintenance message.
The plan says 503; the dashboard may only allow 4xx for a custom block response. If 503 is not
offered, use 403 with the message. That is acceptable for a window of hours, not days. **Verify it
works before step 9**: open `https://www.saltylamps.co.uk` from a phone on mobile data (not Wi-Fi
at home); it must show the maintenance message, not the shop. If it cannot be made to work, stop and
decide with Asif on a short public window at a quiet hour instead.

### 9. GATE G2: move www to the shop [Asif, with the yes]
Cloudflare dashboard, Workers & Pages:
1. Project `salty-lamps`, Custom domains: remove `www.saltylamps.co.uk`.
2. Project `salty-lamps-staging`, Custom domains: add `www.saltylamps.co.uk`.
3. DNS: the `www` record must be a CNAME to `salty-lamps-staging.pages.dev`, proxied. Accept the
   dashboard's offer to update it.
Wait for the certificate to show active (minutes). [You] check `https://www.saltylamps.co.uk` from
Asif's IP shows the shop and from the phone still shows the maintenance message. Rollback if it
misbehaves: re-add `www` to `salty-lamps` and point the CNAME back to `salty-lamps.pages.dev`.

### 10. Stripe test event [Asif]
Stripe live mode, Developers, Webhooks, the destination, Send test event. Expect HTTP 200 from the
shop. (A test event is ignored by the shop but must be accepted.)

### 11. Email switched on and tested [Asif in the admin, you coach]
Admin (admin.saltylamps.co.uk), Settings: turn customer email on; set the notification address from
step 4; change the stored site address from the test host to `https://www.saltylamps.co.uk`. Then
Emails, Templates: press Test on each of the 11 templates and confirm each reaches the owner inbox,
the sender is `orders@saltylamps.co.uk`, and none lands in spam. The logo may not show while the
holding rule is up; that is cosmetic.

### 12. GATE G3: the real payment test [Asif, you coach]
Say plainly: "This is a real charge on the owner's own card." On the yes, Asif buys the cheapest
in-stock product on `https://www.saltylamps.co.uk` (his IP is allowed through) with his own card and
a delivery address he controls, typing `TEST ORDER - please refund` into the Special instructions
box. Then confirm, quoting evidence: Stripe shows the payment; the order is marked paid in the admin;
stock dropped by one; the buyer confirmation and the owner alert both arrived; the note shows on the
admin order page and in the **owner** email but **not** in the buyer email. Then refund it in full
from the admin order page and confirm the refund in Stripe and the refund email. Put the stock back
by hand. Keep the order (orders are financial records). The card fee stays with Stripe.
If the order does not record (webhook failing), the likely cause is a missing key permission from
step 2; add it in Stripe, Stripe retries the delivery, and the order then records.

### 13. GATE G4: THE FINAL SWITCH [Asif says yes in chat, in that turn]
Everything above passed. Ask: "Shall I open www to the public now?" On his yes, [Asif] deletes the
security rule from step 8 AND disables the temporary URL rewrite named
`Public launch page while shop stays private`. Both must be lifted before visitors
see the shop. See `salty-lamps-site/docs/public-launch-page.md` for the precise
public-page boundary and rollback. Then [You]:
```bash
npm run live:check
```
It must show PASS on every line except the bare-domain line (expected to fail until step 17's
redirect rule exists). Have Asif also open the site from a phone on mobile data. Record go or
no-go. Rollback: re-create the rule, or move www back to `salty-lamps` (step 9 reversed).

## Phase C: after launch

### 14. Back up and remove the test address [Asif, GATE: his yes]
First save a private record in `~/salty-lamps-private/test-host-<date>/` of: the DNS record for
`test`, the Pages custom-domain entry for `test.saltylamps.co.uk`, and the destinations of the
Access application that protects admin and test (screenshots are fine). Then in the dashboard:
1. Workers & Pages, `salty-lamps-staging`, Custom domains: remove `test.saltylamps.co.uk`.
2. DNS: delete the `test` CNAME.
3. Zero Trust, Access, Applications, application `c13f24a5-...`: remove **only** the
   `test.saltylamps.co.uk` destination. Never delete the application: that locks the admin out.
4. Tidy: the sandbox Stripe webhook destination, Access app `78f202fa-...`, the disabled WAF rule.
Then [You]:
```bash
node scripts/live-check.mjs --expect-test-host-gone
```
It also confirms the admin still asks for sign-in. After this no sandbox shop exists; the only
release path is `./deploy-live.sh`.

### 15. Full system check [You]
`npm run live:check` again. Then ask Asif to confirm the spot checks he cares about: one more look at
an admin order, the Stripe dashboard, an email from the shop. Report PASS/FAIL per line.

### 16. SEO [Asif with you]
Per migration step 13: if Wix had a Google Search Console property, export its last 16 months now
(lost when Wix is cancelled). Add a Domain property for `saltylamps.co.uk` by DNS TXT without touching
the Zoho records; submit `https://www.saltylamps.co.uk/sitemap.xml`; inspect and request indexing for
the home page, one product and one category; import into Bing Webmaster Tools. Decide the returns
window wording. Run `npm run live:check` weekly for eight weeks.

### 17. Bare-domain redirect [Asif]
Create the Cloudflare 301 rule from `saltylamps.co.uk` (and `http://www`) to
`https://www.saltylamps.co.uk` preserving path. Needed before Wix is cancelled (migration step 12).
Keep Wix, Zoho and the `salty-lamps` holding project until step 12's monitoring says otherwise.

### 18. Wrap up [You]
Update `salty-lamps-site/src/admin/docs/migration-plan.mjs`, regenerate `docs/migration.md`,
`docs/pricing.md`, run `node --test test/*.test.mjs`, commit with Conventional Commits, push, and
give Asif a short plain recap: what is live, what is still pending, what to watch.

## If something goes wrong

- Payments or orders fail, or pages break, before step 13: re-check the rule, then move www back.
- After step 13: re-create the rule first (instant), then decide. Never roll back to an older Pages
  deployment unless its message reads "live release <sha>". Reconcile every order before reopening.
- Database trouble: `wrangler d1 time-travel restore DB --bookmark=<value>` from the bookmark file
  saved in `~/salty-lamps-private/` by the deploy; ask Asif first.
