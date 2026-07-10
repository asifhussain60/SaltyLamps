// GET /api/admin/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD[&format=csv]
// Daily paid-sales series plus totals for the window (default: last 30 days).
import { json, apiError, toCsv, csvResponse } from '../../../lib/admin-helpers.mjs'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const from = DATE_RE.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : null
  const to = DATE_RE.test(url.searchParams.get('to') || '') ? url.searchParams.get('to') : null
  const format = url.searchParams.get('format')

  // Bound the window; SQLite resolves the defaults when a param is absent.
  const fromExpr = from ? '?' : `date('now','-29 days')`
  const toExpr = to ? `date(?, '+1 day')` : `date('now','+1 day')`
  const binds = []
  if (from) binds.push(from)
  if (to) binds.push(to)

  try {
    const rows = await env.DB.prepare(
      `SELECT date(created_at) day, COALESCE(SUM(amount_total_pence),0) revenue_pence, COUNT(*) orders
       FROM orders
       WHERE status='paid' AND created_at >= ${fromExpr} AND created_at < ${toExpr}
       GROUP BY day ORDER BY day`,
    ).bind(...binds).all()

    const series = rows.results || []
    const totals = series.reduce(
      (acc, r) => ({ revenue_pence: acc.revenue_pence + r.revenue_pence, orders: acc.orders + r.orders }),
      { revenue_pence: 0, orders: 0 },
    )

    if (format === 'csv') {
      const csv = toCsv(series, [
        { key: 'day', label: 'Date' },
        { key: 'orders', label: 'Orders' },
        { key: 'revenue_pence', label: 'Revenue (pence)' },
      ])
      return csvResponse(csv, 'sales.csv')
    }

    return json({ series, totals })
  } catch (err) {
    return apiError(`Could not build sales report: ${err.message}`, 500, { code: 'server_error' })
  }
}
