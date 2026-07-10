// GET   /api/admin/orders/:id  — order with line items and shipping address.
// PATCH /api/admin/orders/:id  — fulfilment status, tracking, or refund/cancel.
import Stripe from 'stripe'
import { json, apiError, validationError, readJson, auditStmt } from '../../../lib/admin-helpers.mjs'
import { validateOrderPatch } from '../../../lib/validation.mjs'

export async function onRequestGet({ params, env }) {
  try {
    const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(params.id).first()
    if (!order) return apiError('Order not found.', 404, { code: 'not_found' })

    const items = await env.DB.prepare(
      `SELECT oi.sku_id, oi.quantity, oi.unit_price_pence,
              s.sku, s.variant_label, s.track_mode,
              p.id AS product_id, p.name, p.image
       FROM order_items oi
       JOIN skus s ON s.id = oi.sku_id
       JOIN products p ON p.id = s.product_id
       WHERE oi.order_id = ?`,
    ).bind(params.id).all()

    return json({ order, items: items.results || [] })
  } catch (err) {
    return apiError(`Could not load order: ${err.message}`, 500, { code: 'server_error' })
  }
}

export async function onRequestPatch({ params, request, env, data }) {
  const [body, bodyErr] = await readJson(request)
  if (bodyErr) return bodyErr

  const { ok, errors, value } = validateOrderPatch(body)
  if (!ok) return validationError(errors)

  try {
    const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(params.id).first()
    if (!order) return apiError('Order not found.', 404, { code: 'not_found' })

    // If marking refunded, issue the Stripe refund first — don't record a refund
    // we didn't actually make. (Uses the configured Stripe key; safe in test mode.)
    if (value.status === 'refunded') {
      if (order.status === 'refunded') return apiError('Order is already refunded.', 409, { code: 'conflict' })
      if (!order.payment_intent) return apiError('No payment on file to refund.', 409, { code: 'conflict' })
      try {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
          httpClient: Stripe.createFetchHttpClient(),
          apiVersion: '2024-06-20',
        })
        await stripe.refunds.create({ payment_intent: order.payment_intent })
      } catch (stripeErr) {
        return apiError(`Stripe refund failed: ${stripeErr.message}`, 502, { code: 'stripe_error' })
      }
    }

    const set = []
    const binds = []
    if (value.fulfilment_status != null) {
      set.push('fulfilment_status = ?')
      binds.push(value.fulfilment_status)
      if (value.fulfilment_status === 'shipped' && !order.shipped_at) {
        set.push(`shipped_at = datetime('now')`)
      }
    }
    if (value.tracking_number != null) {
      set.push('tracking_number = ?')
      binds.push(value.tracking_number)
    }
    if (value.status != null) {
      set.push('status = ?')
      binds.push(value.status)
    }

    const updateStmt = env.DB.prepare(`UPDATE orders SET ${set.join(', ')} WHERE id = ?`).bind(...binds, params.id)
    await env.DB.batch([
      updateStmt,
      auditStmt(env.DB, data.actorEmail, 'order.update', 'order', params.id, value),
    ])

    const updated = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(params.id).first()
    return json({ order: updated })
  } catch (err) {
    return apiError(`Could not update order: ${err.message}`, 500, { code: 'server_error' })
  }
}
