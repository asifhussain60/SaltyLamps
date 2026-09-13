import Stripe from 'stripe'

export function paidCheckoutSummary(session) {
  if (!session || session.metadata?.store !== 'salty-lamps') return null
  if (session.status !== 'complete' || session.payment_status !== 'paid') return null
  return {
    status: 'paid',
    orderReference: String(session.id || '').replace(/^cs_(?:test_|live_)?/, '').slice(-12),
  }
}

export async function onRequestGet({ request, env }) {
  const sessionId = new URL(request.url).searchParams.get('session_id') || ''
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9_]{8,200}$/.test(sessionId)) {
    return json({ error: 'A valid checkout session is required.' }, 400)
  }
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Payment verification is unavailable.' }, 503)

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: '2024-06-20',
  })

  try {
    const summary = paidCheckoutSummary(await stripe.checkout.sessions.retrieve(sessionId))
    if (!summary) return json({ error: 'Payment is not confirmed.' }, 409)
    return json(summary, 200)
  } catch {
    return json({ error: 'Payment could not be confirmed.' }, 404)
  }
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
