// POST /api/admin/emails/outbox/:id/resend
//
// Re-sends a logged email from its stored payload. This is the operable half of
// "there is no automatic retry" — Pages Functions have no scheduler, so a failed
// send is surfaced rather than silently retried, and the owner decides.
//
// Re-renders with the CURRENT template wording, not a stored copy of the HTML. If
// the owner fixed a typo after the original send, the resend carries the fix; and
// nothing here has to trust markup written by an earlier deployment.
import { json, apiError, auditStmt } from '../../../../../lib/admin-helpers.mjs'
import { sendTemplated } from '../../../../../lib/mailer.mjs'

export async function onRequestPost({ params, request, env, data }) {
  try {
    const row = await env.DB
      .prepare(`SELECT * FROM email_outbox WHERE id = ?`)
      .bind(Number(params.id))
      .first()
    if (!row) return apiError('That email is not in the log.', 404, { code: 'not_found' })

    let payload = {}
    try {
      payload = JSON.parse(row.payload || '{}')
    } catch {
      return apiError('That log entry has no replayable content.', 409, { code: 'conflict' })
    }

    const to = payload.to || row.to_address
    if (!to) return apiError('That log entry has no recipient to send to.', 409, { code: 'conflict' })

    const [result] = await sendTemplated(env, [{
      templateKey: row.template_key,
      to,
      orderId: row.order_id,
      replyTo: payload.replyTo || undefined,
      // Forced: the admin clicking resend is a deliberate act that should not be
      // silently swallowed by a template someone switched off in the meantime.
      force: true,
      data: payload.data || {},
      blocks: payload.blocks || [],
    }], { origin: new URL(request.url).origin })

    await auditStmt(env.DB, data.actorEmail, 'email.resend', 'email_outbox', params.id, {
      template: row.template_key, to, status: result?.status,
    }).run()

    return json({ status: result?.status || 'failed', error: result?.error || null, to })
  } catch (err) {
    return apiError(`Could not resend: ${err.message}`, 500, { code: 'server_error' })
  }
}
