// POST /api/webhook — Stripe webhook endpoint.
// Configure this URL in the Stripe dashboard (Developers > Webhooks) listening
// for `checkout.session.completed`, then store the signing secret as a Pages
// Function secret: wrangler pages secret put STRIPE_WEBHOOK_SECRET
//
// Requires: DB (D1 binding), STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Optional: RESEND_API_KEY (see functions/lib/mailer.mjs) — without it, order and
//           admin emails are recorded as 'skipped' and nothing else changes.

import Stripe from 'stripe'
import { sendTemplated, orderTokens, orderBlocks, loadEmailConfig } from '../lib/mailer.mjs'
import { lowStockThreshold } from '../lib/admin-helpers.mjs'

export async function onRequestPost({ request, env }) {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: '2024-06-20',
  })

  const signature = request.headers.get('stripe-signature')
  const body = await request.text()

  let event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    try {
      await recordOrder(env, stripe, session, new URL(request.url).origin)
    } catch (err) {
      // Stripe retries on a non-2xx, which is what we want here: this only fires on
      // a genuine write failure (or two retried deliveries racing each other), and
      // the idempotency check above makes a retry safe either way.
      console.error('webhook: recordOrder failed', err)
      return new Response(JSON.stringify({ received: false, error: err.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

async function recordOrder(env, stripe, session, origin) {
  const db = env.DB
  const existing = await db.prepare('SELECT id FROM orders WHERE id = ?').bind(session.id).first()
  if (existing) return // already processed (Stripe may retry webhooks)

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ['data.price.product'],
  })

  // Capture the shipping address Stripe collected — needed to pack and post the
  // order.
  //
  // READ BOTH LOCATIONS. Stripe moved this field: up to API version 2024-06-20 it
  // is `session.shipping_details`; from 2025 onwards it is
  // `session.collected_information.shipping_details`. The apiVersion passed to the
  // Stripe constructor does NOT control this — a webhook event is serialised at the
  // version pinned on the ENDPOINT in the Stripe dashboard, which is currently
  // 2026-06-24.dahlia. Reading only the old path returned undefined and silently
  // fell through to the BILLING address below, so any customer who unticked
  // "billing info is same as shipping" would have had their parcel sent to the
  // wrong address.
  //
  // The billing fallback stays, but it is now genuinely a fallback rather than the
  // path every order took.
  const ship = session.shipping_details || session.collected_information?.shipping_details || {}
  const addr = ship.address || session.customer_details?.address || {}
  const shipName = ship.name || session.customer_details?.name || null

  const statements = [
    db.prepare(
      `INSERT INTO orders (id, payment_intent, status, customer_email, amount_total_pence, currency,
                           ship_name, ship_line1, ship_line2, ship_city, ship_postcode, ship_country)
       VALUES (?, ?, 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      session.id,
      session.payment_intent,
      session.customer_details?.email ?? null,
      session.amount_total,
      session.currency,
      shipName,
      addr.line1 ?? null,
      addr.line2 ?? null,
      addr.city ?? null,
      addr.postal_code ?? null,
      addr.country ?? null,
    ),
  ]

  // sku_id -> units ordered, collected while building the insert statements so the
  // low-stock check below has the quantities without walking the Stripe payload twice.
  const orderedBySkuId = new Map()

  for (const line of lineItems.data) {
    // sku_id was stamped into the Stripe product's metadata in checkout.js, straight
    // from the D1-verified row — more trustworthy than anything echoed from the client.
    const skuId = Number(line.price?.product?.metadata?.sku_id)
    if (!Number.isInteger(skuId)) continue // metadata missing — skip rather than write a bad row

    orderedBySkuId.set(skuId, (orderedBySkuId.get(skuId) || 0) + line.quantity)

    statements.push(
      db.prepare(
        `INSERT INTO order_items (order_id, sku_id, quantity, unit_price_pence) VALUES (?, ?, ?, ?)`
      ).bind(session.id, skuId, line.quantity, line.price.unit_amount)
    )

    // Only auto-decrement for items with a real tracked quantity. Binary
    // (InStock/OutOfStock) items are a manual toggle in Wix today and stay
    // that way here — flipping them to out-of-stock after one sale would be
    // wrong for anything effectively made-to-order or unlimited-supply.
    statements.push(
      db.prepare(
        `UPDATE skus SET quantity = MAX(quantity - ?, 0), in_stock = (MAX(quantity - ?, 0) > 0)
         WHERE id = ? AND track_mode = 'quantity'`
      ).bind(line.quantity, line.quantity, skuId)
    )
  }

  // Stock levels BEFORE the decrement. Read here, not after, because the low-stock
  // alert must fire on the CROSSING — the one order that takes an item from at-or-
  // above the threshold to below it. Testing "is it below now" instead would re-fire
  // the same alert on every subsequent order until the item was restocked.
  const before = await readStockBefore(db, [...orderedBySkuId.keys()])

  await db.batch(statements)

  // Everything past this point is best-effort. The order is committed; nothing
  // below may throw, or Stripe retries and the idempotency check above swallows
  // the reprocess. sendTemplated() never throws, and the rest is wrapped.
  try {
    await sendOrderEmails(env, db, session, orderedBySkuId, before, origin, stripe)
  } catch {
    // Deliberately silent: an order that is recorded but unannounced is a support
    // problem, an order that is lost is a business one.
  }
}

async function readStockBefore(db, skuIds) {
  if (skuIds.length === 0) return new Map()
  const placeholders = skuIds.map(() => '?').join(',')
  const { results } = await db
    .prepare(
      `SELECT s.id, s.sku, s.variant_label, s.quantity, s.track_mode, p.name
       FROM skus s JOIN products p ON p.id = s.product_id
       WHERE s.id IN (${placeholders})`,
    )
    .bind(...skuIds)
    .all()
  return new Map((results || []).map(r => [r.id, r]))
}

async function sendOrderEmails(env, db, session, orderedBySkuId, before, origin, stripe) {
  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(session.id).first()
  if (!order) return

  const items = await db.prepare(
    `SELECT oi.quantity, oi.unit_price_pence, s.sku, s.variant_label, p.name
     FROM order_items oi
     JOIN skus s ON s.id = oi.sku_id
     JOIN products p ON p.id = s.product_id
     WHERE oi.order_id = ?`,
  ).bind(session.id).all()

  const paymentMethod = await readPaymentMethod(stripe, session)
  const tokens = orderTokens(order, { paymentMethod })
  const blocks = orderBlocks(order, items.results || [])
  const messages = []

  if (order.customer_email) {
    messages.push({
      templateKey: 'order_confirmation',
      to: order.customer_email,
      orderId: order.id,
      data: tokens,
      // Address included: it is the last chance a customer has to spot a wrong
      // delivery address while it is still cheap to change.
      blocks,
    })
  }

  // Queued even when no admin address is configured. sendTemplated() resolves that
  // to a 'skipped' outbox row reading "No recipient address", which is the whole
  // point: an admin alert that goes nowhere because the address in Settings was
  // cleared or mistyped has to leave a trace in Emails -> Activity. Guarding here
  // instead would drop it silently, and the first anyone would know is a missed order.
  const config = await loadEmailConfig(env, origin)
  messages.push({
    templateKey: 'admin_new_order',
    to: config.adminEmail,
    orderId: order.id,
    replyTo: order.customer_email || undefined,
    data: {
      ...tokens,
      ctaHref: `${config.siteUrl}/admin/orders/${order.id}`,
    },
    blocks: [
      {
        type: 'panel',
        title: 'Customer',
        rows: [
          ['Name', order.ship_name || ''],
          ['Email', order.customer_email || ''],
          ['Payment method', paymentMethod],
          ['Stripe reference', order.id],
        ],
      },
      ...blocks,
    ],
  })

  for (const message of lowStockMessages(before, orderedBySkuId, await lowStockThreshold(db), config)) {
    messages.push(message)
  }

  await sendTemplated(env, messages, { origin })
}

// One alert per SKU that crossed the threshold on THIS order, and none for a SKU
// that was already below it before the order was placed.
//
// Exported purely so this rule can be tested on its own. It is the difference
// between one alert and an alert on every subsequent order until the item is
// restocked, and it is not reachable through the HTTP surface — driving it needs a
// signed Stripe webhook for a session that exists in Stripe's own records.
// lowStockAlerts is still checked here: switching the alerts off is a deliberate
// choice by the owner, and there is nothing to report about mail they asked not to
// receive. A missing admin address is the opposite — a misconfiguration — so it is
// left for sendTemplated() to record rather than silently swallowed here.
export function lowStockMessages(before, orderedBySkuId, threshold, config) {
  if (!config.lowStockAlerts) return []

  const out = []
  for (const [skuId, ordered] of orderedBySkuId) {
    const row = before.get(skuId)
    if (!row || row.track_mode !== 'quantity') continue

    const was = Number(row.quantity ?? 0)
    const now = Math.max(was - ordered, 0)
    if (!(was >= threshold && now < threshold)) continue

    out.push({
      templateKey: 'admin_low_stock',
      to: config.adminEmail,
      data: {
        product_name: row.name,
        sku: row.sku,
        variant_label: row.variant_label || '',
        quantity: String(now),
        threshold: String(threshold),
        ctaHref: `${config.siteUrl}/admin/inventory`,
      },
      blocks: [{
        type: 'panel',
        title: 'Stock',
        rows: [
          ['Product', row.name],
          ['Variant', row.variant_label || ''],
          ['SKU', row.sku],
          ['Remaining', String(now)],
          ['Threshold', String(threshold)],
        ],
      }],
    })
  }
  return out
}

// The method the customer ACTUALLY paid with, which is on the charge rather than
// the session — session.payment_method_types lists what was offered, and once
// PayPal and the wallets are enabled that is no longer the same thing. Guarded:
// an extra Stripe round-trip must not be able to cost us the notification, and the
// panel drops the row when this comes back empty.
async function readPaymentMethod(stripe, session) {
  try {
    if (!session.payment_intent) return ''
    const intent = await stripe.paymentIntents.retrieve(session.payment_intent, {
      expand: ['latest_charge'],
    })
    const type = intent?.latest_charge?.payment_method_details?.type || ''
    return type ? type.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : ''
  } catch {
    return ''
  }
}
