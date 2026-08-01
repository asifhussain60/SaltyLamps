// Shared validation rules — the single source of truth for admin input.
//
// Imported by BOTH the admin Pages Functions (server-side, authoritative) and the
// App.jsx admin forms (client-side, immediate feedback), so the two can never drift.
// This mirrors the existing functions/lib/flatten-products.mjs share pattern.
//
// MUST stay pure: no Worker APIs, no DOM APIs, no imports. Plain data in, result out.
//
// Every validator returns { ok, errors, value }:
//   ok     — boolean, true when there are no errors
//   errors — { [field]: message } for the caller to surface (empty when ok)
//   value  — the normalized, coerced object safe to persist (only meaningful when ok)

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // 2 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const LOW_STOCK_THRESHOLD = 5

export const TRACK_MODES = ['quantity', 'binary']
export const PAYMENT_STATUSES = ['pending', 'paid', 'refunded', 'cancelled']
export const FULFILMENT_STATUSES = ['unfulfilled', 'packed', 'shipped', 'delivered']

// Display labels for the enums above. They live next to their values so the admin
// UI stops keeping its own copies (it had three separate hand-written lists, one of
// which silently omitted the 'pending' payment status).
export const TRACK_MODE_LABELS = { quantity: 'Quantity', binary: 'In / out' }
export const PAYMENT_STATUS_LABELS = {
  pending: 'Pending', paid: 'Paid', refunded: 'Refunded', cancelled: 'Cancelled',
}
export const FULFILMENT_LABELS = {
  unfulfilled: 'Unfulfilled', packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered',
}

// The nine theme token sets defined in src/styles/saltylamps.css (.theme-lamp,
// .theme-holder, ...). NOT free text: each one is three CSS custom properties, so a
// category carrying an unknown theme renders with no accent colour at all.
export const CATEGORY_THEMES = [
  'lamp', 'holder', 'kitchen', 'bricks', 'equestrian', 'relaxation', 'accessory', 'deal', 'panel',
]

// ---- primitives -----------------------------------------------------------

export function poundsToPence(pounds) {
  // Accepts a number or a "12.34" string. Returns an integer number of pence,
  // or NaN if it isn't a finite money value. Rounds to avoid float drift.
  const n = typeof pounds === 'string' ? Number(pounds.trim()) : pounds
  if (typeof n !== 'number' || !Number.isFinite(n)) return NaN
  return Math.round(n * 100)
}

export function penceToPounds(pence) {
  return (Number(pence) || 0) / 100
}

export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const isIntInRange = (n, min, max) => Number.isInteger(n) && n >= min && n <= max
const isPlainString = v => typeof v === 'string'
const trimStr = v => (isPlainString(v) ? v.trim() : '')

// A comma-separated list of slug tokens -> normalized "a,b,c" (or '' when empty).
// Validates each token is URL-safe; returns null when any token is malformed.
function normalizeSlugList(input) {
  const raw = Array.isArray(input) ? input : String(input || '').split(',')
  const tokens = raw.map(t => trimStr(t)).filter(Boolean)
  for (const t of tokens) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t)) return null
  }
  return tokens.join(',')
}

// ---- product --------------------------------------------------------------

export function validateProduct(input = {}) {
  const errors = {}
  const value = {}

  const name = trimStr(input.name)
  if (!name) errors.name = 'Name is required.'
  else if (name.length > 200) errors.name = 'Name must be 200 characters or fewer.'
  value.name = name

  // Slug: derive from the name when blank, then validate URL-safety.
  const slug = slugify(input.slug || input.name)
  if (!slug) errors.slug = 'Slug is required (letters, numbers and hyphens).'
  else if (slug.length > 120) errors.slug = 'Slug must be 120 characters or fewer.'
  value.slug = slug

  const description = trimStr(input.description)
  if (description.length > 2000) errors.description = 'Description must be 2000 characters or fewer.'
  value.description = description

  const image = trimStr(input.image)
  if (image.length > 500) errors.image = 'Image path is too long.'
  value.image = image

  const categories = normalizeSlugList(input.categories)
  if (categories === null) errors.categories = 'Categories must be lowercase slugs separated by commas.'
  value.categories = categories || ''

  const tags = normalizeSlugList(input.tags)
  if (tags === null) errors.tags = 'Tags must be lowercase slugs separated by commas.'
  value.tags = tags || ''

  value.visible = input.visible === false || input.visible === 0 || input.visible === '0' ? 0 : 1

  return { ok: Object.keys(errors).length === 0, errors, value }
}

// ---- category -------------------------------------------------------------
// Display metadata only. Product membership lives in products.categories and is
// checked for existence at the endpoint by assertCategoriesExist() in
// admin-helpers.mjs — this module must stay DB-free.

export function validateCategory(input = {}, { isNew = false } = {}) {
  const errors = {}
  const value = {}

  const name = trimStr(input.name)
  if (!name) errors.name = 'Name is required.'
  else if (name.length > 120) errors.name = 'Name must be 120 characters or fewer.'
  value.name = name

  // The slug is the primary key AND the public URL, and products reference it by
  // string. Renaming one would need a data migration across products.categories,
  // so it is settable on create and immutable afterwards.
  if (isNew) {
    const slug = slugify(input.slug || input.name)
    if (!slug) errors.slug = 'Slug is required (letters, numbers and hyphens).'
    else if (slug.length > 120) errors.slug = 'Slug must be 120 characters or fewer.'
    value.slug = slug
  }

  const description = trimStr(input.description)
  if (description.length > 500) errors.description = 'Description must be 500 characters or fewer.'
  value.description = description

  const image = trimStr(input.image)
  if (image.length > 500) errors.image = 'Image path is too long.'
  value.image = image

  const theme = trimStr(input.theme) || 'lamp'
  if (!CATEGORY_THEMES.includes(theme)) {
    errors.theme = `Theme must be one of: ${CATEGORY_THEMES.join(', ')}.`
  }
  value.theme = theme

  const sortOrder = input.sort_order == null || input.sort_order === '' ? 0 : Number(input.sort_order)
  if (!isIntInRange(sortOrder, 0, 100000)) errors.sort_order = 'Sort order must be a whole number.'
  else value.sort_order = sortOrder

  value.visible = input.visible === false || input.visible === 0 || input.visible === '0' ? 0 : 1

  return { ok: Object.keys(errors).length === 0, errors, value }
}

// ---- settings -------------------------------------------------------------
// A whitelist, not a free-form store. Anything not listed here is rejected, so a
// compromised or careless write cannot invent a key that some future reader trusts.

export const SETTING_SPECS = {
  low_stock_threshold: { type: 'int', min: 0, max: 1000, editable: true, label: 'Low-stock threshold' },
  currency: { type: 'string', editable: false, label: 'Currency' },
  // Not a plain string: this value is written straight into the href of every link
  // and the src of the logo in every email. A relative value — typing
  // "saltylamps.co.uk" without the scheme is the obvious mistake — does not resolve
  // at all in a mail client, so the logo and every link in every customer email
  // break at once with nothing in the admin to indicate why.
  site_url: { type: 'url', editable: true, label: 'Site URL', maxLength: 200 },
  // Email. The master switch seeds to off in d1/migrations/005-email.sql because
  // sending needs DKIM/SPF records only the domain owner can add; turn it on after
  // a successful test send from Emails -> Templates.
  email_enabled: { type: 'bool', editable: true, label: 'Send transactional email' },
  // headerSafe because this is interpolated into `From: <name> <address>`. A comma
  // makes a mail API read it as two recipients, and angle brackets or a line break
  // end the display name and start something else in the header.
  email_from_name: { type: 'string', editable: true, label: 'Sender name', maxLength: 100, headerSafe: true },
  email_from_address: { type: 'email', editable: true, label: 'Sender address', maxLength: 200 },
  admin_notify_email: { type: 'email', editable: true, label: 'Admin notification address', maxLength: 200 },
  low_stock_alerts_enabled: { type: 'bool', editable: true, label: 'Low-stock alerts' },
}

// A spec's `type` says how to VALIDATE and how to render the input. The settings
// table's value_type column says how the value is STORED, and its CHECK constraint
// permits only 'string' | 'int' | 'bool' | 'json'. The two are not the same
// vocabulary: 'email' is a validation rule applied to a plain string.
//
// Writing the spec type straight into the column made every save that touched an
// email field fail with "CHECK constraint failed: value_type IN (...)" — and because
// the settings upsert is one batched transaction, it took the rest of the form's
// edits down with it. The migrations always seeded these two rows as 'string', so
// the stored data was right and only the write path was wrong.
const SETTING_STORAGE_TYPES = { email: 'string', url: 'string' }
export const settingStorageType = key =>
  SETTING_STORAGE_TYPES[SETTING_SPECS[key]?.type] || SETTING_SPECS[key]?.type || 'string'

export function coerceSetting(key, raw) {
  const spec = SETTING_SPECS[key]
  if (!spec) return undefined
  if (spec.type === 'int') return Number(raw)
  if (spec.type === 'bool') return raw === '1' || raw === 'true' || raw === true
  return String(raw)
}

// Deliberately permissive: enough to catch a typo or a pasted sentence, not enough
// to reject a legitimate address. Over-strict address regexes reject more real mail
// than they protect against.
const isEmailish = s => /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(s)

// An absolute http(s) origin. Anything else — a bare domain, a relative path, or a
// non-web scheme — cannot be resolved by a mail client and must not be stored.
function normalizeSiteUrl(s) {
  let url
  try {
    url = new URL(s)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  // Trailing slashes are stripped on the way in as well as on the way out
  // (mailer.mjs also strips), so the stored value and every reader agree.
  return url.toString().replace(/\/+$/, '')
}

// Characters that terminate the display name in `From: <name> <address>`, or that a
// mail API reads as a separator between addresses. An apostrophe is deliberately
// allowed — "Sam's Lamps" is a legitimate sender name.
const HEADER_UNSAFE = /[<>"\r\n,;:]/

export function validateSettings(input = {}) {
  const errors = {}
  const value = {}

  for (const [key, raw] of Object.entries(input)) {
    const spec = SETTING_SPECS[key]
    if (!spec) {
      errors[key] = 'Unknown setting.'
      continue
    }
    if (!spec.editable) {
      errors[key] = `${spec.label} is read-only.`
      continue
    }
    if (spec.type === 'int') {
      const n = raw === '' || raw == null ? NaN : Number(raw)
      if (!isIntInRange(n, spec.min ?? 0, spec.max ?? 1000000)) {
        errors[key] = `${spec.label} must be a whole number between ${spec.min ?? 0} and ${spec.max ?? 1000000}.`
      } else {
        value[key] = String(n)
      }
    } else if (spec.type === 'bool') {
      // Stored as '1'/'0' so coerceSetting round-trips it. Without this branch a
      // boolean would fall through to the string case and persist whatever the
      // client sent — including the string "false", which coerces to true.
      value[key] = raw === true || raw === 1 || raw === '1' || raw === 'true' ? '1' : '0'
    } else if (spec.type === 'email') {
      const s = trimStr(raw)
      // An empty address is allowed and means "not configured" — the mailer skips
      // rather than fails. A non-empty one must at least look like an address.
      if (s && !isEmailish(s)) errors[key] = `${spec.label} must be a valid email address.`
      else if (spec.maxLength && s.length > spec.maxLength) {
        errors[key] = `${spec.label} must be ${spec.maxLength} characters or fewer.`
      } else {
        value[key] = s
      }
    } else if (spec.type === 'url') {
      const s = trimStr(raw)
      const normalized = s ? normalizeSiteUrl(s) : ''
      // Empty means "not configured", same as an address: mailer.mjs then falls back
      // to env.SITE_URL or the request origin rather than emitting a broken link.
      if (s && normalized === null) {
        errors[key] = `${spec.label} must be a full web address starting with http:// or https://.`
      } else if (spec.maxLength && normalized.length > spec.maxLength) {
        errors[key] = `${spec.label} must be ${spec.maxLength} characters or fewer.`
      } else {
        value[key] = normalized
      }
    } else {
      const s = trimStr(raw)
      if (spec.maxLength && s.length > spec.maxLength) {
        errors[key] = `${spec.label} must be ${spec.maxLength} characters or fewer.`
      } else if (spec.headerSafe && HEADER_UNSAFE.test(s)) {
        errors[key] = `${spec.label} cannot contain < > " , ; : or a line break.`
      } else {
        value[key] = s
      }
    }
  }

  if (Object.keys(value).length === 0 && Object.keys(errors).length === 0) {
    errors.form = 'Nothing to update.'
  }

  return { ok: Object.keys(errors).length === 0, errors, value }
}

// ---- sku / variant --------------------------------------------------------

export function validateSku(input = {}) {
  const errors = {}
  const value = {}

  const sku = trimStr(input.sku)
  if (!sku) errors.sku = 'SKU code is required.'
  else if (sku.length > 64) errors.sku = 'SKU code must be 64 characters or fewer.'
  value.sku = sku

  const variantLabel = trimStr(input.variant_label ?? input.variantLabel)
  if (variantLabel.length > 120) errors.variant_label = 'Variant label must be 120 characters or fewer.'
  value.variant_label = variantLabel

  // Price is entered in pounds by the form; stored as integer pence.
  const pricePence = input.price_pence != null ? Number(input.price_pence) : poundsToPence(input.price)
  if (!Number.isInteger(pricePence) || pricePence <= 0) {
    errors.price = 'Price must be a positive amount.'
  }
  value.price_pence = pricePence

  const trackMode = trimStr(input.track_mode ?? input.trackMode)
  if (!TRACK_MODES.includes(trackMode)) {
    errors.track_mode = 'Stock mode must be "quantity" or "binary".'
  }
  value.track_mode = trackMode

  if (trackMode === 'quantity') {
    const quantity = input.quantity == null || input.quantity === '' ? NaN : Number(input.quantity)
    if (!isIntInRange(quantity, 0, 1_000_000)) {
      errors.quantity = 'Quantity must be a whole number of 0 or more.'
    }
    value.quantity = Number.isInteger(quantity) ? quantity : null
    // in_stock is derived, never trusted from the client, for quantity SKUs.
    value.in_stock = value.quantity > 0 ? 1 : 0
  } else if (trackMode === 'binary') {
    // Binary SKUs have no count; in_stock is the only signal.
    value.quantity = null
    value.in_stock = input.in_stock === true || input.in_stock === 1 || input.in_stock === '1' ? 1 : 0
  }

  return { ok: Object.keys(errors).length === 0, errors, value }
}

// ---- inventory adjustment (one line) --------------------------------------
// Shape-only: the endpoint must still confirm the SKU's track_mode against the DB
// (a quantity update on a binary SKU, or vice-versa, is rejected there).

export function validateInventoryLine(input = {}) {
  const errors = {}
  const value = {}

  const skuId = Number(input.skuId ?? input.sku_id)
  if (!Number.isInteger(skuId) || skuId < 1) errors.skuId = 'A valid SKU id is required.'
  value.skuId = skuId

  const hasQuantity = input.quantity != null && input.quantity !== ''
  const hasInStock = input.in_stock != null && input.in_stock !== ''

  if (!hasQuantity && !hasInStock) {
    errors.value = 'Provide a quantity or an in-stock flag.'
  }

  if (hasQuantity) {
    const quantity = Number(input.quantity)
    if (!isIntInRange(quantity, 0, 1_000_000)) errors.quantity = 'Quantity must be a whole number of 0 or more.'
    else value.quantity = quantity
  }

  if (hasInStock) {
    value.in_stock = input.in_stock === true || input.in_stock === 1 || input.in_stock === '1' ? 1 : 0
  }

  return { ok: Object.keys(errors).length === 0, errors, value }
}

// ---- order patch (fulfilment + payment status) ----------------------------

export function validateOrderPatch(input = {}) {
  const errors = {}
  const value = {}

  if (input.fulfilment_status != null) {
    if (!FULFILMENT_STATUSES.includes(input.fulfilment_status)) {
      errors.fulfilment_status = 'Invalid fulfilment status.'
    } else {
      value.fulfilment_status = input.fulfilment_status
    }
  }

  if (input.status != null) {
    // Admin may mark an order refunded or cancelled; the endpoint handles the
    // matching Stripe call. Only these two are settable by hand.
    if (!['refunded', 'cancelled'].includes(input.status)) {
      errors.status = 'Only "refunded" or "cancelled" can be set manually.'
    } else {
      value.status = input.status
    }
  }

  if (input.tracking_number != null) {
    const tracking = trimStr(input.tracking_number)
    if (tracking.length > 100) errors.tracking_number = 'Tracking number is too long.'
    else value.tracking_number = tracking
  }

  if (Object.keys(value).length === 0 && Object.keys(errors).length === 0) {
    errors.form = 'Nothing to update.'
  }

  return { ok: Object.keys(errors).length === 0, errors, value }
}

// ---- email templates ------------------------------------------------------
// A whitelist of templates, of the fields the admin may edit within each, and of
// the {{tokens}} each one may reference.
//
// The token whitelist is the point of this table. Wording is admin-editable and
// interpolated at send time, so without a per-template check a typo like
// {{tracking_no}} would reach a customer rendered as an empty string — or worse,
// {{customer_name}} on a low-stock alert, which has no customer. Validating at the
// WRITE path means the mistake is caught by the person making it, in the editor,
// instead of silently in someone's inbox.
//
// SHARED_TOKENS are available everywhere; the per-template list adds to them.

export const SHARED_TOKENS = ['shop_name', 'site_url']

export const EMAIL_EDITABLE_FIELDS = ['subject', 'preheader', 'heading', 'intro', 'cta_label', 'outro']

const ORDER_TOKENS = ['order_ref', 'order_id', 'customer_name', 'order_total', 'order_date']

export const EMAIL_TEMPLATE_SPECS = {
  order_confirmation: { label: 'Order confirmation', audience: 'customer', tokens: ORDER_TOKENS },
  admin_new_order: {
    label: 'New order alert (admin)', audience: 'admin',
    tokens: [...ORDER_TOKENS, 'customer_email', 'payment_method'],
  },
  order_shipped: { label: 'Order despatched', audience: 'customer', tokens: [...ORDER_TOKENS, 'tracking_number'] },
  order_delivered: { label: 'Order delivered', audience: 'customer', tokens: ORDER_TOKENS },
  order_refunded: { label: 'Refund confirmed', audience: 'customer', tokens: ORDER_TOKENS },
  order_cancelled: { label: 'Order cancelled', audience: 'customer', tokens: ORDER_TOKENS },
  admin_refund_request: {
    label: 'Refund request (admin)', audience: 'admin',
    tokens: [...ORDER_TOKENS, 'customer_email', 'reason'],
  },
  admin_enquiry_chat: { label: 'Chat message (admin)', audience: 'admin', tokens: ['name', 'email', 'message'] },
  admin_enquiry_trade: { label: 'Trade enquiry (admin)', audience: 'admin', tokens: ['name', 'email', 'message'] },
  admin_enquiry_newsletter: { label: 'Newsletter signup (admin)', audience: 'admin', tokens: ['name', 'email', 'message'] },
  admin_low_stock: {
    label: 'Low stock alert (admin)', audience: 'admin',
    tokens: ['product_name', 'sku', 'variant_label', 'quantity', 'threshold'],
  },
}

export function tokensFor(key) {
  const spec = EMAIL_TEMPLATE_SPECS[key]
  return spec ? [...SHARED_TOKENS, ...spec.tokens] : [...SHARED_TOKENS]
}

const TOKEN_PATTERN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi

// Every {{token}} in `text` that is not permitted for this template.
export function unknownTokens(text, key) {
  const allowed = new Set(tokensFor(key))
  const bad = []
  for (const match of String(text || '').matchAll(TOKEN_PATTERN)) {
    const token = match[1].toLowerCase()
    if (!allowed.has(token) && !bad.includes(token)) bad.push(token)
  }
  return bad
}

const EMAIL_FIELD_LIMITS = {
  subject: 200, preheader: 200, heading: 120, intro: 1500, cta_label: 40, outro: 1500,
}

// Validates a bulk save: { templates: { key: { subject, ... , enabled }, ... } }.
// Error keys are "<templateKey>.<field>" so the editor can highlight the exact box.
export function validateEmailTemplates(input = {}) {
  const errors = {}
  const value = {}

  for (const [key, patch] of Object.entries(input)) {
    if (!EMAIL_TEMPLATE_SPECS[key]) {
      errors[key] = 'Unknown email template.'
      continue
    }
    const out = {}

    for (const field of EMAIL_EDITABLE_FIELDS) {
      if (patch?.[field] == null) continue
      const text = trimStr(patch[field])
      const limit = EMAIL_FIELD_LIMITS[field]
      if (text.length > limit) {
        errors[`${key}.${field}`] = `Must be ${limit} characters or fewer.`
        continue
      }
      const bad = unknownTokens(text, key)
      if (bad.length) {
        errors[`${key}.${field}`] =
          `Unknown placeholder${bad.length === 1 ? '' : 's'}: ${bad.map(t => `{{${t}}}`).join(', ')}.`
        continue
      }
      out[field] = text
    }

    // A subject is the one field that cannot be blank — a subjectless email is
    // filtered as spam by most providers before anyone sees it.
    if (out.subject === '') errors[`${key}.subject`] = 'Subject is required.'

    if (patch?.enabled != null) {
      out.enabled = patch.enabled === true || patch.enabled === 1 || patch.enabled === '1' ? 1 : 0
    }

    if (Object.keys(out).length > 0) value[key] = out
  }

  if (Object.keys(value).length === 0 && Object.keys(errors).length === 0) {
    errors.form = 'Nothing to update.'
  }

  return { ok: Object.keys(errors).length === 0, errors, value }
}

// ---- public support forms -------------------------------------------------
// These back UNAUTHENTICATED endpoints that trigger outbound email, so the caps
// here are the load-bearing defence against using the shop as a spam relay. The
// honeypot is a field no human ever sees; anything that fills it is a bot.

export const ENQUIRY_SOURCES = ['chat', 'trade', 'newsletter']

export function validateEnquiry(input = {}) {
  const errors = {}
  const value = {}

  const source = trimStr(input.source)
  if (!ENQUIRY_SOURCES.includes(source)) errors.source = 'Unknown enquiry type.'
  value.source = source

  const name = trimStr(input.name)
  if (name.length > 120) errors.name = 'Name must be 120 characters or fewer.'
  value.name = name

  const email = trimStr(input.email)
  if (!email) errors.email = 'An email address is required.'
  else if (!isEmailish(email)) errors.email = 'That does not look like an email address.'
  else if (email.length > 200) errors.email = 'Email address is too long.'
  value.email = email

  const message = trimStr(input.message)
  // Newsletter signups are an address and nothing else, so a message is optional.
  if (source !== 'newsletter' && !message) errors.message = 'Please include a message.'
  else if (message.length > 4000) errors.message = 'Message must be 4000 characters or fewer.'
  value.message = message

  return { ok: Object.keys(errors).length === 0, errors, value }
}

export function validateRefundRequest(input = {}) {
  const errors = {}
  const value = {}

  const orderRef = trimStr(input.order_ref ?? input.orderRef)
  if (!orderRef) errors.order_ref = 'Please enter your order reference.'
  else if (orderRef.length > 120) errors.order_ref = 'Order reference is too long.'
  value.order_ref = orderRef

  const email = trimStr(input.email)
  if (!email) errors.email = 'Please enter the email address you ordered with.'
  else if (!isEmailish(email)) errors.email = 'That does not look like an email address.'
  else if (email.length > 200) errors.email = 'Email address is too long.'
  value.email = email

  const reason = trimStr(input.reason)
  if (!reason) errors.reason = 'Please tell us what is wrong.'
  else if (reason.length > 4000) errors.reason = 'Please keep this to 4000 characters or fewer.'
  value.reason = reason

  return { ok: Object.keys(errors).length === 0, errors, value }
}

// ---- image (client pre-check; server also sniffs magic bytes) -------------

export function validateImageMeta({ size, type } = {}) {
  const errors = {}
  if (typeof size === 'number' && size > MAX_IMAGE_BYTES) {
    errors.image = 'Image must be 2 MB or smaller.'
  }
  if (type && !ALLOWED_IMAGE_TYPES.includes(type)) {
    errors.image = 'Image must be a JPEG, PNG or WebP.'
  }
  return { ok: Object.keys(errors).length === 0, errors, value: { size, type } }
}
