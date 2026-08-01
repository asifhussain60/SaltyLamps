// POST /api/support/refund-request
// Body: { order_ref, email, reason, website? }
//
// The customer-facing half of the refund flow. Refunds themselves stay where they
// were — an admin action in functions/api/admin/orders/[id].js that calls Stripe.
// This only asks; it changes no order state and moves no money.
//
// IDENTICAL RESPONSE ON MATCH AND MISMATCH. There is no customer login here, so
// the only way to verify a request is order reference plus the email address on
// that order. If either is wrong we still answer `{ ok: true }`. Answering
// differently would turn this into an oracle for "does an order with this
// reference exist" and "is this the address that placed it" — a lookup nobody
// should be able to run against a shop's order book.
import { json, apiError, readJson } from '../../lib/admin-helpers.mjs'
import { validateRefundRequest } from '../../lib/validation.mjs'
import { sendTemplated, loadEmailConfig, orderTokens, orderBlocks } from '../../lib/mailer.mjs'

export async function onRequestPost({ request, env }) {
  const [body, bodyErr] = await readJson(request)
  if (bodyErr) return bodyErr

  if (typeof body?.website === 'string' && body.website.trim() !== '') return json({ ok: true })

  const { ok, errors, value } = validateRefundRequest(body)
  if (!ok) return apiError('Please check the form and try again.', 400, { code: 'validation', fields: errors })

  try {
    const order = await findOrder(env.DB, value.order_ref, value.email)
    if (order) await notifyAdmin(env, request, order, value.reason)
  } catch {
    // Swallowed on purpose. A lookup or mail failure must produce the same
    // response as a mismatch, or the difference becomes the oracle this endpoint
    // exists to avoid.
  }

  return json({ ok: true })
}

// Matches either the short reference the emails print (#A1B2C3D4 — the last eight
// characters of the Stripe session id, see orderRef in email-render.mjs) or a
// pasted full session id, AND the email address recorded on the order.
async function findOrder(db, reference, email) {
  const short = reference.replace(/^#/, '').trim().toUpperCase()
  return db.prepare(
    `SELECT * FROM orders
     WHERE (UPPER(SUBSTR(id, -8)) = ? OR id = ?)
       AND LOWER(customer_email) = LOWER(?)`,
  ).bind(short, reference.trim(), email).first()
}

async function notifyAdmin(env, request, order, reason) {
  const origin = new URL(request.url).origin
  const config = await loadEmailConfig(env, origin)

  // No early return when the admin address is blank. The send goes ahead so
  // sendTemplated() records a 'skipped' row saying there was no recipient — a refund
  // request that reached nobody is exactly the thing that must not vanish quietly.
  // The rate limit below then counts that row too, which is the intended reading of
  // "one per order per hour": one attempt, whatever became of it.
  //
  // One request per order per hour. A frustrated customer clicking submit five
  // times should not fill the owner's inbox, and the outbox already records every
  // send, so this needs no table of its own.
  const recent = await env.DB.prepare(
    `SELECT id FROM email_outbox
     WHERE template_key = 'admin_refund_request' AND order_id = ?
       AND created_at > datetime('now', '-1 hour')
     LIMIT 1`,
  ).bind(order.id).first()
  if (recent) return

  const items = await env.DB.prepare(
    `SELECT oi.quantity, oi.unit_price_pence, s.sku, s.variant_label, p.name
     FROM order_items oi
     JOIN skus s ON s.id = oi.sku_id
     JOIN products p ON p.id = s.product_id
     WHERE oi.order_id = ?`,
  ).bind(order.id).all()

  await sendTemplated(env, [{
    templateKey: 'admin_refund_request',
    to: config.adminEmail,
    orderId: order.id,
    replyTo: order.customer_email || undefined,
    data: {
      ...orderTokens(order),
      reason,
      ctaHref: `${config.siteUrl}/admin/orders/${order.id}`,
    },
    blocks: [
      { type: 'note', title: 'What the customer said', text: reason },
      ...orderBlocks(order, items.results || []),
    ],
  }], { origin })
}
