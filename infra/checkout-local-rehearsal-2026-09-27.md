# Local checkout rehearsal — 27 September 2026

## Scope and result

The replacement shop was built and served locally with its existing fixture catalogue. Provider credentials were withheld. This was a preparation check, not a Stripe payment, customer email delivery, production import, or launch acceptance. No live customer data or payment details were entered.

- The local build completed.
- Thirteen desktop browser checks passed, covering order review, postcode handoff, changed options and quantities, delivery failures and retries, malformed payment responses, and empty checkout recovery. Payment requests in these checks were intercepted with synthetic responses.
- A direct browser walkthrough opened the in-stock Angel Shape Himalayan Rock Salt Lamp, added one to the cart, and entered checkout with a £29.99 item subtotal.
- A manually entered `ST4 3NP` postcode carried from order review to the address form. The address form offered manual entry for the remaining fields.
- Attempting to continue with empty required address fields left the shopper on the address step and focused the email field.
- A screenshot of the address step was visually inspected; no layout defect was observed in the visible viewport.
- The local postcode suggestion request returned 503. Read-only inspection found that this local fixture database has no `uk_postcodes` table, although the migration defining it is present. This does not establish whether the owner production database has the table or postcode rows. Manual postcode entry remained available.

## Limits and next gate

The local database includes test fixture products and does not prove current business catalogue, stock, packed weights, or delivery parity. Postcode suggestion data must be prepared and verified in the destination database before claiming that feature works. The direct walkthrough stopped before creating a payment session. The browser checks used mocked payment responses, so they do not establish that the owner Stripe account, sandbox, webhooks, wallets, receipts, refunds, or customer email work. The owner sandbox still shows the past-due business-owner/director verification task. After Jared completes it, use credentials verified for the owner account to run a separate sandbox payment and webhook lifecycle rehearsal; a live purchase and refund still require owner approval.
