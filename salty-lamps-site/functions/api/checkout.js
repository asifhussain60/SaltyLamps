import { formatFrameChoices } from '../lib/frame-orientation.mjs'
import {weightMetadata,weightLabel,quotePostage} from '../lib/weights.mjs'
import {readPostageConfig} from '../lib/postage-store.mjs'
import { CartError, readCheckoutCart, normaliseCart } from '../lib/cart.mjs'
import { deliveryMessage } from './checkout/delivery.js'
// POST /api/checkout
// Body: { items: [{ skuId: number, quantity: number }], postcode: string, address: object }
// Looks up each line server-side in D1 (never trusts a client-sent price),
// then creates a Stripe Checkout Session for the payment form on our site.
//
// Requires these Cloudflare Pages secrets/bindings:
//   DB                  -> D1 database binding (see wrangler.toml)
//   STRIPE_SECRET_KEY   -> Pages Function secret (wrangler pages secret put)
//   STRIPE_PUBLISHABLE_KEY -> matching Stripe publishable key for embedded Checkout

import Stripe from 'stripe'
import { reconcileExpiredCheckouts, checkoutAttemptId, checkoutFingerprint, readCheckoutAttempt, resumeCheckoutAttempt, replaceCheckoutAttempt } from '../lib/checkout-state.mjs'

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
    const address = readUkAddress(body?.address)
    if (normalisePostcode(body?.postcode) !== normalisePostcode(address.postcode)) {
      throw new CartError('Your delivery postcode changed. Please review the address and try again.')
    }
    if (!env.STRIPE_SECRET_KEY) return jsonError('Payment is temporarily unavailable. Your cart is saved; please try again later.', 503)
    const testMode = env.STRIPE_SECRET_KEY.startsWith('sk_test_')
    const publishableKey = env.STRIPE_PUBLISHABLE_KEY || ''
    if (!publishableKey.startsWith(testMode ? 'pk_test_' : 'pk_live_')) {
      return jsonError('Payment is temporarily unavailable. Your cart is saved; please try again later.', 503)
    }
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: testMode ? '2025-04-30.basil' : '2024-06-20',
    })
    const attemptId=checkoutAttemptId(body?.checkoutAttemptId)
    const fingerprint=checkoutFingerprint(address,normaliseCart(body?.items))
    const previousId=body?.previousCheckoutAttemptId ? checkoutAttemptId(body.previousCheckoutAttemptId) : null
    if (previousId && previousId!==attemptId) await replaceCheckoutAttempt(env.DB,stripe,previousId)
    const existingAttempt=await readCheckoutAttempt(env.DB,attemptId)
    if (existingAttempt) return paymentResponse(await resumeCheckoutAttempt(env.DB,stripe,existingAttempt,fingerprint),publishableKey)
    await reconcileExpiredCheckouts(env.DB, stripe)
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
            name: [row.variant_label ? `${row.name} — ${row.variant_label}` : row.name, formatFrameChoices(row.frame_choices)].filter(Boolean).join(' · '),
            metadata: { sku_id: String(row.id), sku: row.sku, ...(row.frame_choices ? { frame_choices: JSON.stringify(row.frame_choices) } : {}), ...weightMetadata(row) },
            ...(row.weight_public===1 && row.product_weight_min_g!=null ? {description: `Product weight: ${weightLabel({productWeightMinG:row.product_weight_min_g,productWeightMaxG:row.product_weight_max_g})} per item or pack, excluding packaging.`} : {}),
          },
        },
      })
    }

    const postcode = address.postcode
    const postage = quotePostage(rows, await readPostageConfig(env.DB), { country: 'GB', postcode })
    if (postage.status !== 'ready') {
      return jsonError(deliveryMessage(postage), 409)
    }

    // Return to the same storefront that started payment (proposal or live).
    const siteUrl = new URL(request.url).origin
    // The shopper completed the address on our UK address screen. Persist it on
    // the Customer and payment; the local immutable snapshot drives fulfilment.
    const customer = await stripe.customers.create({
      email: address.email,
      name: address.name,
      shipping: {
        name: address.name,
        address: { country: 'GB', line1: address.line1, ...(address.line2 ? { line2: address.line2 } : {}), city: address.city, postal_code: address.postcode },
      },
    }, { idempotencyKey: `customer:${attemptId}` })
    const parameters = {
      mode: 'payment',
      ui_mode: 'embedded',
      redirect_on_completion: 'if_required',
      customer: customer.id,
      locale: 'en-GB',
      // Link owns its verification code screen, so our application cannot make
      // arbitrary codes pass. Test checkout disables Link per session instead:
      // testers go straight to the ordinary card form without an email/phone OTP.
      ...(testMode ? {
        payment_method_types: ['card'],
        wallet_options: { link: { display: 'never' } },
      } : {}),
      metadata: { store: 'salty-lamps', checkout_version: '2' },
      line_items: lineItems,
      // The address was validated and priced before payment. Keep it immutable.
      payment_intent_data: { shipping: customerShipping(address) },
      expires_at: Math.floor(Date.now() / 1000) + 35 * 60,
      shipping_options: postage.options.slice(0, 5).map(option => ({
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: option.price_pence, currency: 'gbp' },
          display_name: option.service,
          metadata: { postage_rate_id: option.id, total_weight_g: String(postage.total_weight_g), parcel_count: String(option.parcel_count || 1) },
        },
      })),
      branding_settings: BRANDING,
      return_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    }
    await env.DB.prepare('INSERT OR IGNORE INTO checkout_attempts(id,fingerprint,parameters_json,rows_json,address_json,created_at) VALUES(?,?,?,?,?,?)')
      .bind(attemptId,fingerprint,JSON.stringify(parameters),JSON.stringify(rows),JSON.stringify(address),Math.floor(Date.now()/1000)).run()
    const attempt=await readCheckoutAttempt(env.DB,attemptId)
    const session=await resumeCheckoutAttempt(env.DB,stripe,attempt,fingerprint)
    return paymentResponse(session,publishableKey)
  } catch (error) {
    return jsonError(error instanceof CartError ? error.message : 'Checkout is temporarily unavailable. Your cart is saved; please try again.', error instanceof CartError ? error.status : 503, error instanceof CartError ? error.code : undefined)
  }
}

function paymentResponse(session,publishableKey) {
  return new Response(JSON.stringify({clientSecret:session.client_secret,sessionId:session.id,publishableKey}),{status:200,headers:{'content-type':'application/json','cache-control':'no-store'}})
}

function customerShipping(address) {
  return { name: address.name, address: { country: 'GB', line1: address.line1, ...(address.line2 ? { line2: address.line2 } : {}), city: address.city, postal_code: address.postcode } }
}

function normalisePostcode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, '') : ''
}

function readUkAddress(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CartError('Complete your UK delivery address before payment.')
  const field = (key, max) => typeof raw[key] === 'string' ? raw[key].trim().slice(0, max + 1) : ''
  const email = field('email', 254)
  const name = field('name', 100)
  const line1 = field('line1', 150)
  const line2 = field('line2', 150)
  const city = field('city', 100)
  const postcode = normalisePostcode(raw.postcode)
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CartError('Enter a valid email address.')
  if (!name || name.length > 100 || !line1 || line1.length > 150 || line2.length > 150 || !city || city.length > 100) {
    throw new CartError('Complete your UK delivery address before payment.')
  }
  if (!/^(GIR0AA|(?:[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}))$/.test(postcode)) throw new CartError('Enter a valid UK postcode.')
  return { email, name, line1, line2, city, postcode: `${postcode.slice(0, -3)} ${postcode.slice(-3)}` }
}

function jsonError(message, status, code) {
  return new Response(JSON.stringify({ error: message, ...(code ? {code} : {}) }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
