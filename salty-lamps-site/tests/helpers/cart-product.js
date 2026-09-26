// These quantity-editing checks need twelve purchasable units. Real catalogue
// stock must not decide whether a keyboard/validation test passes.
export async function fixtureCartProduct(page) {
  // Load before navigation so a fast test teardown cannot dispose an in-flight
  // route.fetch response while this fixture is parsing it.
  const response = await page.request.get('/api/products')
  if (!response.ok()) throw new Error('The cart fixture catalogue is unavailable')
  const data = await response.json()
  const product = data.products.find(p => p.slug === 'angel-shape-himalayan-rock-salt-lamp')
  if (!product) throw new Error('The cart fixture product is missing')
  Object.assign(product, { stock: true, stockQty: 50, price: 29.99 })
  await page.route('**/api/products', route => route.fulfill({ json: data }))
}
