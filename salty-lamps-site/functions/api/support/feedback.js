import { json, apiError, readJson } from '../../lib/admin-helpers.mjs'
import { validateFeedback } from '../../lib/feedback.mjs'
import { loadEmailConfig, sendTemplated } from '../../lib/mailer.mjs'

export async function onRequestPost({ request, env }) {
  const origin = new URL(request.url).origin
  if (request.headers.get('origin') && request.headers.get('origin') !== origin) return apiError('Please submit feedback from this website.', 403)
  if (Number(request.headers.get('content-length')) > 24000) return apiError('Please shorten your feedback.', 413)
  const [body, error] = await readJson(request)
  if (error) return error
  if (typeof body?.website === 'string' && body.website.trim()) return json({ ok: true })
  const { ok, errors, value } = validateFeedback(body)
  if (!ok) return apiError('Please check your feedback.', 400, { fields: errors })
  const { name, email, topic, page } = value
  const message = `Type: ${topic}\nPage: ${page || 'Not specified'}\n\n${value.message}`
  try {
    // One atomic insert protects against double clicks, concurrent requests and
    // retry after a lost response. Limits apply to the sender, not other visitors.
    const inserted = await env.DB.prepare(`INSERT INTO enquiries (source,name,email,message)
      SELECT 'feedback',?,?,? WHERE NOT EXISTS (
        SELECT 1 FROM enquiries WHERE source='feedback' AND lower(email)=lower(?) AND message=?
        AND created_at > datetime('now','-10 minutes'))
      AND (SELECT count(*) FROM enquiries WHERE source='feedback' AND lower(email)=lower(?)
        AND created_at > datetime('now','-10 minutes')) < 5`)
      .bind(name, email, message, email, message, email).run()
    if (!inserted.meta?.changes) {
      const existing = await env.DB.prepare(`SELECT id FROM enquiries WHERE source='feedback'
        AND lower(email)=lower(?) AND message=? AND created_at > datetime('now','-10 minutes') LIMIT 1`).bind(email, message).first()
      if (existing) return json({ ok: true, reference: existing.id, duplicate: true })
      return apiError('You have sent several messages. Please wait ten minutes before sending another.', 429)
    }
    const reference = inserted.meta.last_row_id
    const config = await loadEmailConfig(env, origin)
    await sendTemplated(env, [{ templateKey: 'admin_feedback', to: config.adminEmail, replyTo: email,
      data: { name: name || 'A visitor', email, ctaHref: `${config.siteUrl}/admin/emails?tab=feedback` },
      blocks: [{ type: 'panel', title: `Feedback #${reference}`, rows: [['Name', name || 'Not provided'], ['Email', email], ['Type', topic], ['Page', page || 'Not specified']] },
        { type: 'note', title: 'Feedback', text: value.message }],
    }], { origin })
    return json({ ok: true, reference })
  } catch {
    return apiError('We could not save your feedback. Your message is still here; please try again.', 503)
  }
}
