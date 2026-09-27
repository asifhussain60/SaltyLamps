# Salty Lamps payment decision and administrator handoff

Reviewed 27 September 2026. Live and sandbox Payments and Payouts are active; core local sandbox tests pass. Production connection and remaining launch checks are outstanding.

## Preferred route and present evidence

Preferred, conditional decision: leave Wix using Stripe for cards and eligible wallets, plus the existing Salty Lamps business PayPal account. First assess PayPal through Stripe; use direct PayPal alongside Stripe if eligibility, access or commercial terms make that necessary. The preference is recorded. The owner sandbox is connected to a disposable local fixture and core card/payment lifecycle checks have passed; production remains unconnected.

The retained Wix business has Wix Payments and PayPal configured; the public site currently shows a holding page. Replacement code implements Stripe. The signed-in Stripe dashboard verifies a Salty Lamps Ltd. account owned by saltylamps@hotmail.com, with a separate sandbox. Following owner setup, the live account status now shows Payments and Payouts Active with no active account tasks. This verifies live account capabilities. The later local sandbox rehearsal is recorded separately and does not prove production readiness. A separate administrator controls the existing PayPal business account. Preserve the current Wix connections throughout preparation.

The earlier onboarding state, including its Individual / Sole Trader selection, remains historical evidence in `infra/stripe-owner-readiness-2026-09-27.json`; the later live-account check is recorded separately in `infra/stripe-live-follow-up-2026-09-27.json`. The current legal business type and settlement-bank details were not independently read back. The live payment-method settings show cards, Apple Pay and Klarna enabled, while Google Pay, PayPal and Afterpay / Clearpay are disabled. No live payment-method domain or webhook destination is listed. The account status also lists Cartes Bancaires as Paused, distinct from the active Payments capability.

Following the owner’s completion report, live and owner sandbox Payments and Payouts are Active with no active tasks. Owner sandbox connection is now verified in a disposable local fixture. Actual embedded checkout passed decline, success, failed and successful 3D Secure authentication, signed provider webhook delivery, local duplicate replay, partial/full refund reconciliation and expired-reservation release. Across both local rehearsals, four simulated GBP orders were created. Further refund cases verified pending-to-succeeded and succeeded-to-failed provider transitions. The latter revealed and fixed a defect that left the local order marked refunded after the provider failed; it now shows paid, failed refund and zero returned money. Duplicate and older succeeded payloads replayed locally cannot reverse that result. All eleven email jobs were skipped; no real mail was sent. See `infra/stripe-refund-edge-rehearsal-2026-09-27.json`. Asif explicitly requires sandbox-only testing: no live charges or refunds are authorized. Production connection, remaining provider edge cases, payment-method parity and live validation remain pending. See `infra/stripe-sandbox-rehearsal-2026-09-27.json`. Existing test keys were saved after explicit approval with private local permissions; account match and GBP currency were verified by the Stripe API. Historical proposal credentials remain excluded. The saved sandbox policy restricts the existing test key to the current local public IPv4 address, with new-key default off. The persisted policy and checkbox were read back and an allowed-network API request succeeded; denied-network enforcement is not yet tested. This local policy is not a Cloudflare production egress policy. The earlier method/domain inventory remains dated evidence; no dashboard webhook destination was created. The official Stripe CLI forwarded actual events locally. No live payment or PayPal connection was changed.

## What the Stripe owner must establish before the PayPal handoff

The Salty Lamps Stripe account and its owner are identified, and live Payments and Payouts are active. Record owner confirmation of the legal business type and settlement bank, then confirm GBP processing and refund/dispute responsibilities before live shop connection. Do not substitute a developer or proposal account.

In the intended business account, review PayPal availability and the exact checkout integration in test and live modes. Record only a redacted account reference and capability status in the private evidence ledger. Determine the least permissions the PayPal administrator needs to complete the connection; use an official account invitation if required, never shared credentials.

Prepare the shop address, business identity, agreed statement descriptor, customer support contact, policies, chosen settlement destination and fee comparison. The business owner must approve both commercial terms and settlement before anyone enables the live connection.

## PayPal administrator handoff — use your own browser

Purpose: connect the existing Salty Lamps business PayPal account to the confirmed business Stripe account for the replacement shop, while leaving the Wix shop operating. This handoff is prepared only; access, eligibility, fees and settlement approval remain outstanding.

Once those prerequisites are satisfied, the authorized administrator opens the intended Stripe account in their own browser, goes to Settings → Payment methods → PayPal → Turn on, checks the agreed settlement choice, then chooses Continue to PayPal. They sign in to the existing business PayPal account and personally review and approve the connection. If Stripe access is needed, arrange a separately approved official invitation first. Do not copy a private authorization session into a public document or chat.

Choose deliberately between settling PayPal funds into Stripe and keeping them in PayPal. Keeping funds in PayPal requires PayPal payout management and separate reconciliation. Record the decision privately before proceeding; later settlement changes may require Stripe support.

After returning to Stripe, the administrator checks the connection status. Report only approved, pending or failed, the selected settlement route and any non-sensitive outstanding checks. A pending status is not success. Passwords, one-time codes, recovery codes, keys, bank details and secrets stay in the provider browser or approved secret store, never chat.

The migration operator subsequently verifies checkout availability and the payment lifecycle in a sandbox. Administrator approval alone is not a passed payment test. No message has been sent to the administrator and no connection has been approved by this project.

## Alternatives and their consequences

Direct PayPal alongside Stripe: retains the existing PayPal account independently. Requires additional implementation for server-side order creation and capture, verified webhooks, duplicate-event protection, refunds, pending/reversed payments and provider-aware order records. Stock, totals, fulfillment and receipts must reconcile across both processors. This route is not implemented or tested.

Wix-managed checkout: an external Cloudflare storefront can redirect customers to Wix-hosted checkout through Wix Headless. This retains Wix commerce, subscriptions and operational dependencies; it is not a complete exit from Wix. Wix Payments and PayPal availability for that specific setup, return domains, inventory ownership, order synchronization and ongoing costs must be checked. This alternative has not been connected or tested.

## Fees and payment methods still require business approval

Compare the account-specific card and wallet rates, PayPal processing and any Stripe PayPal fees, fixed charges, cross-border/currency conversion, dispute fees, refund fee treatment, payout charges and retained Wix plan costs. Record a dated quote or dashboard evidence and the approver privately. No assumed universal rate or promised saving is approved.

Cards, Apple Pay, Google Pay, PayPal, Clearpay and Klarna each need an explicit decision: required or optional; evidenced on current Wix checkout or unconfirmed; eligible in the destination account; enabled; device/currency restrictions checked; sandbox result; and owner-authorized live result. Read-only Wix Accept Payments review on 26 September 2026 shows cards, Apple Pay, Google Pay, Clearpay and Klarna each marked Checkout Active and Payouts Active, and PayPal marked Checkout Active. Tap to Pay on mobile is also active; Wix Point of Sale still presents an Accept action and manual payments are not connected. These are Wix dashboard states, not proof of availability on every customer device or in the replacement account. No payment or connection change was performed.

Check payment-domain registration, embedded-checkout support, redirect return and cancellation, mobile/browser wallet eligibility and GBP availability. Do not promise that enabling Stripe automatically preserves every Wix payment method.

## Acceptance evidence and authorization boundaries

Before launch: verify matching publishable/secret keys and webhook configuration through the platform secret store; test success, decline, authentication, abandonment, expiration, duplicate/out-of-order webhooks, delayed payments, refund success/failure/pending and reconciliation of stock and email jobs. Confirm the provider dashboard agrees with the shop and no secret appears in logs.

Keep setup approval, sandbox results and live money movement as separate evidence. A low-value live purchase and refund require explicit business authorization and must be performed by the authorized person. Reconcile the actual refund and payout status; a pending refund is not returned money. No live charge, refund, launch or cancellation is authorized by this document.

## Provider instructions

- [Stripe PayPal activation](https://docs.stripe.com/payments/paypal/activate)
- [Stripe PayPal eligibility](https://docs.stripe.com/payments/paypal)
- [Stripe PayPal settlement](https://docs.stripe.com/payments/paypal/choose-settlement-preference)
- [Stripe UK pricing](https://stripe.com/gb/pricing)
- [Direct PayPal integration](https://developer.paypal.com/studio/checkout/standard/integrate)
- [Wix-managed checkout](https://dev.wix.com/docs/go-headless/business-solutions/wix-hosted-pages/redirect-using-the-js-sdk)
