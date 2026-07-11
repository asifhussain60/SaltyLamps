// GET /api/admin/orders/by-year — paid orders grouped by calendar year, most recent first.
import { json, apiError } from '../../../lib/admin-helpers.mjs'

export async function onRequestGet({ env }) {
  try {
    const rows = await env.DB.prepare(
      `SELECT strftime('%Y', created_at) year, COUNT(*) orders, COALESCE(SUM(amount_total_pence),0) revenue_pence
       FROM orders WHERE status='paid'
       GROUP BY year ORDER BY year DESC`,
    ).all()
    return json({ years: rows.results || [] })
  } catch (err) {
    return apiError(`Could not build yearly breakdown: ${err.message}`, 500, { code: 'server_error' })
  }
}
