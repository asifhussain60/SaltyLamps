// GET /api/products
// Flattens D1 products+skus into one flat "product card" per SKU, matching the
// shape the storefront already renders (a product with variants becomes one
// card per variant, since the UI has no in-page variant picker today).

import { apiError } from '../lib/admin-helpers.mjs'
import { PRODUCTS_QUERY, flattenProductRows } from '../lib/flatten-products.mjs'

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(PRODUCTS_QUERY).all()
    const products = flattenProductRows(results)

    return new Response(JSON.stringify({ products }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
    })
  } catch (err) {
    // This used to be unhandled. A D1 failure threw, Pages returned a 500 HTML page,
    // and the storefront's `.catch(() => setProducts([]))` turned that into an empty
    // product list — which renders as "No matching products. Try another search
    // term." So during an outage the shop told customers they had searched wrong.
    //
    // 503 says "dependency down, retry"; no-store stops the 60s edge cache on the
    // success path from freezing a momentary failure in place for a whole minute.
    return apiError(`Could not load the catalogue: ${err.message}`, 503, { code: 'catalog_unavailable' }, {
      'cache-control': 'no-store',
    })
  }
}
