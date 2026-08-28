// GET /api/admin/orders/by-month — paid orders grouped by calendar month, most recent first.
//
// "Calendar month" means the LONDON calendar. Grouping with strftime() on the
// stored UTC timestamp put every order taken in the last hour of a BST month into
// the month before it — see ../../../lib/shop-time.mjs.
import { json, apiError } from '../../../lib/admin-helpers.mjs'
import { bucketByLondonPeriod, londonMonth } from '../../../lib/shop-time.mjs'

export async function onRequestGet({ env }) {
  try {
    const rows = await env.DB.prepare(
      `SELECT strftime('%Y-%m-%dT%H', created_at) hour, COUNT(*) orders, COALESCE(SUM(amount_total_pence),0) revenue_pence
       FROM orders WHERE status='paid'
       GROUP BY hour ORDER BY hour`,
    ).all()
    const months = bucketByLondonPeriod(rows.results || [], londonMonth)
      .map(({ key, orders, revenue_pence }) => ({ month: key, orders, revenue_pence }))
      .reverse()
    return json({ months })
  } catch (err) {
    return apiError(`Could not build monthly breakdown: ${err.message}`, 500, { code: 'server_error' })
  }
}
