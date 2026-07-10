// POST /api/webhook — Stripe webhook endpoint.
// Configure this URL in the Stripe dashboard (Developers > Webhooks) listening
// for `checkout.session.completed`, then store the signing secret as a Pages
// Function secret: wrangler pages secret put STRIPE_WEBHOOK_SECRET
//
// Requires: DB (D1 binding), STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

import Stripe from 'stripe'

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
    await recordOrder(env.DB, stripe, session)
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

async function recordOrder(db, stripe, session) {
  const existing = await db.prepare('SELECT id FROM orders WHERE id = ?').bind(session.id).first()
  if (existing) return // already processed (Stripe may retry webhooks)

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ['data.price.product'],
  })

  const statements = [
    db.prepare(
      `INSERT INTO orders (id, payment_intent, status, customer_email, amount_total_pence, currency)
       VALUES (?, ?, 'paid', ?, ?, ?)`
    ).bind(session.id, session.payment_intent, session.customer_details?.email ?? null, session.amount_total, session.currency),
  ]

  for (const line of lineItems.data) {
    // sku_id was stamped into the Stripe product's metadata in checkout.js, straight
    // from the D1-verified row — more trustworthy than anything echoed from the client.
    const skuId = Number(line.price?.product?.metadata?.sku_id)
    if (!Number.isInteger(skuId)) continue // metadata missing — skip rather than write a bad row

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

  await db.batch(statements)
}
