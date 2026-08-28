// GET /api/admin/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD[&format=csv]
// Daily paid-sales series plus totals for the window (default: last 30 days).
//
// The dates in the query string are the LONDON dates the owner typed, and the
// series is grouped by London day. `created_at` is stored in UTC, so both the
// window boundaries and the day each order falls in have to be resolved against
// Europe/London before any of this is true — see ../../../lib/shop-time.mjs for
// what was wrong before and why.
import { json, apiError, toCsv, csvResponse, fillDailySeries } from '../../../lib/admin-helpers.mjs'
import { bucketByLondonPeriod, londonDate, londonDayStartUtc, shiftLondonDate, shopWindows } from '../../../lib/shop-time.mjs'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const from = DATE_RE.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : null
  const to = DATE_RE.test(url.searchParams.get('to') || '') ? url.searchParams.get('to') : null
  const format = url.searchParams.get('format')

  const w = shopWindows()
  // `to` is inclusive to the reader, so the exclusive bound is the following day.
  const fromDate = from || w.salesDefaultFromDate
  const toExclusiveDate = shiftLondonDate(to || w.today, 1)
  const fromBound = londonDayStartUtc(fromDate)
  const toBound = londonDayStartUtc(toExclusiveDate)

  try {
    // Hourly, then re-bucketed in JS: SQLite cannot tell which London day a UTC
    // timestamp belongs to, and through BST a quarter of the evening's orders sit
    // on the wrong side of midnight.
    const rows = await env.DB.prepare(
      `SELECT strftime('%Y-%m-%dT%H', created_at) hour, COALESCE(SUM(amount_total_pence),0) revenue_pence, COUNT(*) orders
       FROM orders
       WHERE status='paid' AND created_at >= ? AND created_at < ?
       GROUP BY hour ORDER BY hour`,
    ).bind(fromBound, toBound).all()

    const sparse = bucketByLondonPeriod(rows.results || [], londonDate)
      .map(({ key, revenue_pence, orders }) => ({ day: key, revenue_pence, orders }))
    const totals = sparse.reduce(
      (acc, r) => ({ revenue_pence: acc.revenue_pence + r.revenue_pence, orders: acc.orders + r.orders }),
      { revenue_pence: 0, orders: 0 },
    )
    // Zero-filled day by day so the chart's x-axis spacing stays accurate and a
    // window with little data does not render degenerately.
    const series = fillDailySeries(sparse, fromDate, toExclusiveDate)

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
