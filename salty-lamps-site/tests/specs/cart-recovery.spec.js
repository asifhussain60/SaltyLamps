import { expect, test } from '@playwright/test'

async function addLamp(page) {
  await page.goto('/product-page/angel-shape-himalayan-rock-salt-lamp')
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click()
  return page.getByRole('dialog', { name: 'Shopping cart' })
}

test('type twelve, recover from invalid quantities, remove, and preserve the basket on refresh', async ({ page }) => {
  const cart = await addLamp(page)
  const quantity = cart.getByRole('spinbutton')
  await quantity.fill('12')
  await expect(cart.getByRole('heading', { name: '12 items' })).toBeVisible()
  await expect(cart.locator('.cart-line-total strong')).toHaveText('£359.88')
  for (const invalid of ['', '0', '1.5', '10000']) {
    await quantity.fill(invalid)
    await expect(cart.getByRole('alert')).toContainText('Enter a whole number')
    await expect(cart.getByRole('button', { name: 'Checkout', exact: true })).toBeDisabled()
  }
  await quantity.fill('12')
  await page.reload()
  await page.locator('.cart-button').click()
  await expect(cart.getByRole('spinbutton')).toHaveValue('12')
  await cart.getByRole('button', { name: /^Remove / }).click()
  await expect(cart.getByRole('heading', { name: 'Ready when you are' })).toBeVisible()
  await expect(cart.getByRole('link', { name: 'Continue shopping' })).toBeVisible()
})

test('delivery errors preserve the basket and allow a retry', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/checkout/delivery', async route => {
    attempts++
    await route.fulfill({ status: attempts === 1 ? 503 : 200, json: attempts === 1 ? { error: 'We could not check delivery. Please try again.' } : { status: 'ready', totalWeightG: 3500, options: [{ service: 'Tracked delivery', pricePence: 650, parcelCount: 1 }] } })
  })
  const cart = await addLamp(page)
  await cart.getByRole('button', { name: 'Retry delivery check' }).click()
  await expect(cart.getByText('£6.50', { exact: true })).toBeVisible()
  await expect(cart.getByRole('button', { name: 'Checkout', exact: true })).toBeEnabled()
  await expect(cart.getByRole('spinbutton')).toHaveValue('1')
})

test('closing the cart after adding from quick view restores a usable focus target', async ({ page }) => {
  await page.goto('/shop')
  await page.getByRole('button', { name: 'Choose', exact: true }).first().click()
  await page.locator('.quick-view').getByRole('button', { name: 'Add to cart', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Shopping cart' }).getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.matches('.cart-button, .product-actions button') && !document.activeElement.closest('[inert]')))).toBe(true)
})

for (const source of ['chat', 'trade', 'newsletter']) {
  test(`${source} preserves input after failure and clears it only after acknowledged success`, async ({ page }) => {
    let fail = true
    await page.route('**/api/support/enquiry', route => route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: { message: 'Temporarily unavailable' } } : { ok: true } }))
    await page.goto('/')
    if (source === 'chat') await page.getByRole('button', { name: "Let's Chat" }).click()
    const form = page.locator(source === 'chat' ? '.chat-panel' : source === 'trade' ? '.contact-card' : '.newsletter')
    await form.locator('input[name="email"]').fill('fixture@example.invalid')
    if (source !== 'newsletter') {
      await form.getByLabel('Name', { exact: true }).fill('Test customer')
      await form.getByLabel('Message', { exact: true }).fill('Please help me choose twelve lamps.')
    }
    await form.locator('button[type="submit"]').click()
    await expect(form.getByRole('alert')).toContainText('We could not send this')
    await expect(form.locator('input[name="email"]')).toHaveValue('fixture@example.invalid')
    fail = false
    await form.locator('button[type="submit"]').click()
    await expect(form.getByRole('status')).toContainText('Thanks')
    await expect(form.locator('input[name="email"]')).toHaveValue('')
  })
}

test('an old paid-order link cannot clear a new basket', async ({ page }) => {
  await addLamp(page)
  await page.route('**/api/checkout/verify?*', route => route.fulfill({ json: { status: 'paid', orderReference: 'previous-order' } }))
  await page.goto('/checkout/success?session_id=cs_test_previous123')
  await expect(page.locator('.cart-button')).toContainText('1')
})

test('phone shoppers can reveal filters, search, and recover from no results', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone-specific filter journey')
  await page.goto('/shop')
  await expect(page.locator('.shop-sidebar')).toBeHidden()
  await page.getByRole('button', { name: 'Search and filter', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search products' }).fill('no-such-lamp-12345')
  await expect(page.getByRole('heading', { name: /no matching/i })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search products' }).fill('Angel')
  await expect(page.locator('.product-card')).toHaveCount(1)
})
