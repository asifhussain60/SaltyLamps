# Salty Lamps payment decision and administrator handoff

Reviewed 27 September 2026. Owner account and sandbox verified; activation, connection and testing outstanding.

## Preferred route and present evidence

Preferred, conditional decision: leave Wix using Stripe for cards and eligible wallets, plus the existing Salty Lamps business PayPal account. First assess PayPal through Stripe; use direct PayPal alongside Stripe if eligibility, access or commercial terms make that necessary. The preference is recorded, but no replacement payment route is connected or tested.

The retained Wix business has Wix Payments and PayPal configured; the public site currently shows a holding page. Replacement code implements Stripe. The signed-in Stripe dashboard now verifies a Salty Lamps Ltd. account owned by saltylamps@hotmail.com, with a separate sandbox. The live account opens the Activate Payments business-verification flow and is not yet activated. A separate administrator controls the existing PayPal business account. Preserve the current Wix connections throughout preparation.

Read-only owner-account evidence is recorded in `infra/stripe-owner-readiness-2026-09-27.json`. The live onboarding shows United Kingdom and currently displays Individual / Sole Trader as the business type, despite the account name ending Ltd.; the owner must verify the correct legal structure before submitting details. Later business, representative, bank and review steps are disabled at this first step. No live payment capability or settlement bank has been verified.

In the separate sandbox, cards, Apple Pay and Klarna show Enabled; Google Pay, PayPal and Afterpay / Clearpay show Disabled. No payment-method domain or webhook destination is listed. These are sandbox settings, not live eligibility, an approved method choice or a working checkout. No credential was revealed or created and no account setting, payment or PayPal connection was changed.

## What the Stripe owner must establish before the PayPal handoff

The Salty Lamps Stripe account and its owner are now identified. Have the business owner complete account verification themselves, starting with the correct legal business type. Confirm UK live eligibility, GBP processing, settlement bank and refund/dispute responsibilities after Stripe reviews the submitted details. Do not substitute a developer or proposal account.

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
