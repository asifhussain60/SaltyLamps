// Only authored instructions are linked. Saved comments and reports remain text.
export const REVIEW_LINKS = {
  home: { 'home page': '/', 'product ranges': '/shop' },
  find: { shop: '/shop' },
  options: {
    'lamp with several sizes': '/product-page/natural-shape-himalayan-crystal-rock-salt-lamp-x-small',
    'Saltwood Frame': '/product-page/saltwood-frames-small',
  },
  info: { gallery: '/gallery', 'customer reviews': '/reviews', 'manufacturing page': '/process', 'contact details': '/#contact', privacy: '/privacy-policy', terms: '/terms-and-conditions', 'returns information': '/return-refund-policy' },
  basket: { 'two different products or options': '/shop', 'basket total': '/checkout' },
  quantity: { 'one available item': '/shop' },
  delivery: { 'Enter a real UK postcode': '/checkout' },
  address: { 'address step': '/checkout' },
  'admin-signin': { administrator: '/admin/welcome', 'welcome page': '/admin/welcome', checklist: '/admin/launch-checklist', products: '/admin/products', orders: '/admin/orders' },
  catalogue: { Products: '/admin/products' },
  'stock-weight': { Inventory: '/admin/inventory', 'packed-weight view': '/admin/inventory?tab=weights' },
  settings: { Settings: '/admin/settings', 'returns page': '/return-refund-policy' },
  pay: { 'lamp bulb': '/product-page/salt-lamp-bulb-15-watts-1pc' },
  'paid-order': { 'new order in the administrator': '/admin/orders' },
  refund: { 'order page': '/admin/orders' },
  welcome: { shop: '/', 'product information': '/admin/products', 'email delivery': '/admin/emails', descriptions: '/admin/products', pictures: '/admin/products', prices: '/admin/products', stock: '/admin/inventory', 'packed weights': '/admin/inventory?tab=weights' },
}

export function instructionParts(text, checkId) {
  const links = REVIEW_LINKS[checkId]
  if (!links) return [{ text }]
  const phrases = Object.keys(links).sort((a, b) => b.length - a.length)
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`\\b(${phrases.map(escape).join('|')})\\b`, 'g')
  return text.split(pattern).filter(Boolean).map(part => ({ text: part, ...(links[part] ? { path: links[part] } : {}) }))
}
