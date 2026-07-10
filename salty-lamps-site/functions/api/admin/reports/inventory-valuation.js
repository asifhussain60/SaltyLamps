// GET /api/admin/reports/inventory-valuation[?format=csv]
// Stock-on-hand value (quantity SKUs) plus the low-stock and out-of-stock lists.
import { json, apiError, toCsv, csvResponse } from '../../../lib/admin-helpers.mjs'
import { LOW_STOCK_THRESHOLD } from '../../../lib/validation.mjs'

export async function onRequestGet({ request, env }) {
  const format = new URL(request.url).searchParams.get('format')

  try {
    const [valuation, lowStock, breakdown] = await env.DB.batch([
      env.DB.prepare(
        `SELECT COALESCE(SUM(price_pence * quantity),0) value_pence, COALESCE(SUM(quantity),0) units
         FROM skus WHERE track_mode='quantity'`,
      ),
      env.DB.prepare(
        `SELECT s.id, s.sku, s.variant_label, s.quantity, s.price_pence, s.track_mode, s.in_stock, p.name
         FROM skus s JOIN products p ON p.id = s.product_id
         WHERE (s.track_mode='quantity' AND s.quantity <= ?)
            OR (s.track_mode='binary' AND s.in_stock = 0)
         ORDER BY s.quantity ASC, p.name`,
      ).bind(LOW_STOCK_THRESHOLD),
      env.DB.prepare(
        `SELECT p.id, p.name, COALESCE(SUM(CASE WHEN s.track_mode='quantity' THEN s.price_pence * s.quantity ELSE 0 END),0) value_pence
         FROM products p JOIN skus s ON s.product_id = p.id
         GROUP BY p.id ORDER BY value_pence DESC`,
      ),
    ])

    if (format === 'csv') {
      const csv = toCsv(lowStock.results || [], [
        { key: 'name', label: 'Product' },
        { key: 'sku', label: 'SKU' },
        { key: 'variant_label', label: 'Variant' },
        { key: 'track_mode', label: 'Mode' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'in_stock', label: 'In stock' },
      ])
      return csvResponse(csv, 'low-stock.csv')
    }

    return json({
      valuation: valuation.results?.[0] || { value_pence: 0, units: 0 },
      low_stock_threshold: LOW_STOCK_THRESHOLD,
      low_or_out_of_stock: lowStock.results || [],
      by_product: breakdown.results || [],
    })
  } catch (err) {
    return apiError(`Could not build inventory report: ${err.message}`, 500, { code: 'server_error' })
  }
}
