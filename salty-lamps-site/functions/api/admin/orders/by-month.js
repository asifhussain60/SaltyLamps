// GET /api/admin/orders/by-month — paid orders grouped by calendar month, most recent first.
import { json, apiError } from '../../../lib/admin-helpers.mjs'

export async function onRequestGet({ env }) {
  try {
    const rows = await env.DB.prepare(
      `SELECT strftime('%Y-%m', created_at) month, COUNT(*) orders, COALESCE(SUM(amount_total_pence),0) revenue_pence
       FROM orders WHERE status='paid'
       GROUP BY month ORDER BY month DESC`,
    ).all()
    return json({ months: rows.results || [] })
  } catch (err) {
    return apiError(`Could not build monthly breakdown: ${err.message}`, 500, { code: 'server_error' })
  }
}
