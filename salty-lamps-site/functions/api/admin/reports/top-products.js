// GET /api/admin/reports/top-products[?format=csv]
// Best sellers by units and revenue, plus a revenue-by-category breakdown.
import { json, apiError, toCsv, csvResponse } from '../../../lib/admin-helpers.mjs'

export async function onRequestGet({ request, env }) {
  const format = new URL(request.url).searchParams.get('format')

  try {
    const [top, categories] = await env.DB.batch([
      env.DB.prepare(
        `SELECT p.id, p.name, SUM(oi.quantity) units, SUM(oi.quantity * oi.unit_price_pence) revenue_pence
         FROM order_items oi
         JOIN skus s ON s.id = oi.sku_id
         JOIN products p ON p.id = s.product_id
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status='paid'
         GROUP BY p.id ORDER BY units DESC LIMIT 50`,
      ),
      // Category revenue: a product may list several comma-separated categories; we
      // attribute its full line revenue to each, so this is a tag-style breakdown.
      env.DB.prepare(
        `SELECT p.categories, SUM(oi.quantity * oi.unit_price_pence) revenue_pence
         FROM order_items oi
         JOIN skus s ON s.id = oi.sku_id
         JOIN products p ON p.id = s.product_id
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status='paid'
         GROUP BY p.categories`,
      ),
    ])

    // Fan out comma-separated categories into per-slug totals.
    const catTotals = new Map()
    for (const row of categories.results || []) {
      for (const slug of String(row.categories || '').split(',').filter(Boolean)) {
        catTotals.set(slug, (catTotals.get(slug) || 0) + row.revenue_pence)
      }
    }
    const byCategory = [...catTotals.entries()]
      .map(([category, revenue_pence]) => ({ category, revenue_pence }))
      .sort((a, b) => b.revenue_pence - a.revenue_pence)

    if (format === 'csv') {
      const csv = toCsv(top.results || [], [
        { key: 'name', label: 'Product' },
        { key: 'units', label: 'Units sold' },
        { key: 'revenue_pence', label: 'Revenue (pence)' },
      ])
      return csvResponse(csv, 'top-products.csv')
    }

    return json({ top_products: top.results || [], by_category: byCategory })
  } catch (err) {
    return apiError(`Could not build product report: ${err.message}`, 500, { code: 'server_error' })
  }
}
