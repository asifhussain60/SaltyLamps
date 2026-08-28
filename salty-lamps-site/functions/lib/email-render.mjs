// The Salty Lamps email brand shell.
//
// STRUCTURE LIVES HERE, WORDING LIVES IN THE DATABASE. The admin edits the subject,
// preview line, heading, two paragraphs and a button caption (email_templates); it
// cannot reach this file. That is the same split the content layer already makes —
// content_snippets holds strings, collection_sections holds structure — and it is
// why a careless copy edit can change what an email says but never break how it
// renders in someone's mail client.
//
// WHY THE MARKUP LOOKS LIKE 2005. Mail clients are not browsers. Outlook renders
// through Word, Gmail strips <style> blocks and rewrites classes, and roughly half
// of recipients see images blocked by default. So: nested tables rather than flex
// or grid, every style inline, no background images, no web fonts, and alt text on
// the logo that reads correctly on its own. This is not legacy code; it is the
// current correct target.
//
// Every block emits BOTH its HTML and its plain-text equivalent from one call, so
// the two parts of a multipart/alternative message cannot drift apart. The Wix
// sample this replaces is multipart for the same reason — a text part materially
// improves spam scoring.

// --- brand tokens, lifted from src/styles/saltylamps.css -------------------
// Kept as literals rather than parsed from the stylesheet: this module runs in a
// Worker with no filesystem, and an email that silently loses its palette because
// a CSS variable was renamed is worse than one that needs a two-line edit here.
const C = {
  paper: '#f7efe6',   // --paper, the page surround
  salt: '#fffaf4',    // --salt, the card
  raised: '#ffffff',
  ink: '#1f1915',     // --ink
  muted: '#6d625b',   // --muted
  line: '#e4d8cc',    // --line, flattened from rgba() because Outlook ignores alpha
  amber: '#d88a35',   // --amber
  ember: '#9b4328',   // --ember
  // --ink, used for the header band ONLY. The brand emblem is a circular amber
  // mark on a solid black field with no transparency, so an ember band would put
  // a hard black square in the middle of it. A near-black band lets the emblem sit
  // flush and the amber glow carry the brand instead.
  header: '#1f1915',
}

// The circular "Salty Lamps" emblem at the site root. NOT /media/logo.png — that
// is a red-and-blue placeholder mark on grey that predates the current brand and
// clashes with every colour in this palette. It is still referenced by the site
// footer, the admin sidebar and the SEO card images; those are worth correcting
// too, but separately from the email layer.
// The 256px copy, not the 1254px original. This is rendered at 104px wide in the
// email header, so the full-size file was sending a quarter of a megabyte to every
// customer for a thumbnail — on a phone, on mobile data, before they read a word.
// The original stays in public/ because the social card is composited from it.
const LOGO_PATH = '/salty-lamp-logo-256.jpeg'

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatMoney(pence) {
  const n = Number(pence)
  if (!Number.isFinite(n)) return ''
  return `£${(n / 100).toFixed(2)}`
}

// A short, speakable order reference. Stripe session ids are ~66 characters and
// unreadable over the phone; the last eight are plenty to identify an order in a
// shop this size, and the full id still appears in the admin email's detail panel.
export function orderRef(orderId) {
  const id = String(orderId || '')
  return id ? `#${id.slice(-8).toUpperCase()}` : ''
}

const TOKEN_PATTERN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi

// HTML interpolation. The admin-authored text is escaped FIRST (it is plain text,
// never markup), then each token is replaced with its escaped value. Escaping first
// is safe because `{` and `}` are not escaped, so the placeholders survive intact.
function interpolateHtml(text, data) {
  return escapeHtml(text).replace(TOKEN_PATTERN, (_, token) => escapeHtml(data[token.toLowerCase()] ?? ''))
}

function interpolateText(text, data) {
  return String(text ?? '').replace(TOKEN_PATTERN, (_, token) => String(data[token.toLowerCase()] ?? ''))
}

// --- blocks ----------------------------------------------------------------
// Each returns { html, text }. Callers pass an array of descriptors to renderEmail
// and never touch these directly.

const cell = (content, style) => `<td style="${style}">${content}</td>`

function blockHeading(text) {
  return {
    html: `<tr>${cell(
      `<h2 style="margin:0 0 14px;font-family:${FONT};font-size:19px;line-height:1.3;font-weight:600;color:${C.ember};">${escapeHtml(text)}</h2>`,
      'padding:26px 32px 0;',
    )}</tr>`,
    text: `\n${text.toUpperCase()}\n`,
  }
}

// A label/value panel: Order Information, Delivery Method, low-stock detail.
function blockPanel({ title, rows = [] }) {
  const body = rows
    .filter(([, value]) => value !== '' && value != null)
    .map(([label, value]) => `
      <tr>
        <td style="padding:7px 0;font-family:${FONT};font-size:13px;color:${C.muted};width:42%;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:7px 0;font-family:${FONT};font-size:14px;color:${C.ink};font-weight:500;vertical-align:top;">${escapeHtml(value)}</td>
      </tr>`)
    .join('')

  return {
    html: `<tr>${cell(
      `${title ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:${C.amber};font-weight:600;">${escapeHtml(title)}</p>` : ''}
       <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.raised};border:1px solid ${C.line};border-radius:10px;border-collapse:separate;">
         <tr><td style="padding:6px 18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${body}</table></td></tr>
       </table>`,
      'padding:22px 32px 0;',
    )}</tr>`,
    text: `\n${title || ''}\n${rows
      .filter(([, v]) => v !== '' && v != null)
      .map(([l, v]) => `  ${l}: ${v}`)
      .join('\n')}\n`,
  }
}

function blockAddress({ title, lines = [] }) {
  const clean = lines.filter(Boolean)
  if (clean.length === 0) return null
  return {
    html: `<tr>${cell(
      `<p style="margin:0 0 8px;font-family:${FONT};font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:${C.amber};font-weight:600;">${escapeHtml(title)}</p>
       <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.ink};">${clean.map(escapeHtml).join('<br>')}</p>`,
      'padding:22px 32px 0;',
    )}</tr>`,
    text: `\n${title}\n${clean.map(l => `  ${l}`).join('\n')}\n`,
  }
}

// The order lines plus totals.
//
// NOTE ON TOTALS: the Wix email this replaces prints Subtotal / Shipping / Tax /
// Total. This checkout charges neither shipping nor tax (functions/api/checkout.js
// sets no shipping_options and no automatic_tax), so those rows would be invented
// numbers. Callers pass only the totals they actually hold, and rows with no value
// are dropped rather than rendered as zero.
function blockItems({ title = 'Order details', items = [], totals = [] }) {
  const head = `
    <tr>
      <th align="left" style="padding:0 0 8px;font-family:${FONT};font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};font-weight:600;">Item</th>
      <th align="center" style="padding:0 0 8px;font-family:${FONT};font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};font-weight:600;">Qty</th>
      <th align="right" style="padding:0 0 8px;font-family:${FONT};font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};font-weight:600;">Total</th>
    </tr>`

  const rows = items.map(item => {
    const meta = [item.variant, item.sku ? `SKU ${item.sku}` : '', item.unit ? `${item.unit} each` : '']
      .filter(Boolean).join(' · ')
    return `
      <tr>
        <td style="padding:11px 0;border-top:1px solid ${C.line};font-family:${FONT};font-size:14px;color:${C.ink};">
          ${escapeHtml(item.name)}
          ${meta ? `<br><span style="font-size:12px;color:${C.muted};">${escapeHtml(meta)}</span>` : ''}
        </td>
        <td align="center" style="padding:11px 0;border-top:1px solid ${C.line};font-family:${FONT};font-size:14px;color:${C.muted};">${escapeHtml(item.qty)}</td>
        <td align="right" style="padding:11px 0;border-top:1px solid ${C.line};font-family:${FONT};font-size:14px;color:${C.ink};font-weight:600;white-space:nowrap;">${escapeHtml(item.total)}</td>
      </tr>`
  }).join('')

  const totalRows = totals
    .filter(([, value]) => value !== '' && value != null)
    .map(([label, value, strong]) => `
      <tr>
        <td colspan="2" align="right" style="padding:${strong ? '12px 12px 0' : '5px 12px 0'};font-family:${FONT};font-size:${strong ? '15px' : '13px'};color:${strong ? C.ink : C.muted};font-weight:${strong ? '700' : '400'};">${escapeHtml(label)}</td>
        <td align="right" style="padding:${strong ? '12px 0 0' : '5px 0 0'};font-family:${FONT};font-size:${strong ? '17px' : '13px'};color:${strong ? C.ember : C.muted};font-weight:${strong ? '700' : '400'};white-space:nowrap;">${escapeHtml(value)}</td>
      </tr>`)
    .join('')

  return {
    html: `<tr>${cell(
      `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:${C.amber};font-weight:600;">${escapeHtml(title)}</p>
       <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${head}${rows}${totalRows}</table>`,
      'padding:24px 32px 0;',
    )}</tr>`,
    text: `\n${title}\n${items.map(i => {
      const meta = [i.variant, i.sku ? `SKU ${i.sku}` : ''].filter(Boolean).join(' · ')
      return `  ${i.name}${meta ? ` (${meta})` : ''} x${i.qty} — ${i.total}`
    }).join('\n')}\n${totals.filter(([, v]) => v !== '' && v != null).map(([l, v]) => `  ${l}: ${v}`).join('\n')}\n`,
  }
}

// A quoted block for text a person wrote — an enquiry message, a refund reason.
// Always escaped: this is the only place unfiltered public input reaches an email.
function blockNote({ title, text }) {
  if (!text) return null
  return {
    html: `<tr>${cell(
      `${title ? `<p style="margin:0 0 8px;font-family:${FONT};font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:${C.amber};font-weight:600;">${escapeHtml(title)}</p>` : ''}
       <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.paper};border-left:3px solid ${C.amber};border-radius:0 8px 8px 0;">
         <tr><td style="padding:14px 18px;font-family:${FONT};font-size:14px;line-height:1.65;color:${C.ink};white-space:pre-wrap;">${escapeHtml(text)}</td></tr>
       </table>`,
      'padding:22px 32px 0;',
    )}</tr>`,
    text: `\n${title || 'Message'}\n${String(text).split('\n').map(l => `  > ${l}`).join('\n')}\n`,
  }
}

const BUILDERS = { panel: blockPanel, address: blockAddress, items: blockItems, note: blockNote, heading: b => blockHeading(b.text) }

// --- the shell -------------------------------------------------------------

function paragraph(html, text) {
  if (!text) return null
  return {
    html: `<tr>${cell(`<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.ink};">${html}</p>`, 'padding:22px 32px 0;')}</tr>`,
    text: `\n${text}\n`,
  }
}

function button(label, href) {
  if (!label || !href) return null
  return {
    html: `<tr>${cell(
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
         <td align="center" bgcolor="${C.amber}" style="border-radius:8px;">
           <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 30px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
         </td>
       </tr></table>`,
      'padding:26px 32px 0;',
    )}</tr>`,
    text: `\n${label}: ${href}\n`,
  }
}

/**
 * Render one email.
 *
 * @param template  a row from email_templates (subject, preheader, heading, intro,
 *                  cta_label, outro)
 * @param data      token values for interpolation, plus optional ctaHref
 * @param blocks    ordered block descriptors, e.g.
 *                  [{ type:'panel', title, rows }, { type:'items', items, totals }]
 * @param siteUrl   absolute origin for the logo and links. Resolved by the caller
 *                  with the same precedence checkout.js uses (env.SITE_URL first,
 *                  then the site_url setting) — the stored setting still points at
 *                  the live Wix site and would be wrong on UAT.
 * @param shopName  sender display name, from settings.
 */
export function renderEmail({ template, data = {}, blocks = [], siteUrl = '', shopName = 'Salty Lamps' }) {
  const tokens = { ...data, shop_name: shopName, site_url: siteUrl }

  const subject = interpolateText(template.subject, tokens)
  const preheader = interpolateText(template.preheader, tokens)

  const parts = [
    paragraph(interpolateHtml(template.intro, tokens), interpolateText(template.intro, tokens)),
    ...blocks.map(b => (BUILDERS[b.type] ? BUILDERS[b.type](b) : null)),
    button(interpolateText(template.cta_label, tokens), data.ctaHref),
    paragraph(interpolateHtml(template.outro, tokens), interpolateText(template.outro, tokens)),
  ].filter(Boolean)

  const heading = interpolateText(template.heading, tokens)

  // The preheader is what mail clients show beside the subject in the inbox list.
  // Hidden in the body, then padded with zero-width spaces so the client does not
  // trail the first paragraph's opening words after it.
  const hiddenPreheader = preheader
    ? `<div style="display:none;font-size:1px;color:${C.paper};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%;">
${hiddenPreheader}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.paper};">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:${C.salt};border:1px solid ${C.line};border-radius:14px;overflow:hidden;">

        <tr>
          <td align="center" bgcolor="${C.header}" style="padding:26px 32px;">
            <a href="${escapeHtml(siteUrl)}" style="text-decoration:none;">
              <img src="${escapeHtml(siteUrl)}${LOGO_PATH}" width="104" alt="Salty Lamps" style="display:block;width:104px;max-width:104px;height:auto;border:0;margin:0 auto 14px;">
            </a>
            <h1 style="margin:0;font-family:${FONT};font-size:23px;line-height:1.25;font-weight:700;color:#ffffff;">${escapeHtml(heading)}</h1>
          </td>
        </tr>

        ${parts.map(p => p.html).join('\n')}

        <tr><td style="padding:30px 32px 0;"><div style="height:1px;background:${C.line};line-height:1px;">&nbsp;</div></td></tr>
        <tr>
          <td align="center" style="padding:20px 32px 30px;">
            <p style="margin:0 0 6px;font-family:${FONT};font-size:13px;color:${C.ink};font-weight:600;">Salty Lamps Ltd</p>
            <p style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};">Stoke-on-Trent, United Kingdom<br>Reply to this email and a person will read it.</p>
            <p style="margin:0;font-family:${FONT};font-size:12px;color:${C.muted};"><a href="${escapeHtml(siteUrl)}" style="color:${C.amber};text-decoration:none;">saltylamps.co.uk</a></p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`

  const text = [
    heading,
    '='.repeat(Math.max(heading.length, 4)),
    ...parts.map(p => p.text),
    '',
    '--',
    'Salty Lamps Ltd, Stoke-on-Trent, United Kingdom',
    'Reply to this email and a person will read it.',
    siteUrl,
  ].join('\n').replace(/\n{3,}/g, '\n\n')

  return { subject, html, text }
}
