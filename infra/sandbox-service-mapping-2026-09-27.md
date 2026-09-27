# Sandbox service mapping — 27 September 2026

This is a mapping and evidence checkpoint, not a production launch approval.
The approved shop design is unchanged by this checkpoint. The published test
shop has separate data and provider credentials from the customer site.

| Surface or service | Current mapping | Evidence and boundary |
| --- | --- | --- |
| Customer domain | `www.saltylamps.co.uk` → owner-account holding-only Pages project | Public HTTP 503 holding response rechecked 27 September. Wix remains available for rollback. No replacement checkout at this hostname. |
| Test shop | `salty-lamps-staging.pages.dev` → owner-account staging Pages project | Public HTTP 200 rechecked 27 September. Test build has noindex and sandbox receipt wording. Its demo product data is not the reviewed live catalogue. |
| Test database | Staging Pages `DB` binding → separate EU staging D1 | Demo seed, 35 products, 77 SKUs, sample postcodes, synthetic packed weights and zero-cost test delivery. One simulated paid order was recorded during checkout verification. No Wix archive or production customer import. |
| Production database | Owner-account EU production D1 | Previously verified empty and not targeted by the staging upload or test order. Fresh production readback remains a go-live check. |
| Test administrator | `admin.saltylamps.co.uk` → staging Pages project behind Cloudflare Access | Signed-out admin page and API redirect to Access sign-in; an approved owner-account administrator session opened the dashboard and saw the simulated order. Revoked-user denial remains untested. |
| Stripe test payments | Separate owner sandbox restricted key and publishable key → staging Pages encrypted secrets | Restricted key assigned to the Cloudflare staging access policy. Staging rejects live-mode keys and events. One official test-card checkout succeeded; no real charge or refund occurred. |
| Stripe webhook | Separate owner sandbox destination → staging `/api/webhook` | Seven subscribed test events and a signing secret were configured. The simulated order reached the staging database and administrator view. Provider retry transport and remaining edge cases are open. |
| Customer email on staging | `MAIL_DRY_RUN=true`; no Resend sending key in the staging deployment | The test order's email jobs were skipped. No buyer or owner message was sent. The checkout receipt states that email and fulfilment are off. |
| Existing business mail | Zoho remains the inbound mailbox | Public MX records still resolve to Zoho EU on 27 September. No mailbox switch or cancellation. |
| Future customer email | Owner Resend sending domain is verified; a new sending-only key is restricted to `saltylamps.co.uk` | The key was transferred from the Mac clipboard to a private, Git-ignored file with owner-only permissions, then removed from the clipboard. One approved message to the operator's Gmail test inbox received provider Sent and Delivered events, with usage 1/3,000 monthly and 1/100 daily on the Free plan. The owner supplied a screenshot of that message in the Gmail inbox with the expected sender and body. Reply handling, shop-template delivery to buyer/owner, and bounce/retry checks remain open. The key was not installed in staging or production Pages. |
| Future live payments | Existing owner Stripe live account, separate from sandbox | No live key, live webhook, payment-domain registration or live checkout was connected to the replacement shop. Payment methods and fees still require the owner's decision. |

The staging delivery rate and packed weights are synthetic test data. They must
not be copied to production or treated as approved postage. The owner and
operator still need to review Wix and replacement database structures, current
stock and weights, delivery rules, missing source material, and the final live
mapping before any production import. R2 stays inactive during testing.

No design or layout file was changed in this mapping checkpoint. Prior staging
checkout code changes remain limited to accepting the restricted Stripe test key
and clearly describing a simulated receipt; they are tracked separately from
the live mapping decision.
