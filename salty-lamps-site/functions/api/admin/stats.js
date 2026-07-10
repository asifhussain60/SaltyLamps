// GET /api/admin/stats — dashboard KPIs, recent orders, top products, sales series.
import { json, apiError } from '../../lib/admin-helpers.mjs'
import { LOW_STOCK_THRESHOLD } from '../../lib/validation.mjs'

export async function onRequestGet({ env }) {
  const db = env.DB
  try {
    const stmts = [
      db.prepare(`SELECT COALESCE(SUM(amount_total_pence),0) v, COUNT(*) c FROM orders WHERE status='paid' AND created_at >= date('now')`),
      db.prepare(`SELECT COALESCE(SUM(amount_total_pence),0) v, COUNT(*) c FROM orders WHERE status='paid' AND created_at >= date('now','-6 days')`),
      db.prepare(`SELECT COALESCE(SUM(amount_total_pence),0) v, COUNT(*) c FROM orders WHERE status='paid' AND created_at >= date('now','start of month')`),
      db.prepare(`SELECT COALESCE(SUM(amount_total_pence),0) v, COUNT(*) c FROM orders WHERE status='paid'`),
      db.prepare(`SELECT COUNT(*) c FROM orders WHERE status='paid' AND fulfilment_status='unfulfilled'`),
      db.prepare(`SELECT COUNT(*) c FROM skus WHERE track_mode='quantity' AND quantity > 0 AND quantity <= ?`).bind(LOW_STOCK_THRESHOLD),
      db.prepare(`SELECT COUNT(*) c FROM skus WHERE (track_mode='quantity' AND quantity <= 0) OR (track_mode='binary' AND in_stock=0)`),
      db.prepare(`SELECT id, created_at, customer_email, amount_total_pence, status, fulfilment_status FROM orders ORDER BY created_at DESC LIMIT 5`),
      db.prepare(`SELECT p.name, SUM(oi.quantity) qty, SUM(oi.quantity * oi.unit_price_pence) revenue_pence
                  FROM order_items oi
                  JOIN skus s ON s.id = oi.sku_id
                  JOIN products p ON p.id = s.product_id
                  JOIN orders o ON o.id = oi.order_id
                  WHERE o.status='paid'
                  GROUP BY p.id ORDER BY qty DESC LIMIT 5`),
      db.prepare(`SELECT date(created_at) day, COALESCE(SUM(amount_total_pence),0) revenue_pence, COUNT(*) orders
                  FROM orders WHERE status='paid' AND created_at >= date('now','-13 days')
                  GROUP BY day ORDER BY day`),
    ]
    const r = await db.batch(stmts)
    const one = i => r[i].results?.[0] || {}

    return json({
      revenue: {
        today_pence: one(0).v || 0,
        week_pence: one(1).v || 0,
        month_pence: one(2).v || 0,
        all_time_pence: one(3).v || 0,
      },
      orders: {
        today: one(0).c || 0,
        week: one(1).c || 0,
        month: one(2).c || 0,
        all_time: one(3).c || 0,
        unfulfilled: one(4).c || 0,
      },
      average_order_pence: (one(3).c || 0) > 0 ? Math.round((one(3).v || 0) / one(3).c) : 0,
      stock: {
        low_stock: one(5).c || 0,
        out_of_stock: one(6).c || 0,
        low_stock_threshold: LOW_STOCK_THRESHOLD,
      },
      recent_orders: r[7].results || [],
      top_products: r[8].results || [],
      sales_series: r[9].results || [],
    })
  } catch (err) {
    return apiError(`Could not load dashboard: ${err.message}`, 500, { code: 'server_error' })
  }
}
