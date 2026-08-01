// Sending. One provider, one place.
//
// THE GOVERNING RULE: an email may never break a business transaction. The Stripe
// webhook records a paid order; if a send threw from inside that handler, Stripe
// would retry, the idempotency check would short-circuit, and the order could be
// lost outright. So sendTemplated() catches everything, returns a result array
// instead of throwing, and is always called AFTER the write it accompanies has
// already committed — never inside the same db.batch().
//
// WHY SYNCHRONOUS. An earlier design deferred sends with ctx.waitUntil(). That
// bought latency isolation this shop's volume does not need, and cost something
// real: an outbox row stuck at 'pending' whenever an isolate died, with no
// scheduler in Pages Functions to ever resolve it. Sending inline — all messages
// for one event in parallel, five seconds each — costs ~500ms against Stripe's
// 20-second webhook budget and gives every row a true final status.
//
// There is no automatic retry. A failed send is recorded and resent with one click
// from Emails -> Activity. Automatic retry needs a scheduler, which means a
// companion Worker on a cron trigger; that is deliberately out of scope.

import { renderEmail, orderRef, formatMoney } from './email-render.mjs'

const SEND_TIMEOUT_MS = 5000
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

const CONFIG_KEYS = [
  'email_enabled', 'email_from_name', 'email_from_address',
  'admin_notify_email', 'low_stock_alerts_enabled', 'site_url',
]

const isTruthy = v => v === '1' || v === 'true' || v === true || v === 1

/**
 * Reads the email settings and resolves the absolute site origin.
 *
 * siteUrl uses the same precedence as functions/api/checkout.js — env.SITE_URL
 * first, the stored setting second. That order matters: the stored site_url still
 * points at the live Wix site, so a UAT deploy reading the setting first would put
 * a broken logo and wrong links into every email.
 */
export async function loadEmailConfig(env, origin = '') {
  let settings = {}
  try {
    const placeholders = CONFIG_KEYS.map(() => '?').join(',')
    const { results } = await env.DB
      .prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
      .bind(...CONFIG_KEYS)
      .all()
    settings = Object.fromEntries((results || []).map(r => [r.key, r.value]))
  } catch {
    // A database without migration 005 behaves as "email not configured" rather
    // than breaking whatever transaction is calling us.
  }

  return {
    enabled: isTruthy(settings.email_enabled),
    lowStockAlerts: isTruthy(settings.low_stock_alerts_enabled),
    fromName: settings.email_from_name || 'Salty Lamps',
    fromAddress: settings.email_from_address || '',
    adminEmail: settings.admin_notify_email || '',
    siteUrl: (env.SITE_URL || settings.site_url || origin || '').replace(/\/+$/, ''),
    apiKey: env.RESEND_API_KEY || '',
    dryRun: isTruthy(env.MAIL_DRY_RUN),
  }
}

export async function loadTemplates(env, keys) {
  const placeholders = keys.map(() => '?').join(',')
  const { results } = await env.DB
    .prepare(`SELECT * FROM email_templates WHERE key IN (${placeholders})`)
    .bind(...keys)
    .all()
  return new Map((results || []).map(row => [row.key, row]))
}

/** One HTTP call to Resend. Throws on a non-2xx so the caller can record why. */
export async function sendMail({ apiKey, from, to, subject, html, text, replyTo }) {
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: [replyTo] } : {}),
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.message || body?.error?.message || `Resend responded ${res.status}`)
  }
  return body?.id || null
}

/**
 * Render and send a batch of messages, then log every outcome.
 *
 * @param messages [{ templateKey, to, data, blocks, orderId, replyTo }]
 * @returns [{ templateKey, to, status, error }] — never throws.
 */
export async function sendTemplated(env, messages, { origin = '' } = {}) {
  const queue = (messages || []).filter(Boolean)
  if (queue.length === 0) return []

  try {
    const config = await loadEmailConfig(env, origin)
    const templates = await loadTemplates(env, [...new Set(queue.map(m => m.templateKey))])

    const prepared = queue.map(message => {
      const stored = templates.get(message.templateKey)
      // templateOverride lets the admin "send test to me" button exercise an
      // UNSAVED draft through this exact path, rather than a second send
      // implementation that could drift from the real one.
      const template = stored ? { ...stored, ...(message.templateOverride || {}) } : null

      // Every reason to not send, resolved before any network call so the outbox
      // records precisely why. 'skipped' is not 'failed': a deliberately quiet UAT
      // environment must not read as an outage in the admin.
      //
      // `force` is set only by the test-send button. It bypasses the two switches
      // whose whole purpose the test predates — a template still switched off, and
      // sending not yet enabled — because the test is how the owner decides to turn
      // them on. It does not bypass a missing key, address or dry-run flag.
      const skip =
        !template ? 'Template not found.'
        : !template.enabled && !message.force ? 'Template is switched off.'
        : !config.enabled && !message.force ? 'Sending is switched off in Settings.'
        : !config.fromAddress ? 'No sender address configured.'
        : !message.to ? 'No recipient address.'
        : config.dryRun ? 'MAIL_DRY_RUN is set.'
        : !config.apiKey ? 'No RESEND_API_KEY configured.'
        : null

      const rendered = template
        ? renderEmail({
            template,
            data: message.data || {},
            blocks: message.blocks || [],
            siteUrl: config.siteUrl,
            shopName: config.fromName,
          })
        : { subject: '', html: '', text: '' }

      return { message, rendered, skip }
    })

    const outcomes = await Promise.allSettled(
      prepared.map(async ({ message, rendered, skip }) => {
        if (skip) return { status: 'skipped', error: skip, providerId: null }
        const providerId = await sendMail({
          apiKey: config.apiKey,
          from: `${config.fromName} <${config.fromAddress}>`,
          to: message.to,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          replyTo: message.replyTo,
        })
        return { status: 'sent', error: null, providerId }
      }),
    )

    const results = prepared.map(({ message, rendered }, i) => {
      const settled = outcomes[i]
      const outcome = settled.status === 'fulfilled'
        ? settled.value
        : { status: 'failed', error: String(settled.reason?.message || settled.reason).slice(0, 500), providerId: null }
      return { templateKey: message.templateKey, to: message.to, subject: rendered.subject, ...outcome, message }
    })

    // Logged in one batch, and separately from the sends, so a logging failure can
    // never be mistaken for a delivery failure.
    try {
      await env.DB.batch(results.map(r => env.DB
        .prepare(
          `INSERT INTO email_outbox (template_key, to_address, subject, status, error, order_id, provider_id, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          r.templateKey,
          r.to || '',
          r.subject || '',
          r.status,
          r.error,
          r.message.orderId ?? null,
          r.providerId,
          JSON.stringify({ data: r.message.data || {}, blocks: r.message.blocks || [], to: r.message.to, replyTo: r.message.replyTo || null }),
        )))
    } catch {
      // Nothing to do but continue: the email either went or it did not, and that
      // outcome must not be undone by a log write.
    }

    return results.map(({ templateKey, to, status, error }) => ({ templateKey, to, status, error }))
  } catch (err) {
    // Absolute backstop. Reaching here means a missing table or a malformed
    // template row — never a reason to fail the caller's transaction.
    return queue.map(m => ({
      templateKey: m.templateKey,
      to: m.to,
      status: 'failed',
      error: String(err?.message || err).slice(0, 500),
    }))
  }
}

// --- shared block builders -------------------------------------------------
// Used by the order hooks AND by the admin preview, so what the owner previews is
// assembled exactly the way the real email is.

export function orderTokens(order, { paymentMethod = '' } = {}) {
  return {
    order_ref: orderRef(order.id),
    order_id: order.id,
    customer_name: order.ship_name || 'there',
    customer_email: order.customer_email || '',
    order_total: formatMoney(order.amount_total_pence),
    order_date: formatDate(order.created_at),
    tracking_number: order.tracking_number || '',
    payment_method: paymentMethod,
  }
}

export function orderBlocks(order, items, { includeAddress = true } = {}) {
  const blocks = [{
    type: 'panel',
    title: 'Order information',
    rows: [
      ['Order reference', orderRef(order.id)],
      ['Placed', formatDate(order.created_at)],
      ['Payment status', capitalise(order.status)],
      ['Fulfilment', capitalise(order.fulfilment_status)],
      ['Tracking number', order.tracking_number || ''],
    ],
  }]

  if (includeAddress) {
    blocks.push({
      type: 'address',
      title: 'Delivery address',
      lines: [
        order.ship_name, order.ship_line1, order.ship_line2,
        order.ship_city, order.ship_postcode, order.ship_country,
      ],
    })
  }

  blocks.push({
    type: 'items',
    title: 'Order details',
    items: (items || []).map(item => ({
      name: item.name,
      variant: item.variant_label || '',
      sku: item.sku || '',
      qty: item.quantity,
      unit: formatMoney(item.unit_price_pence),
      total: formatMoney(item.unit_price_pence * item.quantity),
    })),
    // Only the total. This checkout charges no shipping and no tax, so the
    // Subtotal / Shipping / Tax rows the Wix email prints would be invented here.
    totals: [['Total paid', formatMoney(order.amount_total_pence), true]],
  })

  return blocks
}

function capitalise(s) {
  const v = String(s || '')
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : ''
}

function formatDate(value) {
  if (!value) return ''
  // D1 stores `datetime('now')` as "YYYY-MM-DD HH:MM:SS" in UTC with no zone
  // marker; Date parses that inconsistently, so the T and Z are made explicit.
  const iso = String(value).includes('T') ? String(value) : `${String(value).replace(' ', 'T')}Z`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/London',
  }).format(d)
}
