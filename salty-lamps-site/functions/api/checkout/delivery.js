import { CartError, readCheckoutCart } from '../../lib/cart.mjs'
import { quotePostage } from '../../lib/weights.mjs'
import { readPostageConfig } from '../../lib/postage-store.mjs'
import { isUkPostcode } from '../../lib/uk-postcode.mjs'

export function deliveryMessage(postage) {
  return 'We could not prepare delivery for this order. Please try again.'
}

export async function onRequestPost({ request, env }) {
  try {
    let body
    try { body = await request.json() } catch { throw new CartError('Please check your cart and try again.') }
    const lines = await readCheckoutCart(env.DB, body?.items)
    const postcode = typeof body?.postcode === 'string' ? body.postcode.slice(0, 16) : ''
    if (postcode && !isUkPostcode(postcode)) throw new CartError('Enter a valid UK postcode.')
    const postage = quotePostage(lines, await readPostageConfig(env.DB), { country: 'GB', postcode })
    return json({
      status: postage.status,
      message: postage.status === 'ready' ? '' : deliveryMessage(postage),
      totalWeightG: postage.total_weight_g,
      options: postage.options.map(option => ({ service: option.service, pricePence: option.price_pence, parcelCount: option.parcel_count || 1 })),
    })
  } catch (error) {
    return json({ error: error instanceof CartError ? error.message : 'We could not check delivery. Please try again.' }, error instanceof CartError ? error.status : 503)
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
}
