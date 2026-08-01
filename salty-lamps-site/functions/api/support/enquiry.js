// POST /api/support/enquiry
// Body: { source: 'chat' | 'trade' | 'newsletter', name, email, message, website? }
//
// Backs the floating chat panel, the trade enquiry form and the footer newsletter
// signup in src/App.jsx. Those three wrote to Supabase, where nobody was notified —
// trade leads were arriving and sitting unread. They now land in D1 and notify the
// admin.
//
// THE ROW IS THE RECORD, THE EMAIL IS A CONVENIENCE. The insert happens first and
// its success is what the caller is told about; a bounced or skipped notification
// can therefore never lose a lead.
//
// THIS ENDPOINT IS UNAUTHENTICATED AND SENDS MAIL, so it is a spam-relay target.
// The defences are: a hidden honeypot field, hard length caps in validateEnquiry,
// and HTML-escaping of every value at render time (email-render.mjs escapes all
// block content — this is the one path where public input reaches an email body).
import { json, apiError, readJson } from '../../lib/admin-helpers.mjs'
import { validateEnquiry } from '../../lib/validation.mjs'
import { sendTemplated, loadEmailConfig } from '../../lib/mailer.mjs'

const TEMPLATE_BY_SOURCE = {
  chat: 'admin_enquiry_chat',
  trade: 'admin_enquiry_trade',
  newsletter: 'admin_enquiry_newsletter',
}

const SOURCE_LABEL = { chat: 'Website chat', trade: 'Trade enquiry form', newsletter: 'Footer newsletter' }

export async function onRequestPost({ request, env }) {
  const [body, bodyErr] = await readJson(request)
  if (bodyErr) return bodyErr

  // Honeypot: a field positioned off-screen and hidden from assistive technology,
  // so no human ever fills it. Answer normally rather than with an error — telling
  // a bot it was detected only teaches it to stop filling the field.
  if (typeof body?.website === 'string' && body.website.trim() !== '') return json({ ok: true })

  const { ok, errors, value } = validateEnquiry(body)
  if (!ok) return apiError('Please check the form and try again.', 400, { code: 'validation', fields: errors })

  try {
    await env.DB
      .prepare(`INSERT INTO enquiries (source, name, email, message) VALUES (?, ?, ?, ?)`)
      .bind(value.source, value.name, value.email, value.message)
      .run()
  } catch (err) {
    return apiError(`Could not save your message: ${err.message}`, 503, { code: 'server_error' })
  }

  // Best-effort from here. The enquiry is saved and visible in the admin whatever
  // happens to the notification.
  try {
    const origin = new URL(request.url).origin
    const config = await loadEmailConfig(env, origin)
    if (config.adminEmail) {
      await sendTemplated(env, [{
        templateKey: TEMPLATE_BY_SOURCE[value.source],
        to: config.adminEmail,
        // Replying to the notification replies to the person who wrote in, which is
        // the whole point of routing these to a mailbox rather than a dashboard.
        replyTo: value.email,
        data: { name: value.name || 'Someone', email: value.email, message: value.message },
        blocks: [
          {
            type: 'panel',
            title: 'From',
            rows: [
              ['Name', value.name || ''],
              ['Email', value.email],
              ['Came from', SOURCE_LABEL[value.source] || value.source],
            ],
          },
          { type: 'note', title: 'Message', text: value.message },
        ],
      }], { origin })
    }
  } catch { /* the enquiry is stored; notification is best-effort */ }

  return json({ ok: true })
}
