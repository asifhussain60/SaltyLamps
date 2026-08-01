// GET /api/categories
// The storefront's category taxonomy: display name, description, hero image, theme,
// order, and the old-slug aliases that must keep resolving.
//
// Kept as its own endpoint rather than folded into /api/products because the two are
// fetched together with Promise.all — so latency is max(a, b), not a + b — and
// because categories change far less often than stock, which would make a shared
// cache key pessimal for both.
import { json, apiError } from '../lib/admin-helpers.mjs'

export async function onRequestGet({ env }) {
  try {
    const [categories, aliases] = await env.DB.batch([
      env.DB.prepare(
        `SELECT slug, name, description, image, theme, sort_order, is_virtual
         FROM categories WHERE visible = 1 ORDER BY sort_order, name`,
      ),
      env.DB.prepare(`SELECT alias, slug FROM category_aliases`),
    ])

    return json(
      {
        categories: categories.results || [],
        aliases: Object.fromEntries((aliases.results || []).map(r => [r.alias, r.slug])),
      },
      200,
      { 'cache-control': 'public, max-age=60' },
    )
  } catch (err) {
    // 503 rather than 500: this is a dependency outage, not a bug in the request,
    // and it tells the client to retry. no-store is the important part — the success
    // path carries a 60s edge cache, so caching a failure would freeze the shop
    // empty for a minute after a momentary blip.
    return apiError(`Could not load categories: ${err.message}`, 503, { code: 'catalog_unavailable' }, {
      'cache-control': 'no-store',
    })
  }
}
