// GET /api/admin/orders/by-year — paid orders grouped by calendar year, most recent first.
//
// London years, via the same helper as by-month, though the year boundary is the
// one boundary that was never actually wrong: the UK is on GMT every 1 January, so
// the London year and the UTC year have always coincided. It goes through
// shop-time.mjs anyway for two reasons — a year total that disagreed with the sum
// of its months would be a bug report nobody could reproduce, and the next person
// to read this should not have to work out which of the three groupings is the
// special case.
import { json, apiError } from '../../../lib/admin-helpers.mjs'
import { bucketByLondonPeriod, londonYear } from '../../../lib/shop-time.mjs'

export async function onRequestGet({ env }) {
  try {
    const rows = await env.DB.prepare(
      `SELECT strftime('%Y-%m-%dT%H', created_at) hour, COUNT(*) orders, COALESCE(SUM(amount_total_pence),0) revenue_pence
       FROM orders WHERE status='paid'
       GROUP BY hour ORDER BY hour`,
    ).all()
    const years = bucketByLondonPeriod(rows.results || [], londonYear)
      .map(({ key, orders, revenue_pence }) => ({ year: key, orders, revenue_pence }))
      .reverse()
    return json({ years })
  } catch (err) {
    return apiError(`Could not build yearly breakdown: ${err.message}`, 500, { code: 'server_error' })
  }
}
