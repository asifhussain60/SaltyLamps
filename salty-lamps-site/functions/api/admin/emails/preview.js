// POST /api/admin/emails/preview
// Body: { key, template: { subject, preheader, heading, intro, cta_label, outro } }
//
// Renders an UNSAVED draft through the production renderer with sample data and
// returns the HTML for the editor to show in a sandboxed iframe.
//
// Server-side on purpose. The alternative — a copy of the renderer in the admin
// bundle — is a second implementation that will drift, and a preview of something
// other than the real email is worse than no preview at all.
import { json, apiError, validationError, readJson } from '../../../lib/admin-helpers.mjs'
import { validateEmailTemplates, EMAIL_TEMPLATE_SPECS } from '../../../lib/validation.mjs'
import { renderEmail } from '../../../lib/email-render.mjs'
import { loadEmailConfig } from '../../../lib/mailer.mjs'
import { sampleFor } from '../../../lib/email-samples.mjs'

export async function onRequestPost({ request, env }) {
  const [body, bodyErr] = await readJson(request)
  if (bodyErr) return bodyErr

  const key = String(body?.key || '')
  if (!EMAIL_TEMPLATE_SPECS[key]) return apiError('Unknown email template.', 404, { code: 'not_found' })

  // The draft is validated before rendering, so an unknown {{token}} is reported
  // as a field error in the editor rather than silently previewing as blank.
  //
  // Only when there IS a draft. validateEmailTemplates treats an empty patch as
  // "nothing to update", which is the right answer for a save and the wrong one
  // here — previewing the stored wording unchanged is a legitimate request.
  const draft = body?.template || {}
  if (Object.keys(draft).length > 0) {
    const { ok, errors } = validateEmailTemplates({ [key]: draft })
    if (!ok) return validationError(errors)
  }

  try {
    const stored = await env.DB.prepare(`SELECT * FROM email_templates WHERE key = ?`).bind(key).first()
    if (!stored) return apiError('Unknown email template.', 404, { code: 'not_found' })

    const config = await loadEmailConfig(env, new URL(request.url).origin)
    const { data, blocks } = sampleFor(key)

    const rendered = renderEmail({
      template: { ...stored, ...(body.template || {}) },
      data,
      blocks,
      siteUrl: config.siteUrl,
      shopName: config.fromName,
    })

    return json(rendered)
  } catch (err) {
    return apiError(`Could not render preview: ${err.message}`, 500, { code: 'server_error' })
  }
}
