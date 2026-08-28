// GET   /api/admin/orders/:id  — order with line items and shipping address.
// PATCH /api/admin/orders/:id  — fulfilment status, tracking, or refund/cancel.
import Stripe from 'stripe'
import { json, apiError, validationError, readJson, auditStmt } from '../../../lib/admin-helpers.mjs'
import {
  validateOrderPatch, despatchErrors, ORDER_PATCH_FIELDS,
  carrierByCode, carrierTrackingUrl,
} from '../../../lib/validation.mjs'
import { sendTemplated, orderTokens, orderBlocks } from '../../../lib/mailer.mjs'

// Which customer email a status change earns, and only on an ACTUAL change.
// Re-saving an order that is already 'shipped' — which the admin form does every
// time any other field is edited — must not send the customer a second despatch
// notice, so each rule compares the new value against the row as it was before.
//
// ctaField names the order column that becomes the email's button destination.
// It is per-rule, not a shared token: putting the tracking link on the tokens
// object would aim the button at the courier the day someone types a cta_label
// into the delivered, refunded or cancelled wording.
const STATUS_EMAILS = [
  { field: 'fulfilment_status', to: 'shipped', template: 'order_shipped', ctaField: 'tracking_url' },
  { field: 'fulfilment_status', to: 'delivered', template: 'order_delivered' },
  { field: 'status', to: 'refunded', template: 'order_refunded' },
  { field: 'status', to: 'cancelled', template: 'order_cancelled' },
]

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

    // Resolve the despatch details server-side as well as in the form. The admin
    // fills the courier name and the tracking link in as the owner types, but a
    // stale tab or a hand-made request reaches here too, and what is stored is what
    // a customer is emailed.
    if (value.carrier != null) {
      // The display name is a SNAPSHOT: the list's label for a known courier, the
      // owner's own words under 'other'. Never derived again at read time.
      if (!value.carrier) value.carrier_name = ''
      else if (value.carrier !== 'other') value.carrier_name = carrierByCode(value.carrier)?.label ?? value.carrier
    }

    const touchesDespatch = ['carrier', 'carrier_name', 'tracking_number', 'tracking_url']
      .some(f => value[f] != null)
    if (touchesDespatch && !value.tracking_url) {
      // Only fills a gap: a link the admin sent through wins, so a courier that
      // changes its URL shape is fixable per order without waiting for a deploy.
      const derived = carrierTrackingUrl(
        value.carrier != null ? value.carrier : order.carrier,
        value.tracking_number != null ? value.tracking_number : order.tracking_number,
      )
      if (derived) value.tracking_url = derived
    }

    // The despatch rule, checked against the order AS IT WILL BE: no order reaches
    // 'shipped' without a courier and a consignment number. The email fires once,
    // on that transition, so this is the only moment the details can still be
    // required — afterwards the customer already has the notice.
    const despatch = despatchErrors({ ...order, ...value })
    if (Object.keys(despatch).length > 0) return validationError(despatch)

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
        // An idempotency key, not a DB guard, is what actually stops a double-click
        // from issuing two real refunds: this call happens before anything is written
        // to the order row, so a compare-and-set there would be too late to help.
        await stripe.refunds.create(
          { payment_intent: order.payment_intent },
          { idempotencyKey: `refund:${order.id}` },
        )
      } catch (stripeErr) {
        return apiError(`Stripe refund failed: ${stripeErr.message}`, 502, { code: 'stripe_error' })
      }
    }

    // The SET clause is driven by the shared field list rather than a chain of ifs,
    // so a column added to validateOrderPatch() cannot be validated here and then
    // silently dropped on the way to the database.
    const set = []
    const binds = []
    for (const field of ORDER_PATCH_FIELDS) {
      if (value[field] == null) continue
      set.push(`${field} = ?`)
      binds.push(value[field])
      if (field === 'fulfilment_status' && value[field] === 'shipped' && !order.shipped_at) {
        set.push(`shipped_at = datetime('now')`)
      }
    }
    if (set.length === 0) return apiError('Nothing to update.', 400, { code: 'validation_error' })

    // Compare-and-set on whichever state(s) we read a moment ago. Two despatch
    // clicks in quick succession would otherwise both see 'packed', both write
    // 'shipped', and both send the customer a despatch notice — same risk for two
    // 'cancel' clicks both seeing the pre-cancel status. The second one now
    // matches no row, and the email below is gated on the write having landed.
    const guardParts = []
    const guardBinds = []
    if (value.fulfilment_status != null) {
      guardParts.push('fulfilment_status = ?')
      guardBinds.push(order.fulfilment_status)
    }
    if (value.status != null) {
      guardParts.push('status = ?')
      guardBinds.push(order.status)
    }
    const guard = guardParts.length ? ` AND ${guardParts.join(' AND ')}` : ''

    const updateStmt = env.DB
      .prepare(`UPDATE orders SET ${set.join(', ')} WHERE id = ?${guard}`)
      .bind(...binds, params.id, ...guardBinds)
    const [writeResult] = await env.DB.batch([
      updateStmt,
      auditStmt(env.DB, data.actorEmail, 'order.update', 'order', params.id, value),
    ])

    if (guard && (writeResult?.meta?.changes ?? 1) === 0) {
      return apiError(
        'This order was changed by someone else. Reload and try again.',
        409, { code: 'conflict' },
      )
    }

    const updated = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(params.id).first()

    // After the update has committed, never inside its batch: a mail failure must
    // not undo a fulfilment change the admin has already been told succeeded.
    // sendTemplated() does not throw, and this is wrapped regardless.
    try {
      await notifyStatusChange(env, request, order, updated, value)
    } catch { /* the status change stands; the email is best-effort */ }

    return json({ order: updated })
  } catch (err) {
    return apiError(`Could not update order: ${err.message}`, 500, { code: 'server_error' })
  }
}

async function notifyStatusChange(env, request, before, after, patch) {
  if (!after?.customer_email) return

  const rules = STATUS_EMAILS
    .filter(rule => patch[rule.field] === rule.to && before[rule.field] !== rule.to)
  if (rules.length === 0) return

  // Same join the GET handler above uses, so the despatch email lists the order
  // exactly as the admin sees it on screen.
  const items = await env.DB.prepare(
    `SELECT oi.quantity, oi.unit_price_pence, s.sku, s.variant_label, p.name
     FROM order_items oi
     JOIN skus s ON s.id = oi.sku_id
     JOIN products p ON p.id = s.product_id
     WHERE oi.order_id = ?`,
  ).bind(after.id).all()

  const tokens = orderTokens(after)
  const blocks = orderBlocks(after, items.results || [])

  await sendTemplated(
    env,
    rules.map(rule => ({
      templateKey: rule.template,
      to: after.customer_email,
      orderId: after.id,
      // ctaHref is added per template, never to the shared tokens — renderEmail()
      // draws the button whenever a cta_label and a ctaHref are both present, so a
      // shared one would aim every future button at the courier's tracking page.
      data: rule.ctaField && after[rule.ctaField]
        ? { ...tokens, ctaHref: after[rule.ctaField] }
        : tokens,
      blocks,
    })),
    { origin: new URL(request.url).origin },
  )
}
