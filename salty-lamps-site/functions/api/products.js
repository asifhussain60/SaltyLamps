// GET /api/products
// Flattens D1 products+skus into one flat "product card" per SKU, matching the
// option records consumed by the storefront. The UI groups these by product
// and selects the matching option image, price and stock.

import { apiError } from '../lib/admin-helpers.mjs'
import { PRODUCTS_QUERY, PRODUCT_IMAGES_QUERY, flattenProductRows } from '../lib/flatten-products.mjs'
import { publicProduct } from '../lib/public-copy.mjs'

export async function onRequestGet({ env }) {
  try {
    const [cards, images] = await env.DB.batch([
      env.DB.prepare(PRODUCTS_QUERY),
      env.DB.prepare(PRODUCT_IMAGES_QUERY),
    ])
    const products = flattenProductRows(cards.results || [], images.results || []).map(publicProduct)

    return new Response(JSON.stringify({ products }), {
      status: 200,
      // Catalogue edits, stock changes and newly uploaded photos must be visible on
      // the next shop read. Browser and edge caching used to hold an old gallery for
      // up to a minute after the admin had already confirmed the change.
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  } catch (err) {
    // This used to be unhandled. A D1 failure threw, Pages returned a 500 HTML page,
    // and the storefront's `.catch(() => setProducts([]))` turned that into an empty
    // product list — which renders as "No matching products. Try another search
    // term." So during an outage the shop told customers they had searched wrong.
    //
    // 503 says "dependency down, retry"; no-store prevents a momentary failure from
    // being replayed after the database has recovered.
    return apiError(`Could not load the catalogue: ${err.message}`, 503, { code: 'catalog_unavailable' }, {
      'cache-control': 'no-store',
    })
  }
}
