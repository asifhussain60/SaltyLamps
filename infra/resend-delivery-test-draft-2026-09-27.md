# Resend provider delivery test draft — 27 September 2026

This is a proposed one-message test, not authorization to send. Confirm the
recipient and obtain explicit approval immediately before the send. The owner
Resend account showed Transactional Free at $0/month, 0/3,000 monthly and
0/100 daily sends, no payment method and pay-as-you-go disabled. Do not change
the plan, add a card or enable overages.

| Field | Proposed value |
| --- | --- |
| From | `Salty Lamps <orders@saltylamps.co.uk>` |
| To | `asifhussain60@gmail.com` (approved operator test inbox, not a customer) |
| Reply-To | `info@saltylamps.co.uk` |
| Subject | `Salty Lamps email delivery test — no order` |
| Body | `This is a one-time test of Salty Lamps outbound email delivery. No purchase, payment, order, shipment, or customer notification is involved. No action is needed.` |

Use the newly created domain-restricted sending-only key from the private local
file. Send exactly once with an idempotency key; do not connect that key to the
test shop, which remains in dry-run mode. Record provider acceptance separately
from recipient inbox receipt and business-address reply acceptance. Never
include the key or any customer record in evidence or logs.
