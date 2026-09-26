import { FRAME_ORIENTATIONS, needsFrameOrientation, validateFrameChoices } from './frame-orientation.mjs'
export const MAX_CART_QUANTITY = 9999
export const MAX_CART_LINES = 100

export class CartError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

// Merge duplicate options before checking stock or passing lines to payment.
export function normaliseCart(items) {
  if (!Array.isArray(items) || !items.length) throw new CartError('Your cart is empty.')
  if (items.length > MAX_CART_LINES) throw new CartError('Please limit your cart to 100 different options.')
  const quantities = new Map()
  const choices = new Map()
  for (const item of items) {
    const { skuId, quantity, orientation } = item || {}
    if (!Number.isSafeInteger(skuId) || skuId < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_CART_QUANTITY)
      throw new CartError(`Enter a whole quantity from 1 to ${MAX_CART_QUANTITY} for each item.`)
    const total = (quantities.get(skuId) || 0) + quantity
    if (total > MAX_CART_QUANTITY) throw new CartError(`You can order up to ${MAX_CART_QUANTITY} of each option online.`)
    if (orientation != null && !FRAME_ORIENTATIONS.includes(orientation)) throw new CartError('Please choose a valid frame orientation.')
    if (orientation) {
      const selected = choices.get(skuId) || {}
      selected[orientation] = (selected[orientation] || 0) + quantity
      choices.set(skuId, selected)
    }
    quantities.set(skuId, total)
  }
  return [...quantities].map(([skuId, quantity]) => ({ skuId, quantity, ...(choices.has(skuId) ? { frame_choices: Object.fromEntries(FRAME_ORIENTATIONS.filter(key => choices.get(skuId)[key]).map(key => [key, choices.get(skuId)[key]])) } : {}) }))
}

export async function readCheckoutCart(db, items) {
  const lines = normaliseCart(items)
  const results = await db.batch(lines.map(({ skuId }) => db.prepare(
    `SELECT s.id, s.sku, s.variant_label, s.price_pence, s.track_mode,
      CASE WHEN s.track_mode='quantity' THEN MAX(0,s.quantity-COALESCE((
        SELECT SUM(ri.quantity) FROM checkout_reservation_items ri
        JOIN checkout_reservations cr ON cr.session_id=ri.session_id
        WHERE ri.sku_id=s.id AND cr.status='active'
      ),0)) ELSE s.quantity END AS quantity, s.in_stock,
      p.id AS product_id, p.name, p.visible, w.product_weight_min_g, w.product_weight_max_g, w.packed_weight_g, w.postal_group, w.weight_public
     FROM skus s JOIN products p ON p.id = s.product_id LEFT JOIN sku_weights w ON w.sku_id = s.id
     WHERE s.id = ? AND p.visible = 1`,
  ).bind(skuId)))
  return lines.map(({ quantity, frame_choices }, index) => {
    const row = results[index].results?.[0]
    if (!row) throw new CartError('An item is no longer available. Remove it from your cart and try again.', 409)
    let selected
    try {
      if (needsFrameOrientation(row)) selected = validateFrameChoices(frame_choices, quantity)
      else if (frame_choices) throw new Error('This product does not have an orientation choice.')
    } catch (error) { throw new CartError(error.message) }
    const name = `${row.name}${row.variant_label ? ` (${row.variant_label})` : ''}`
    const available = row.track_mode === 'binary' ? row.in_stock === 1 : (row.quantity ?? 0) >= quantity
    if (!available) throw new CartError(`${name}: ${row.track_mode === 'quantity' && row.quantity > 0 ? `only ${row.quantity} available. Please reduce the quantity.` : 'currently out of stock. Please remove this item.'}`, 409)
    if (!Number.isSafeInteger(row.price_pence) || row.price_pence <= 0) throw new CartError(`${name} is not available to buy online. Please contact us.`, 409)
    return { ...row, quantity, ...(selected ? { frame_choices: selected } : {}) }
  })
}
