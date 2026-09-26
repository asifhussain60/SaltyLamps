// Reviewed product identity. Orientation is a fulfilment choice, never a new SKU.
export const FRAME_PRODUCT_ID = 'product_1984920f-d499-367d-8f0f-e622486c621a'
export const FRAME_ORIENTATIONS = ['portrait', 'landscape']
export const needsFrameOrientation = product => (product?.productId || product?.product_id) === FRAME_PRODUCT_ID
export const cartLineKey = (skuId, orientation = '') => `sku-${skuId}${orientation ? `:${orientation}` : ''}`
export const cartRequestItem = item => ({ skuId: item.product.skuId, quantity: item.qty, ...(item.orientation ? { orientation: item.orientation } : {}) })
export function validateFrameChoices(choices, quantity) {
  if (!choices || typeof choices !== 'object' || Array.isArray(choices)
      || Object.keys(choices).some(key => !FRAME_ORIENTATIONS.includes(key))) throw new Error('Invalid frame orientation')
  const result = {}
  for (const key of FRAME_ORIENTATIONS) if (Object.hasOwn(choices,key)) {
    if (!Number.isSafeInteger(choices[key]) || choices[key] < 1) throw new Error('Invalid orientation quantity')
    result[key] = choices[key]
  }
  if (Object.values(result).reduce((a,b)=>a+b,0) !== quantity) throw new Error('Choose an orientation for every frame quantity')
  return result
}
export function frameChoicesFromMetadata(raw, quantity) {
  if (!raw) return {} // Orders placed before orientation support retain their history.
  return validateFrameChoices(JSON.parse(raw), quantity)
}
export function formatFrameChoices(choices) {
  return FRAME_ORIENTATIONS.filter(key => choices?.[key]).map(key => `${key === 'portrait' ? 'Portrait' : 'Landscape'} × ${choices[key]}`).join(', ')
}
export function orderVariant(item) {
  const choices = frameChoicesFromMetadata(item.frame_choices_json, item.quantity)
  return [item.variant_label, formatFrameChoices(choices)].filter(Boolean).join(' · ')
}
