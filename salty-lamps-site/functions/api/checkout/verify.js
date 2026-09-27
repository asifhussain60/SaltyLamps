import Stripe from 'stripe'
import { stripeModeAllowed } from '../../lib/stripe-mode.mjs'
import { allCheckoutLines, checkoutAddress } from '../../lib/checkout-state.mjs'
import { orderRef } from '../../lib/email-render.mjs'

export function paidCheckoutSummary(session, { imagesBySkuId = new Map(), emailDelivery = null } = {}) {
  if (!session || session.metadata?.store !== 'salty-lamps') return null
  if (session.status !== 'complete' || session.payment_status !== 'paid') return null
  const customerEmail = session.customer_details?.email || ''
  const shipping = session.shipping_details
    || session.collected_information?.shipping_details
    || session.customer_details
    || {}
  const address = shipping.address || session.customer_details?.address || {}
  const lines = session.line_items?.data || []
  return {
    status: 'paid',
    orderReference: orderRef(session.id),
    placedAt: Number.isFinite(session.created) ? new Date(session.created * 1000).toISOString() : null,
    customerEmail,
    delivery: {
      name: shipping.name || session.customer_details?.name || '',
      city: address.city || '',
      postcode: address.postal_code || '',
      service: session.shipping_cost?.shipping_rate?.display_name || '',
    },
    emailDelivery: emailDelivery || { status: 'processing', to: customerEmail },
    items: lines.map((line, index) => {
      const product = typeof line.price?.product === 'object' ? line.price.product : null
      const skuId = Number(product?.metadata?.sku_id)
      return {
        id: line.id || `item-${index}`,
        skuId: Number.isSafeInteger(skuId) ? skuId : null,
        name: line.description || product?.name || 'Ordered item',
        quantity: Number(line.quantity) || 0,
        unitPricePence: Number(line.price?.unit_amount) || 0,
        totalPence: Number(line.amount_total) || 0,
        image: Number.isSafeInteger(skuId) ? imagesBySkuId.get(skuId) || '' : '',
      }
    }),
    totals: {
      itemsPence: Number(session.amount_subtotal) || 0,
      deliveryPence: Number(session.shipping_cost?.amount_total ?? session.total_details?.amount_shipping) || 0,
      totalPence: Number(session.amount_total) || 0,
    },
  }
}

export async function onRequestGet({ request, env }) {
  const sessionId = new URL(request.url).searchParams.get('session_id') || ''
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9_]{8,200}$/.test(sessionId)) {
    return json({ error: 'A valid checkout session is required.' }, 400)
  }
  if (!env.STRIPE_SECRET_KEY || !stripeModeAllowed(env)) return json({ error: 'Payment verification is unavailable.' }, 503)

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: '2024-06-20',
  })

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price.product', 'shipping_cost.shipping_rate'],
    })
    if (session.metadata?.store !== 'salty-lamps' || session.status !== 'complete' || session.payment_status !== 'paid') return json({ error: 'Payment is not confirmed.' }, 409)
    session.line_items = { data: await allCheckoutLines(stripe, session.id), has_more: false }
    const address = await checkoutAddress(env.DB, session.id)
    if (address) session.shipping_details = { name: address.name, address: { city: address.city, postal_code: address.postcode } }
    const summary = paidCheckoutSummary(session, await readPresentationDetails(env.DB, session))
    if (!summary) return json({ error: 'Payment is not confirmed.' }, 409)
    return json(summary, 200)
  } catch {
    return json({ error: 'Payment could not be confirmed.' }, 404)
  }
}

async function readPresentationDetails(db, session) {
  const lines = session?.line_items?.data || []
  const skuIds = [...new Set(lines
    .map(line => Number(typeof line.price?.product === 'object' ? line.price.product?.metadata?.sku_id : null))
    .filter(Number.isSafeInteger))]
  const imagesBySkuId = new Map()

  if (db && skuIds.length) {
    try {
      const placeholders = skuIds.map(() => '?').join(',')
      const { results } = await db.prepare(
        `SELECT s.id, COALESCE(pi.path, p.image, '') AS image
         FROM skus s
         JOIN products p ON p.id = s.product_id
         LEFT JOIN sku_images si ON si.sku_id = s.id
         LEFT JOIN product_images pi ON pi.id = si.image_id AND pi.product_id = p.id
         WHERE s.id IN (${placeholders})`,
      ).bind(...skuIds).all()
      for (const row of results || []) imagesBySkuId.set(Number(row.id), row.image || '')
    } catch {
      // Product pictures improve the receipt but must never block confirmation.
    }
  }

  const customerEmail = session?.customer_details?.email || ''
  let emailDelivery = { status: 'processing', to: customerEmail }
  if (db) {
    try {
      const row = await db.prepare(
        `SELECT status, to_address FROM email_outbox
         WHERE order_id = ? AND template_key = 'order_confirmation'
         ORDER BY id DESC LIMIT 1`,
      ).bind(session.id).first()
      const job=await db.prepare("SELECT status FROM commerce_email_jobs WHERE order_id=? AND json_extract(payload,'$.templateKey')='order_confirmation' LIMIT 1").bind(session.id).first()
      if (job?.status === 'sent') emailDelivery = { status: 'sent', to: row?.to_address || customerEmail }
      else if (job && ['failed','review'].includes(job.status)) emailDelivery = { status: 'failed', to: customerEmail }
      else if (row?.status === 'sent') emailDelivery = { status: 'sent', to: row.to_address || customerEmail }
      else if (row?.status === 'failed') emailDelivery = { status: 'failed', to: row.to_address || customerEmail }
      else if (row?.status === 'skipped') emailDelivery = { status: 'disabled', to: row.to_address || customerEmail }
    } catch {
      // The Stripe receipt still renders while the order webhook finishes writing.
    }
  }

  return { imagesBySkuId, emailDelivery }
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, no-cache, must-revalidate, private',
    },
  })
}
