// GET /api/admin/enquiries?page=1&limit=50&source=trade
//
// Chat messages, trade enquiries and newsletter signups from the storefront forms.
// This is the reader that makes the `enquiries` table worth having: the
// notification email is a convenience, this list is the record.
import { json, apiError } from '../../lib/admin-helpers.mjs'
import { ENQUIRY_SOURCES } from '../../lib/validation.mjs'

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50))
  const source = url.searchParams.get('source')
  const where = ENQUIRY_SOURCES.includes(source) ? `WHERE source = ?` : ''
  const binds = ENQUIRY_SOURCES.includes(source) ? [source] : []

  try {
    const total = await env.DB
      .prepare(`SELECT COUNT(*) AS n FROM enquiries ${where}`)
      .bind(...binds)
      .first()

    const { results } = await env.DB
      .prepare(
        `SELECT id, source, name, email, message, created_at
         FROM enquiries ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, (page - 1) * limit)
      .all()

    return json({ rows: results || [], total: total?.n || 0, page, limit })
  } catch (err) {
    return apiError(`Could not load enquiries: ${err.message}`, 500, { code: 'server_error' })
  }
}
