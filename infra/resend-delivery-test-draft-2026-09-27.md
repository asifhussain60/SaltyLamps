# Resend provider delivery test — 27 September 2026

Asif approved this specific one-message test after reviewing the draft. The
owner Resend account showed Transactional Free at $0/month, 0/3,000 monthly
and 0/100 daily sends, no payment method and pay-as-you-go disabled before the
send. No plan, card or overage setting was changed.

| Field | Proposed value |
| --- | --- |
| From | `Salty Lamps <orders@saltylamps.co.uk>` |
| To | `asifhussain60@gmail.com` (approved operator test inbox, not a customer) |
| Reply-To | `info@saltylamps.co.uk` |
| Subject | `Salty Lamps email delivery test — no order` |
| Body | `This is a one-time test of Salty Lamps outbound email delivery. No purchase, payment, order, shipment, or customer notification is involved. No action is needed.` |

The first HTTP request returned a non-JSON 403 with no provider email ID. A
diagnostic unauthenticated read confirmed the API endpoint was reachable. One
retry with the exact same payload and idempotency key returned HTTP 200 and
message ID `01a0e417-6a7f-74ac-88bd-c30ee795687e`. The signed-in provider
[message detail](https://resend.com/emails/01a0e417-6a7f-74ac-88bd-c30ee795687e)
shows the intended sender, recipient, reply-to and body, with both Sent and
Delivered events. The account usage changed to 1/3,000 monthly and 1/100 daily.
This supports one accepted message within the free allowance; no order or
payment was created. The owner subsequently supplied a screenshot of the Gmail
inbox showing the message, its `Salty Lamps <orders@saltylamps.co.uk>` sender,
recipient, subject and expected body. This verifies receipt of the direct test
message. The screenshot does not show the Reply-To header or a reply reaching
the Zoho mailbox, so reply handling remains open.

The key remains only in the private local file. It was not connected to the
test shop, which remains in dry-run mode. Never include the key or a customer
record in evidence or logs.
