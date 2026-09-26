import { cartLineKey } from '../../functions/lib/frame-orientation.mjs'
export const PENDING_CHECKOUT_KEY = 'salty-lamps-pending-checkout'

export function changeCartOption(cart, key, product, limit = 9999, orientation = undefined) {
  const current = cart.find(item => item.key === key)
  if (!current || !product || !current.product.productId || product.productId !== current.product.productId)
    return { error: 'This option is no longer available. Please refresh the shop.' }
  orientation = orientation ?? current.orientation
  if (current.product.skuId === product.skuId && current.orientation === orientation) return { cart, merged: false }
  const existing = cart.find(item => item.key !== key && item.product.skuId === product.skuId && item.orientation === orientation)
  const quantity = current.qty + (existing?.qty || 0)
  const available = Math.min(product.stockQty ?? limit, limit)
  const sharedQuantity = current.qty + cart.filter(item => item.key !== key && item.product.skuId === product.skuId).reduce((sum,item)=>sum+item.qty,0)
  if (!product.stock || sharedQuantity > available)
    return { error: `Only ${product.stock ? available : 0} of ${product.name} are available. Reduce the quantity before changing options.` }
  return {
    merged: Boolean(existing),
    cart: existing
      ? cart.filter(item => item.key !== key).map(item => item.key === existing.key ? { ...item, product, qty: quantity } : item)
      : cart.map(item => item.key === key ? { key: cartLineKey(product.skuId, orientation), product, qty: quantity, ...(orientation ? { orientation } : {}) } : item),
  }
}

// An old success link must not empty a new basket. Only the attempt this browser
// started can reconcile its purchased quantities, and each attempt is consumed once.
export function reconcilePurchasedCart(cart, purchased) {
  if (!Array.isArray(purchased)) return cart
  const quantities = new Map(purchased.filter(line => Number.isSafeInteger(line.skuId) && Number.isSafeInteger(line.quantity) && line.quantity > 0).map(line => [cartLineKey(line.skuId,line.orientation), line.quantity]))
  return cart.flatMap(item => {
    const quantity = quantities.get(cartLineKey(item.product.skuId,item.orientation))
    if (!quantity) return [item]
    const remaining = item.qty - quantity
    return remaining > 0 ? [{ ...item, qty: remaining }] : []
  })
}
