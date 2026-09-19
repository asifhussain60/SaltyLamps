export const PENDING_CHECKOUT_KEY = 'salty-lamps-pending-checkout'

export function changeCartOption(cart, key, product, limit = 9999) {
  const current = cart.find(item => item.key === key)
  if (!current || !product || !current.product.productId || product.productId !== current.product.productId)
    return { error: 'This option is no longer available. Please refresh the shop.' }
  if (current.product.skuId === product.skuId) return { cart, merged: false }
  const existing = cart.find(item => item.product.skuId === product.skuId)
  const quantity = current.qty + (existing?.qty || 0)
  const available = Math.min(product.stockQty ?? limit, limit)
  if (!product.stock || quantity > available)
    return { error: `Only ${product.stock ? available : 0} of ${product.name} are available. Reduce the quantity before changing options.` }
  return {
    merged: Boolean(existing),
    cart: existing
      ? cart.filter(item => item.key !== key).map(item => item.key === existing.key ? { ...item, product, qty: quantity } : item)
      : cart.map(item => item.key === key ? { key: String(product.id), product, qty: quantity } : item),
  }
}

// An old success link must not empty a new basket. Only the attempt this browser
// started can reconcile its purchased quantities, and each attempt is consumed once.
export function reconcilePurchasedCart(cart, purchased) {
  if (!Array.isArray(purchased)) return cart
  const quantities = new Map(purchased.filter(line => Number.isSafeInteger(line.skuId) && Number.isSafeInteger(line.quantity) && line.quantity > 0).map(line => [line.skuId, line.quantity]))
  return cart.flatMap(item => {
    const quantity = quantities.get(item.product.skuId)
    if (!quantity) return [item]
    const remaining = item.qty - quantity
    return remaining > 0 ? [{ ...item, qty: remaining }] : []
  })
}
