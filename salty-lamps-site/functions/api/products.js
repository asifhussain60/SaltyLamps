// GET /api/products
// Flattens D1 products+skus into one flat "product card" per SKU, matching the
// shape the storefront already renders (a product with variants becomes one
// card per variant, since the UI has no in-page variant picker today).

import { PRODUCTS_QUERY, flattenProductRows } from '../lib/flatten-products.mjs'

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(PRODUCTS_QUERY).all()
  const products = flattenProductRows(results)

  return new Response(JSON.stringify({ products }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
  })
}
