import { frameChoicesFromMetadata } from '../lib/frame-orientation.mjs'
import {weightsFromMetadata,WEIGHT_FIELDS} from '../lib/weights.mjs'
// POST /api/webhook — Stripe webhook endpoint.
// Configure this URL in the Stripe dashboard (Developers > Webhooks) listening
// for `checkout.session.completed`, then store the signing secret as a Pages
// Function secret: wrangler pages secret put STRIPE_WEBHOOK_SECRET
//
// Requires: DB (D1 binding), STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Optional: RESEND_API_KEY (see functions/lib/mailer.mjs) — without it, order and
//           admin emails are recorded as 'skipped' and nothing else changes.

import Stripe from 'stripe'
import { stripeModeAllowed, stripeEventAllowed } from '../lib/stripe-mode.mjs'
import { orderTokens, orderBlocks, loadEmailConfig } from '../lib/mailer.mjs'
import { allCheckoutLines, checkoutAddress, releaseCheckout } from '../lib/checkout-state.mjs'
import { emailJobStatement, deliverOrderEmails } from '../lib/durable-email.mjs'
import { syncRefund } from '../lib/refunds.mjs'
import { lowStockThreshold } from '../lib/admin-helpers.mjs'

export async function onRequestPost({ request, env }) {
  if (!stripeModeAllowed(env)) return new Response('Sandbox configuration required', { status: 503 })
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

  if (!stripeEventAllowed(env, event)) return new Response('Live payment events are disabled in this test deployment', { status: 400 })

  try {
    if (['checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type) && event.data?.object?.metadata?.store === 'salty-lamps') {
      const current=await stripe.checkout.sessions.retrieve(event.data.object.id)
      if (current.payment_status !== 'paid') {
        if (current.status === 'expired') await releaseCheckout(env.DB,current.id)
        else if (event.type === 'checkout.session.async_payment_failed' && current.payment_intent) {
          const intent=await stripe.paymentIntents.retrieve(current.payment_intent)
          if (['canceled','requires_payment_method'].includes(intent.status)) await releaseCheckout(env.DB,current.id)
        }
      }
    }
    if (['refund.created','refund.updated','refund.failed'].includes(event.type)) {
      const refund=await stripe.refunds.retrieve(event.data.object.id)
      await syncRefund(env,refund,new URL(request.url).origin,stripe)
    }
  } catch { return new Response('Payment reconciliation is awaiting retry', {status:500}) }

  if (isPaidShopCheckoutEvent(event)) {
    const session = event.data.object
    try {
      await recordOrder(env, stripe, session, new URL(request.url).origin)
    } catch (err) {
      // Stripe retries on a non-2xx, which is what we want here: this only fires on
      // a genuine write failure (or two retried deliveries racing each other), and
      // the idempotency check above makes a retry safe either way.
      console.error('webhook: paid order or notification is awaiting retry')
      return new Response(JSON.stringify({ received: false, error: 'Order processing is awaiting retry' }), {
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

export function isPaidShopCheckoutEvent(event) {
  return ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event?.type)
    && event.data?.object?.metadata?.store === 'salty-lamps'
    && event.data.object.payment_status === 'paid'
    && event.data.object.status === 'complete'
}

async function recordOrder(env, stripe, session, origin) {
  const db = env.DB
  const existing = await db.prepare('SELECT id FROM orders WHERE id = ?').bind(session.id).first()
  if (existing) return resumeOrderNotifications(env, session.id, origin, stripe)

  const lineItems = { data: await allCheckoutLines(stripe, session.id) }
  const submitted = await checkoutAddress(db, session.id)
  if (session.metadata?.checkout_version === '2' && !submitted) throw new Error('Checkout delivery snapshot missing')

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
  const ship = submitted ? { name: submitted.name, address: { line1: submitted.line1, line2: submitted.line2, city: submitted.city, postal_code: submitted.postcode, country: 'GB' } } : session.shipping_details || session.collected_information?.shipping_details || {}
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
      submitted?.email || session.customer_details?.email || null,
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
  statements.push(db.prepare("UPDATE checkout_reservations SET status='consumed' WHERE session_id=? AND status='active'").bind(session.id))

  for (const line of lineItems.data) {
    // sku_id was stamped into the Stripe product's metadata in checkout.js, straight
    // from the D1-verified row — more trustworthy than anything echoed from the client.
    const skuId = Number(line.price?.product?.metadata?.sku_id)
    if (!Number.isSafeInteger(skuId) || skuId < 1 || !Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new Error('Paid order contains an invalid item')

    orderedBySkuId.set(skuId, (orderedBySkuId.get(skuId) || 0) + line.quantity)

    statements.push(
      db.prepare(
        `INSERT INTO order_items (order_id, sku_id, quantity, unit_price_pence, frame_choices_json) VALUES (?, ?, ?, ?, ?)`
      ).bind(session.id, skuId, line.quantity, line.price.unit_amount, line.price?.product?.metadata?.frame_choices ? JSON.stringify(frameChoicesFromMetadata(line.price.product.metadata.frame_choices, line.quantity)) : null)
    )

    const recordedWeights=weightsFromMetadata(line.price?.product?.metadata||{})
    statements.push(db.prepare(`INSERT INTO order_item_weights(order_id,sku_id,${WEIGHT_FIELDS.join(',')}) VALUES (?,?,?,?,?,?,?)`).bind(session.id,skuId,...WEIGHT_FIELDS.map(k=>recordedWeights[k])))

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

  statements.push(db.prepare('INSERT INTO order_notification_jobs(order_id,payload) VALUES(?,?)')
    .bind(session.id,JSON.stringify({session, ordered:[...orderedBySkuId], before:[...before]})))
  await db.batch(statements)
  await resumeOrderNotifications(env,session.id,origin,stripe)
}

export async function resumeOrderNotifications(env,orderId,origin,stripe) {
  const job=await env.DB.prepare('SELECT * FROM order_notification_jobs WHERE order_id=?').bind(orderId).first()
  if (!job) return deliverOrderEmails(env,orderId,origin) // also handles refund-only jobs
  if (!job.prepared) {
    const {session,ordered,before}=JSON.parse(job.payload)
    const messages=await prepareOrderEmails(env,env.DB,session,new Map(ordered),new Map(before),origin,stripe)
    await env.DB.batch([
      ...messages.map((message,index)=>emailJobStatement(env.DB,`order:${orderId}:${message.templateKey}:${index}`,orderId,message)),
      env.DB.prepare('UPDATE order_notification_jobs SET prepared=1 WHERE order_id=?').bind(orderId),
    ])
  }
  await deliverOrderEmails(env,orderId,origin)
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

async function prepareOrderEmails(env, db, session, orderedBySkuId, before, origin, stripe) {
  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(session.id).first()
  if (!order) throw new Error('Notification order missing')

  const items = await db.prepare(
    `SELECT oi.quantity, oi.unit_price_pence, oi.frame_choices_json, s.sku, s.variant_label, p.name,ow.product_weight_min_g,ow.product_weight_max_g,ow.weight_public
     FROM order_items oi
     JOIN skus s ON s.id = oi.sku_id
     JOIN products p ON p.id = s.product_id
     LEFT JOIN order_item_weights ow ON ow.order_id=oi.order_id AND ow.sku_id=oi.sku_id
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

  return messages
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
