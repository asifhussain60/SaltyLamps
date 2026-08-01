// POST /api/checkout
// Body: { items: [{ skuId: number, quantity: number }] }
// Looks up each line server-side in D1 (never trusts a client-sent price),
// then creates a Stripe Checkout Session and returns its hosted URL.
//
// Requires these Cloudflare Pages secrets/bindings:
//   DB                  -> D1 database binding (see wrangler.toml)
//   STRIPE_SECRET_KEY   -> Pages Function secret (wrangler pages secret put)
//   SITE_URL            -> e.g. https://www.saltylamps.co.uk (for success/cancel redirects)

import Stripe from 'stripe'

// Makes Stripe's hosted checkout look like the rest of the shop rather than a
// stranger's payment page. Applied per session, so it needs no dashboard access
// and follows the code between environments.
//
// Colours are the storefront's own tokens from src/styles/saltylamps.css:
// --paper for the page surround and --ember for the primary button. Corner style
// matches --radius: 10px.
//
// FONT IS A SUBSTITUTION, NOT A MATCH. Stripe accepts a fixed list and the site's
// own faces (Urbanist, DM Sans, Outfit, Manrope) are not on it. Inter is the
// closest available in weight and proportion to DM Sans, which sets the site's
// body copy. The permitted list is in the API error for an invalid value.
//
// THE LOGO IS NOT HERE, AND CANNOT BE. branding_settings[logo] rejects a
// Files-API id on this account — the same "Invalid object" it returns for a
// nonsense id — so the mark has to be uploaded once under Stripe → Settings →
// Branding. Checkout falls back to the dashboard value for any field omitted
// here, so the logo appears on every session once it is set, with no code change.
const BRANDING = {
  display_name: 'Salty Lamps',
  background_color: '#f7efe6',
  button_color: '#9b4328',
  font_family: 'inter',
  border_style: 'rounded',
}

export async function onRequestPost({ request, env }) {
  let body
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  const items = Array.isArray(body?.items) ? body.items : []
  if (items.length === 0) return jsonError('Cart is empty', 400)

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: '2024-06-20',
  })

  const lineItems = []
  for (const item of items) {
    const skuId = Number(item?.skuId)
    const quantity = Number(item?.quantity)
    if (!Number.isInteger(skuId) || !Number.isInteger(quantity) || quantity < 1) {
      return jsonError('Invalid cart line', 400)
    }

    const row = await env.DB.prepare(
      `SELECT s.id, s.sku, s.variant_label, s.price_pence, s.track_mode, s.quantity, s.in_stock, p.name
       FROM skus s JOIN products p ON p.id = s.product_id
       WHERE s.id = ?`
    ).bind(skuId).first()

    if (!row) return jsonError(`Unknown item in cart (sku id ${skuId})`, 400)

    const available = row.track_mode === 'binary' ? row.in_stock === 1 : (row.quantity ?? 0) >= quantity
    if (!available) return jsonError(`${row.name}${row.variant_label ? ` (${row.variant_label})` : ''} is out of stock`, 409)

    lineItems.push({
      quantity,
      price_data: {
        currency: 'gbp',
        unit_amount: row.price_pence,
        product_data: {
          name: row.variant_label ? `${row.name} — ${row.variant_label}` : row.name,
          metadata: { sku_id: String(row.id), sku: row.sku },
        },
      },
    })
  }

  const siteUrl = env.SITE_URL || new URL(request.url).origin
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    shipping_address_collection: { allowed_countries: ['GB'] },
    branding_settings: BRANDING,
    success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/checkout/cancelled`,
  })

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
