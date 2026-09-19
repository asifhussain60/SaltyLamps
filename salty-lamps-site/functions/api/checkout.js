import {weightMetadata,weightLabel,quotePostage} from '../lib/weights.mjs'
import {readPostageConfig} from '../lib/postage-store.mjs'
import { CartError, readCheckoutCart } from '../lib/cart.mjs'
import { deliveryMessage } from './checkout/delivery.js'
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

  try {
    const rows = await readCheckoutCart(env.DB, body?.items)
    const lineItems = []
    for (const row of rows) {
      const quantity = row.quantity
      lineItems.push({
        quantity,
        price_data: {
          currency: 'gbp',
          unit_amount: row.price_pence,
          product_data: {
            name: row.variant_label ? `${row.name} — ${row.variant_label}` : row.name,
            metadata: { sku_id: String(row.id), sku: row.sku, ...weightMetadata(row) },
            ...(row.weight_public===1 && row.product_weight_min_g!=null ? {description: `Product weight: ${weightLabel({productWeightMinG:row.product_weight_min_g,productWeightMaxG:row.product_weight_max_g})} per item or pack, excluding packaging.`} : {}),
          },
        },
      })
    }

    const postage = quotePostage(rows, await readPostageConfig(env.DB), { country: 'GB' })
    if (postage.status !== 'ready') {
      return jsonError(deliveryMessage(postage), 409)
    }

    if (!env.STRIPE_SECRET_KEY) return jsonError('Payment is temporarily unavailable. Your cart is saved; please try again later.', 503)
    const testMode = env.STRIPE_SECRET_KEY.startsWith('sk_test_')
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: testMode ? '2025-04-30.basil' : '2024-06-20',
    })
    const siteUrl = env.SITE_URL || new URL(request.url).origin
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Link owns its verification code screen, so our application cannot make
      // arbitrary codes pass. Test checkout disables Link per session instead:
      // testers go straight to the ordinary card form without an email/phone OTP.
      ...(testMode ? {
        payment_method_types: ['card'],
        wallet_options: { link: { display: 'never' } },
      } : {}),
      metadata: { store: 'salty-lamps' },
      line_items: lineItems,
      shipping_address_collection: { allowed_countries: ['GB'] },
      shipping_options: postage.options.slice(0, 5).map(option => ({
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: option.price_pence, currency: 'gbp' },
          display_name: option.service,
          metadata: { postage_rate_id: option.id, total_weight_g: String(postage.total_weight_g), parcel_count: String(option.parcel_count || 1) },
        },
      })),
      branding_settings: BRANDING,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancelled`,
    })

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  } catch (error) {
    return jsonError(error instanceof CartError ? error.message : 'Checkout is temporarily unavailable. Your cart is saved; please try again.', error instanceof CartError ? error.status : 503)
  }
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
