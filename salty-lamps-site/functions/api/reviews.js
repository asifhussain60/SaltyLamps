// GET /api/reviews
// The full guestbook corpus, for /reviews only.
//
// Split out from /api/content deliberately. This is ~195 rows that one page needs;
// bundling it into the content payload would put it on every page load. It used to
// be worse than that — reviews.json was imported straight into src/App.jsx, so the
// corpus shipped inside the JavaScript bundle on every single page view.
//
// WHERE display = 1 is the ASA filter. A republished testimonial making a medical or
// air-treatment claim counts as a marketing claim, so those rows are suppressed at
// write time and never leave the server. Enforcing it in SQL rather than in the
// client means a suppressed quote cannot reach a browser at all.
import { json, apiError } from '../lib/admin-helpers.mjs'

export async function onRequestGet({ env }) {
  try {
    const rows = await env.DB.prepare(
      `SELECT id, name, date_text, quote, proof, rating, featured, featured_order
       FROM reviews WHERE display = 1 ORDER BY featured DESC, featured_order, name`,
    ).all()

    return json(
      {
        reviews: (rows.results || []).map(r => ({
          id: r.id, name: r.name, date: r.date_text, quote: r.quote,
          proof: r.proof, rating: r.rating, featured: !!r.featured,
        })),
      },
      200,
      { 'cache-control': 'public, max-age=300' },
    )
  } catch (err) {
    return apiError(`Could not load reviews: ${err.message}`, 503, { code: 'content_unavailable' }, {
      'cache-control': 'no-store',
    })
  }
}
