# Salty Lamps — Pricing

Reviewed 27 September 2026. This guide and the admin Pricing page share the same cost data.

Estimated incremental Cloudflare cost: $0/month while Pages, Functions, D1, Zero Trust and R2 Standard stay within their free allowances. This is a conditional estimate, not a fixed bill or spending cap. The EU-jurisdiction database is empty. The owner dashboard now shows Zero Trust Free active; its $0/month checkout required agreement to terms and authorization for charges beyond included limits. The administrator application and exact two-user policy are not yet configured. R2 separately requires a recurring, usage-billed subscription before a bucket can be created. Payment processing, domain renewal, existing Wix and Zoho service, and customer email delivery are separate costs. No paid Cloudflare upgrade is selected.

| Need | Choice | Boundary |
| --- | --- | --- |
| Website and backend | Cloudflare Pages and Functions free tier: $0/month within limits | 500 Pages builds per month and 100,000 shared Worker/Function requests per day, with 10 ms CPU per invocation. Static requests do not use the Function allowance. Free-limit exhaustion can interrupt dynamic requests. |
| Database | Cloudflare D1 free tier: $0/month within limits | 5 million rows read and 100,000 rows written per day; 5 GB total account storage. The new EU-jurisdiction database is empty. Daily limit exhaustion interrupts queries; there is no assumed automatic paid upgrade. |
| Administrator sign-in | Cloudflare Zero Trust Free: $0/month for the two approved users | The owner account now shows the Free plan active, with a 50-user limit and Cloudflare as the only listed identity provider. The checkout required agreement to terms and authorization for charges beyond included limits. The administrator application and exact two-user allow policy are not yet configured. |
| Uploaded images | Cloudflare R2 Standard free allowance: estimated $0/month within limits | 10 GB-month storage, 1 million Class A and 10 million Class B operations per month. Wix reports 819.09 MB of site files, but full original media is not yet backed up, so final size is unverified. R2 requires the owner to accept a recurring, usage-billed subscription; no subscription or bucket has been created. Standard overages are $0.015 per GB-month, $4.50 per million Class A requests and $0.36 per million Class B requests; billed units round up. |
| Incoming email | Cloudflare Email Routing is free | Forwarding to an existing verified inbox; it is not a mailbox archive or a complete business reply service. Keep Zoho until inbound and branded replies are proven. |
| Customer order emails | Retain Resend free plan initially | Already integrated. Official public pricing lists 3,000 emails per month and 100 per day on Free. Verify the actual owner account plan, remaining allowance, sending domain and all message types before launch; public pricing is not account verification. |
| Cloudflare outgoing email | Requires Workers Paid | Sending to arbitrary customers is unavailable on Workers Free. Paid starts at $5 USD/month, including 3,000 outgoing emails, then $0.35 per 1,000. Optional later choice, not approved spend. |
| Estimated incremental Cloudflare total | $0/month if all free limits hold | This is a conditional estimate, not a spending cap or launch approval. Existing Wix, Zoho, registrar, payment-processing and email-service charges are separate; usage must be measured before and after launch. |
| Payments and domain | Stripe and registrar | Stripe and PayPal processing fees and domain renewal remain separate. Cloudflare does not replace the payment processor. |

## Stripe payment costs

The replacement code uses Stripe. Ownership of the Salty Lamps Stripe account is verified, but Stripe has not completed live business verification, live payments are not activated, and no replacement checkout is connected. Fees depend on the owner’s account, card category, payment method and currency conversion. A standard UK card rate is not a universal rate for all UK cards. Verify the current account pricing before estimating net proceeds or refund costs. [Stripe UK pricing](https://stripe.com/gb/pricing).

## Domain and mailbox costs

Nominet confirms 123-Reg as the registrar. Cloudflare DNS is active; domain registration and renewals remain at 123-Reg. Moving DNS and hosting does not require transferring the domain registration. Verify the owner’s registrar access and renewal invoice; do not assume a renewal or transfer price.

Keep the current Zoho mailbox until the mail archive, incoming forwarding and replies from the business address have all been proven. Free email forwarding alone does not replace a full mailbox.

## Provider sources

- [Cloudflare account sign-in for Access](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/cloudflare/)
- [PayPal Checkout integration](https://developer.paypal.com/studio/checkout/standard/integrate)
- [PayPal through Stripe eligibility](https://support.stripe.com/questions/paypal-payment-method-availability?locale=en-GB)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Pages free limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/)
- [Cloudflare Zero Trust onboarding](https://developers.cloudflare.com/cloudflare-one/setup/)
- [Cloudflare Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/)
- [Cloudflare inbound email setup](https://developers.cloudflare.com/email-service/get-started/route-emails/)
- [Resend pricing](https://resend.com/pricing)
