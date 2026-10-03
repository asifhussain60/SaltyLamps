import { json, apiError } from '../../lib/admin-helpers.mjs'
import { REVIEW_KEY, REPORT_PREFIX, emptyReview, validateReviewInput, reviewCounts } from '../../lib/launch-review.mjs'
const headers = { 'cache-control': 'private, no-store' }
const response = (body, status = 200) => json(body, status, headers)
async function load(db) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(REVIEW_KEY).first()
  return { raw: row?.value ?? null, document: row ? JSON.parse(row.value) : emptyReview() }
}
export async function onRequestGet({ request, env }) {
  try {
    const { document } = await load(env.DB)
    const { results } = await env.DB.prepare('SELECT value FROM settings WHERE key GLOB ? ORDER BY updated_at DESC, key DESC LIMIT 20').bind(`${REPORT_PREFIX}*`).all()
    return response({ document, reports: (results || []).map(r => JSON.parse(r.value)) })
  } catch { return apiError('Your review could not be loaded. Please try again.', 500, { code: 'server_error' }, headers) }
}
export async function onRequestPut({ request, env, data }) {
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return apiError('Please save from the administrator page.', 403, {}, headers)
  let input
  try {
    const text = await request.text()
    if (text.length > 100000) return apiError('The review is too large. Shorten your comments.', 413, {}, headers)
    input = JSON.parse(text)
  } catch { return apiError('Invalid review format.', 400, {}, headers) }
  const checked = validateReviewInput(input)
  if (checked.error) return apiError(checked.error, 400, {}, headers)
  try {
    const { raw, document } = await load(env.DB)
    const { value } = checked
    if (document.revision !== value.revision) return apiError('This review changed in another tab or device. Download your notes, then reload the latest saved review.', 409, { code: 'conflict' }, headers)
    const now = new Date().toISOString()
    const next = { ...emptyReview(), ...value, revision: document.revision + 1, updatedAt: now, updatedBy: data.actorEmail, saveId: crypto.randomUUID() }
    delete next.action; delete next.reportId; delete next.reviewNote
    const text = JSON.stringify(next)
    const save = raw == null
      ? env.DB.prepare('INSERT OR IGNORE INTO settings (key, value, value_type) VALUES (?, ?, ?)').bind(REVIEW_KEY, text, 'json')
      : env.DB.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ? AND value = ?").bind(text, REVIEW_KEY, raw)
    const stmts = [save]
    let report = null
    if (value.action === 'submit') {
      report = { id: crypto.randomUUID(), submittedAt: now, submittedBy: data.actorEmail, document: next, counts: reviewCounts(next.entries), review: null }
      stmts.push(env.DB.prepare("INSERT INTO settings (key, value, value_type) SELECT ?, ?, 'json' WHERE EXISTS (SELECT 1 FROM settings WHERE key = ? AND value = ?)").bind(REPORT_PREFIX + report.id, JSON.stringify(report), REVIEW_KEY, text))
    } else if (value.action === 'review') {
      const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(REPORT_PREFIX + value.reportId).first()
      if (!row) return apiError('That submitted review no longer exists.', 404, {}, headers)
      report = JSON.parse(row.value)
      report.review = { note: value.reviewNote, reviewedAt: now, reviewedBy: data.actorEmail }
      stmts.push(env.DB.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ? AND EXISTS (SELECT 1 FROM settings WHERE key = ? AND value = ?)").bind(JSON.stringify(report), REPORT_PREFIX + value.reportId, REVIEW_KEY, text))
    }
    const result = await env.DB.batch(stmts)
    if (!result[0].meta?.changes) return apiError('Another person saved first. Download your notes, then reload the latest saved review.', 409, { code: 'conflict' }, headers)
    return response({ document: next, report })
  } catch { return apiError('Your review could not be saved. Your answers are still on this page; please try again.', 500, { code: 'server_error' }, headers) }
}
