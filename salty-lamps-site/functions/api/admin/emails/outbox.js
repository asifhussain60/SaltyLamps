// GET /api/admin/emails/outbox?page=1&limit=50&status=failed&order=cs_live_...
//
// The send log. This is the whole answer to "there is no automatic retry": every
// send lands here with a true final status, and a failed one is resent with one
// click from Emails -> Activity.
//
// The `order` filter backs the "Emails for this order" panel on the order page.
// idx_email_outbox_order has existed since d1/migrations/005-email.sql and had no
// reader until now. It matters because sending is switched off until the domain's
// DKIM and SPF records exist: without this, a despatch notice quietly logged as
// 'skipped — sending is switched off' was only discoverable by leaving the order.
import { json, apiError } from '../../../lib/admin-helpers.mjs'

const STATUSES = ['sent', 'failed', 'skipped']

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50))
  const status = url.searchParams.get('status')
  const orderId = (url.searchParams.get('order') || '').trim()

  const clauses = []
  const binds = []
  if (STATUSES.includes(status)) {
    clauses.push('status = ?')
    binds.push(status)
  }
  if (orderId) {
    clauses.push('order_id = ?')
    binds.push(orderId)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  try {
    const total = await env.DB
      .prepare(`SELECT COUNT(*) AS n FROM email_outbox ${where}`)
      .bind(...binds)
      .first()

    // payload is deliberately not selected: it is only needed by the resend
    // endpoint, and it carries a full copy of the order including the delivery
    // address. No reason to ship that to the browser to render a list.
    const { results } = await env.DB
      .prepare(
        `SELECT id, template_key, to_address, subject, status, error, order_id, provider_id, created_at
         FROM email_outbox ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, (page - 1) * limit)
      .all()

    return json({ rows: results || [], total: total?.n || 0, page, limit })
  } catch (err) {
    return apiError(`Could not load the email log: ${err.message}`, 500, { code: 'server_error' })
  }
}
