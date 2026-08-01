// POST /api/admin/emails/test
// Body: { key, template?, to? }
//
// Sends one real email of the given template — using the UNSAVED draft when the
// editor passes one — so the owner can look at it in Gmail, Apple Mail and Outlook
// before switching anything on. Goes through sendTemplated() like every other send,
// so it is logged in the outbox alongside the real traffic and proves the whole
// path including the API key and the DNS records.
import { json, apiError, validationError, readJson, auditStmt } from '../../../lib/admin-helpers.mjs'
import { validateEmailTemplates, EMAIL_TEMPLATE_SPECS } from '../../../lib/validation.mjs'
import { sendTemplated, loadEmailConfig } from '../../../lib/mailer.mjs'
import { sampleFor } from '../../../lib/email-samples.mjs'

export async function onRequestPost({ request, env, data }) {
  const [body, bodyErr] = await readJson(request)
  if (bodyErr) return bodyErr

  const key = String(body?.key || '')
  if (!EMAIL_TEMPLATE_SPECS[key]) return apiError('Unknown email template.', 404, { code: 'not_found' })

  // Same as the preview endpoint: an empty draft means "test the stored wording",
  // which validateEmailTemplates would otherwise reject as "nothing to update".
  if (body?.template && Object.keys(body.template).length > 0) {
    const { ok, errors } = validateEmailTemplates({ [key]: body.template })
    if (!ok) return validationError(errors)
  }

  // RECIPIENT ORDER: an explicit address wins, then the configured admin address,
  // then the signed-in identity.
  //
  // The admin address sits above the signed-in identity because it is the address the
  // shop is actually configured to notify — testing it proves the delivery path the
  // real alerts use, rather than a second address that happens to be logged in. It
  // also has to come first for the test to work at all on a deployment using
  // DEV_ADMIN_BYPASS, where the identity is the undeliverable dev@localhost.
  const origin = new URL(request.url).origin
  const config = await loadEmailConfig(env, origin)
  const to = String(body?.to || config.adminEmail || data.actorEmail || '').trim()
  if (!to.includes('@')) {
    return validationError({
      to: 'No address to send to — set the admin notification address in Settings, or type one here.',
    })
  }

  try {
    const sample = sampleFor(key)
    const [result] = await sendTemplated(env, [{
      templateKey: key,
      to,
      force: true,
      templateOverride: body?.template || null,
      data: sample.data,
      blocks: sample.blocks,
    }], { origin })

    await auditStmt(env.DB, data.actorEmail, 'email.test', 'email_template', key, { to }).run()

    // A skipped or failed test is a 200 with the reason in it, not an error status:
    // "no API key configured yet" is the expected answer on a fresh install, and the
    // editor shows it as guidance rather than a red banner.
    return json({ status: result?.status || 'failed', error: result?.error || null, to })
  } catch (err) {
    return apiError(`Could not send the test: ${err.message}`, 500, { code: 'server_error' })
  }
}
