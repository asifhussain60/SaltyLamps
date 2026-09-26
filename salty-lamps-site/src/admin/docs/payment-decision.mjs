export const paymentDecision = {
  "reviewed": "26 September 2026",
  "sections": [
    {
      "title": "Preferred route and present evidence",
      "paragraphs": [
        "Preferred, conditional decision: leave Wix using Stripe for cards and eligible wallets, plus the existing Salty Lamps business PayPal account. First assess PayPal through Stripe; use direct PayPal alongside Stripe if eligibility, access or commercial terms make that necessary. The preference is recorded, but no replacement payment route is connected or tested.",
        "The live Wix shop uses Wix Payments and PayPal. Replacement code implements Stripe; existing test configuration does not establish a Salty Lamps business Stripe account, production activation or payment-method availability. A separate administrator controls the existing PayPal business account. Preserve the current Wix connections throughout preparation."
      ]
    },
    {
      "title": "What the Stripe owner must establish before the PayPal handoff",
      "paragraphs": [
        "Identify the Salty Lamps business Stripe account or have the business owner complete account creation and verification themselves. Confirm the legal business, UK account eligibility, GBP processing, authorized administrator access, settlement bank and refund/dispute responsibilities. Do not substitute a developer or proposal account.",
        "In the intended business account, review PayPal availability and the exact checkout integration in test and live modes. Record only a redacted account reference and capability status in the private evidence ledger. Determine the least permissions the PayPal administrator needs to complete the connection; use an official account invitation if required, never shared credentials.",
        "Prepare the shop address, business identity, agreed statement descriptor, customer support contact, policies, chosen settlement destination and fee comparison. The business owner must approve both commercial terms and settlement before anyone enables the live connection."
      ]
    },
    {
      "title": "PayPal administrator handoff — use your own browser",
      "paragraphs": [
        "Purpose: connect the existing Salty Lamps business PayPal account to the confirmed business Stripe account for the replacement shop, while leaving the Wix shop operating. This handoff is prepared only; access, eligibility, fees and settlement approval remain outstanding.",
        "Once those prerequisites are satisfied, the authorized administrator opens the intended Stripe account in their own browser, goes to Settings → Payment methods → PayPal → Turn on, checks the agreed settlement choice, then chooses Continue to PayPal. They sign in to the existing business PayPal account and personally review and approve the connection. If Stripe access is needed, arrange a separately approved official invitation first. Do not copy a private authorization session into a public document or chat.",
        "Choose deliberately between settling PayPal funds into Stripe and keeping them in PayPal. Keeping funds in PayPal requires PayPal payout management and separate reconciliation. Record the decision privately before proceeding; later settlement changes may require Stripe support.",
        "After returning to Stripe, the administrator checks the connection status. Report only approved, pending or failed, the selected settlement route and any non-sensitive outstanding checks. A pending status is not success. Passwords, one-time codes, recovery codes, keys, bank details and secrets stay in the provider browser or approved secret store, never chat.",
        "The migration operator subsequently verifies checkout availability and the payment lifecycle in a sandbox. Administrator approval alone is not a passed payment test. No message has been sent to the administrator and no connection has been approved by this project."
      ]
    },
    {
      "title": "Alternatives and their consequences",
      "paragraphs": [
        "Direct PayPal alongside Stripe: retains the existing PayPal account independently. Requires additional implementation for server-side order creation and capture, verified webhooks, duplicate-event protection, refunds, pending/reversed payments and provider-aware order records. Stock, totals, fulfillment and receipts must reconcile across both processors. This route is not implemented or tested.",
        "Wix-managed checkout: an external Cloudflare storefront can redirect customers to Wix-hosted checkout through Wix Headless. This retains Wix commerce, subscriptions and operational dependencies; it is not a complete exit from Wix. Wix Payments and PayPal availability for that specific setup, return domains, inventory ownership, order synchronization and ongoing costs must be checked. This alternative has not been connected or tested."
      ]
    },
    {
      "title": "Fees and payment methods still require business approval",
      "paragraphs": [
        "Compare the account-specific card and wallet rates, PayPal processing and any Stripe PayPal fees, fixed charges, cross-border/currency conversion, dispute fees, refund fee treatment, payout charges and retained Wix plan costs. Record a dated quote or dashboard evidence and the approver privately. No assumed universal rate or promised saving is approved.",
        "Cards, Apple Pay, Google Pay, PayPal, Clearpay and Klarna each need an explicit decision: required or optional; evidenced on current Wix checkout or unconfirmed; eligible in the destination account; enabled; device/currency restrictions checked; sandbox result; and owner-authorized live result. Current evidence confirms Wix Payments and PayPal as providers, not that every listed wallet or pay-later method is currently offered.",
        "Check payment-domain registration, embedded-checkout support, redirect return and cancellation, mobile/browser wallet eligibility and GBP availability. Do not promise that enabling Stripe automatically preserves every Wix payment method."
      ]
    },
    {
      "title": "Acceptance evidence and authorization boundaries",
      "paragraphs": [
        "Before launch: verify matching publishable/secret keys and webhook configuration through the platform secret store; test success, decline, authentication, abandonment, expiration, duplicate/out-of-order webhooks, delayed payments, refund success/failure/pending and reconciliation of stock and email jobs. Confirm the provider dashboard agrees with the shop and no secret appears in logs.",
        "Keep setup approval, sandbox results and live money movement as separate evidence. A low-value live purchase and refund require explicit business authorization and must be performed by the authorized person. Reconcile the actual refund and payout status; a pending refund is not returned money. No live charge, refund, launch or cancellation is authorized by this document."
      ]
    }
  ],
  "sources": [
    [
      "Stripe PayPal activation",
      "https://docs.stripe.com/payments/paypal/activate"
    ],
    [
      "Stripe PayPal eligibility",
      "https://docs.stripe.com/payments/paypal"
    ],
    [
      "Stripe PayPal settlement",
      "https://docs.stripe.com/payments/paypal/choose-settlement-preference"
    ],
    [
      "Stripe UK pricing",
      "https://stripe.com/gb/pricing"
    ],
    [
      "Direct PayPal integration",
      "https://developer.paypal.com/studio/checkout/standard/integrate"
    ],
    [
      "Wix-managed checkout",
      "https://dev.wix.com/docs/go-headless/business-solutions/wix-hosted-pages/redirect-using-the-js-sdk"
    ]
  ]
}

export function paymentDecisionMarkdown() {
  return `# Salty Lamps payment decision and administrator handoff\n\nReviewed ${paymentDecision.reviewed}. Prepared; connection and testing outstanding.\n\n${paymentDecision.sections.map(s => `## ${s.title}\n\n${s.paragraphs.join("\n\n")}`).join("\n\n")}\n\n## Provider instructions\n\n${paymentDecision.sources.map(([label, url]) => `- [${label}](${url})`).join("\n")}\n`
}
