// GET /api/content
// The whole marketing content layer in one response: collections and their sections,
// per-theme selling copy, policy pages, flat snippets, the ordered card lists, and
// the featured review quotes.
//
// ONE ENDPOINT, NOT NINE. Unlike categories and products — which are fetched together
// and change on very different schedules — these tables are all read by the first
// render of almost every route, are small, and change together when the owner edits
// copy. Nine round-trips to assemble one page would be strictly worse.
//
// The 195-row guestbook corpus is deliberately NOT here. Only /reviews needs it, so it
// has its own lazily-fetched endpoint; bundling it would put ~40 KB on every page load
// for a page most visitors never open.
//
// The queries and the response shape live in functions/lib/content-queries.mjs so the
// build-time snapshot reads exactly the same content through the D1 HTTP API.
import { json, apiError } from '../lib/admin-helpers.mjs'
import { CONTENT_QUERIES, CONTENT_QUERY_KEYS, shapeContent } from '../lib/content-queries.mjs'

export async function onRequestGet({ env }) {
  try {
    const results = await env.DB.batch(CONTENT_QUERIES.map(sql => env.DB.prepare(sql)))
    const sets = Object.fromEntries(CONTENT_QUERY_KEYS.map((key, i) => [key, results[i]?.results || []]))
    return json(shapeContent(sets), 200, { 'cache-control': 'public, max-age=60' })
  } catch (err) {
    // Same contract as /api/categories: 503 for a dependency outage, and no-store so a
    // momentary blip is not frozen into the 60s edge cache.
    return apiError(`Could not load content: ${err.message}`, 503, { code: 'content_unavailable' }, {
      'cache-control': 'no-store',
    })
  }
}
