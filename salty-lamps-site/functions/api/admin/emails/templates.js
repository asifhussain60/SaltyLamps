// GET /api/admin/emails/templates — every template with the tokens it may use.
// PUT /api/admin/emails/templates — bulk save of the editable wording.
//
// Wording only. Layout, palette, logo and the Outlook-safe markup live in
// functions/lib/email-render.mjs and are not reachable from here, so no edit made
// through this endpoint can break how an email renders — only what it says.
import { json, apiError, validationError, readJson, auditStmt } from '../../../lib/admin-helpers.mjs'
import {
  validateEmailTemplates, EMAIL_TEMPLATE_SPECS, EMAIL_EDITABLE_FIELDS, tokensFor,
} from '../../../lib/validation.mjs'

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB
      .prepare(`SELECT * FROM email_templates ORDER BY sort_order, key`)
      .all()

    // Rows are joined to the spec rather than trusted alone: the spec is what
    // decides which tokens are legal, and the editor needs that list to show the
    // owner what she may type.
    const templates = (results || [])
      .filter(row => EMAIL_TEMPLATE_SPECS[row.key])
      .map(row => ({
        ...row,
        enabled: row.enabled === 1,
        audience: EMAIL_TEMPLATE_SPECS[row.key].audience,
        tokens: tokensFor(row.key),
      }))

    return json({ templates, fields: EMAIL_EDITABLE_FIELDS })
  } catch (err) {
    return apiError(`Could not load email templates: ${err.message}`, 500, { code: 'server_error' })
  }
}

export async function onRequestPut({ request, env, data }) {
  const [body, bodyErr] = await readJson(request)
  if (bodyErr) return bodyErr

  const { ok, errors, value } = validateEmailTemplates(body?.templates || {})
  if (!ok) return validationError(errors)

  try {
    const stmts = Object.entries(value).map(([key, patch]) => {
      const columns = Object.keys(patch)
      const set = [...columns.map(c => `${c} = ?`), `updated_at = datetime('now')`].join(', ')
      return env.DB
        .prepare(`UPDATE email_templates SET ${set} WHERE key = ?`)
        .bind(...columns.map(c => patch[c]), key)
    })
    stmts.push(auditStmt(env.DB, data.actorEmail, 'email.template.update', 'email_template', null, Object.keys(value)))
    await env.DB.batch(stmts)

    return json({ updated: Object.keys(value) })
  } catch (err) {
    return apiError(`Could not save email templates: ${err.message}`, 500, { code: 'server_error' })
  }
}
