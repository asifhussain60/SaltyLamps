// GET /api/admin/orders — filterable, searchable, paginated order list.
// Query params: status, fulfilment, q (email/id search), limit, offset.
import { json, apiError } from '../../lib/admin-helpers.mjs'
import { PAYMENT_STATUSES, FULFILMENT_STATUSES } from '../../lib/validation.mjs'

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const fulfilment = url.searchParams.get('fulfilment')
  const q = (url.searchParams.get('q') || '').trim()
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), 100)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

  const where = []
  const binds = []
  if (status && PAYMENT_STATUSES.includes(status)) {
    where.push('o.status = ?')
    binds.push(status)
  }
  if (fulfilment && FULFILMENT_STATUSES.includes(fulfilment)) {
    where.push('o.fulfilment_status = ?')
    binds.push(fulfilment)
  }
  if (q) {
    where.push('(o.customer_email LIKE ? OR o.id LIKE ?)')
    binds.push(`%${q}%`, `%${q}%`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  try {
    const listStmt = env.DB.prepare(
      `SELECT o.id, o.created_at, o.customer_email, o.amount_total_pence, o.currency,
              o.status, o.fulfilment_status, o.tracking_number,
              (SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o
       ${whereSql}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
    ).bind(...binds, limit, offset)

    const countStmt = env.DB.prepare(`SELECT COUNT(*) c FROM orders o ${whereSql}`).bind(...binds)

    const [list, count] = await env.DB.batch([listStmt, countStmt])
    return json({
      orders: list.results || [],
      total: count.results?.[0]?.c || 0,
      limit,
      offset,
    })
  } catch (err) {
    return apiError(`Could not load orders: ${err.message}`, 500, { code: 'server_error' })
  }
}
