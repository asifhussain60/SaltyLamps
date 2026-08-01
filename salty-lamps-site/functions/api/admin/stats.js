// GET /api/admin/stats — dashboard KPIs, recent orders, top products, sales series.
import { json, apiError, fillDailySeries, lowStockThreshold } from '../../lib/admin-helpers.mjs'

export async function onRequestGet({ env }) {
  const db = env.DB
  const today = new Date()
  const lowStock = await lowStockThreshold(db)
  const seriesFrom = new Date(today.getTime() - 13 * 86400000).toISOString().slice(0, 10)
  const seriesToExclusive = new Date(today.getTime() + 86400000).toISOString().slice(0, 10)
  try {
    const stmts = [
      db.prepare(`SELECT COALESCE(SUM(amount_total_pence),0) v, COUNT(*) c FROM orders WHERE status='paid' AND created_at >= date('now')`),
      db.prepare(`SELECT COALESCE(SUM(amount_total_pence),0) v, COUNT(*) c FROM orders WHERE status='paid' AND created_at >= date('now','-6 days')`),
      db.prepare(`SELECT COALESCE(SUM(amount_total_pence),0) v, COUNT(*) c FROM orders WHERE status='paid' AND created_at >= date('now','start of month')`),
      db.prepare(`SELECT COALESCE(SUM(amount_total_pence),0) v, COUNT(*) c FROM orders WHERE status='paid'`),
      db.prepare(`SELECT COUNT(*) c FROM orders WHERE status='paid' AND fulfilment_status='unfulfilled'`),
      db.prepare(`SELECT COUNT(*) c FROM skus WHERE track_mode='quantity' AND quantity > 0 AND quantity <= ?`).bind(lowStock),
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
      db.prepare(`SELECT COALESCE(SUM(oi.quantity),0) v
                  FROM order_items oi JOIN orders o ON o.id = oi.order_id
                  WHERE o.status='paid' AND o.created_at >= date('now')`),
      // A customer counts as "new" this week if their earliest-ever paid order falls in the window.
      db.prepare(`SELECT COUNT(*) c FROM (
                    SELECT customer_email FROM orders
                    WHERE status='paid' AND customer_email IS NOT NULL
                    GROUP BY customer_email
                    HAVING MIN(created_at) >= date('now','-6 days')
                  )`),
      db.prepare(`SELECT COUNT(DISTINCT o.id) orders, COALESCE(SUM(oi.quantity),0) units
                  FROM order_items oi JOIN orders o ON o.id = oi.order_id
                  WHERE o.status='paid' AND o.created_at >= date('now','-6 days')`),
      // Prior-period comparisons for the dashboard's KPI rings.
      db.prepare(`SELECT COALESCE(SUM(amount_total_pence),0) v FROM orders
                  WHERE status='paid' AND created_at >= date('now','-1 day') AND created_at < date('now')`),
      db.prepare(`SELECT COALESCE(SUM(amount_total_pence),0) v FROM orders
                  WHERE status='paid' AND created_at >= date('now','-13 days') AND created_at < date('now','-6 days')`),
      db.prepare(`SELECT COALESCE(SUM(amount_total_pence),0) v FROM orders
                  WHERE status='paid' AND created_at >= date('now','start of month','-1 month') AND created_at < date('now','start of month')`),
      db.prepare(`SELECT fulfilment_status, COUNT(*) c FROM orders WHERE status='paid' GROUP BY fulfilment_status`),
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
        low_stock_threshold: lowStock,
      },
      recent_orders: r[7].results || [],
      top_products: r[8].results || [],
      sales_series: fillDailySeries(r[9].results || [], seriesFrom, seriesToExclusive),
      activity: {
        units_today: one(10).v || 0,
        new_customers_week: one(11).c || 0,
        avg_items_per_order_week: one(12).orders > 0 ? Math.round((one(12).units / one(12).orders) * 10) / 10 : 0,
      },
      comparisons: {
        yesterday_pence: one(13).v || 0,
        previous_week_pence: one(14).v || 0,
        previous_month_pence: one(15).v || 0,
      },
      fulfilment_breakdown: Object.fromEntries(
        ['unfulfilled', 'packed', 'shipped', 'delivered'].map(s => [
          s, r[16].results?.find(row => row.fulfilment_status === s)?.c || 0,
        ]),
      ),
    })
  } catch (err) {
    return apiError(`Could not load dashboard: ${err.message}`, 500, { code: 'server_error' })
  }
}
