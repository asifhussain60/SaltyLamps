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
