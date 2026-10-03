import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const products = [
  { id: 'apple', name: 'Apple holder', image: '/media/light-catalogue/apple-holder.webp', visible: 1, option_count: 1 },
  { id: 'frames', name: 'Saltwood Frames', image: '/media/light-catalogue/saltwood-lobby.webp', visible: 1, option_count: 1 },
  { id: 'natural', name: 'Natural lamp', image: '/media/light-catalogue/natural-lamp.webp', visible: 1, option_count: 2 },
  { id: 'hidden', name: 'Hidden product', image: '', visible: 0, option_count: 1 },
]

async function fixture(page) {
  let stored = [...products], revision = '', writes = 0, failure = 0
  await page.route('**/api/admin/products/order', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { products: stored, revision } })
    writes++
    if (failure) return route.fulfill({ status: failure, json: { error: { message: failure === 409 ? 'The saved order has changed.' : 'Could not save the shop order.' } } })
    const body = route.request().postDataJSON()
    stored = body.productIds.map(id => products.find(p => p.id === id))
    revision = body.requestId
    return route.fulfill({ json: { revision } })
  })
  await page.goto('/admin/products')
  await page.getByRole('button', { name: 'Shop order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Arrange your shop' })).toBeVisible()
  return { writes: () => writes, fail: status => { failure = status } }
}

test('arrows edit a draft, hidden products stay out of preview, save persists and discard restores', async ({ page }) => {
  const f = await fixture(page)
  const rows = page.locator('.admin-order-row')
  await page.getByRole('button', { name: 'Move Natural lamp up', exact: true }).click()
  await expect(rows.nth(1)).toContainText('Natural lamp')
  expect(f.writes()).toBe(0)
  await expect(page.locator('.admin-order-preview')).not.toContainText('Hidden product')
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(rows.nth(1)).toContainText('Saltwood Frames')
  await page.getByRole('button', { name: 'Move Natural lamp up', exact: true }).click()
  await page.getByRole('button', { name: 'Save shop order', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Shop order saved' })).toBeVisible()
  expect(f.writes()).toBe(1)
  await page.reload()
  await page.getByRole('button', { name: 'Shop order', exact: true }).click()
  await expect(rows.nth(1)).toContainText('Natural lamp')
})

test('failed saves keep the draft and conflicts require reload; leaving a draft asks first', async ({ page }) => {
  const f = await fixture(page)
  await page.getByRole('button', { name: 'Move Natural lamp up', exact: true }).click()
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Manage products', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Arrange your shop' })).toBeVisible()
  f.fail(500)
  await page.getByRole('button', { name: 'Save shop order', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Could not save')
  await expect(page.locator('.admin-order-row').nth(1)).toContainText('Natural lamp')
  f.fail(409)
  await page.getByRole('button', { name: 'Save shop order', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save shop order', exact: true })).toBeDisabled()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Reload saved order', exact: true }).click()
  await expect(page.locator('.admin-order-row').nth(1)).toContainText('Saltwood Frames')
})

test('keyboard dragging reorders products and the screen is accessible without horizontal overflow', async ({ page }) => {
  await fixture(page)
  const handle = page.getByRole('button', { name: 'Drag Apple holder', exact: true })
  await handle.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Space')
  await expect(page.locator('.admin-order-row').nth(1)).toContainText('Apple holder')
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' })
  const audit = await new AxeBuilder({ page }).include('.admin-order').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('pointer dragging moves a product with no write until save', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'touch interaction is exercised separately')
  const f = await fixture(page)
  const handle = page.getByRole('button', { name: 'Drag Apple holder', exact: true })
  await handle.scrollIntoViewIfNeeded()
  const start = await handle.boundingBox(), target = await page.locator('.admin-order-row').nth(2).boundingBox()
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2, target.y + target.height / 2, { steps: 25 })
  await page.mouse.up()
  await expect(page.locator('.admin-order-row').nth(2)).toContainText('Apple holder')
  expect(f.writes()).toBe(0)
})

test('customers do not receive product ordering controls', async ({ page }) => {
  await page.goto('/shop')
  await expect(page.locator('.product-card').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Shop order', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Save shop order|^Drag / })).toHaveCount(0)
  await expect(page.locator('.admin-order')).toHaveCount(0)
})

test('touch dragging works on a phone without saving automatically', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone touch sensor')
  const f = await fixture(page)
  const handle = page.getByRole('button', { name: 'Drag Apple holder', exact: true })
  await handle.scrollIntoViewIfNeeded()
  const start = await handle.boundingBox(), target = await page.locator('.admin-order-row').nth(1).boundingBox()
  const client = await page.context().newCDPSession(page)
  const x = start.x + start.width / 2, y = start.y + start.height / 2
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  // Exercise the actual press-and-hold activation threshold before moving.
  await page.waitForTimeout(350)
  const endY = target.y + target.height / 2
  for (let step = 1; step <= 16; step++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (endY - y) * step / 16 }] })
    await page.waitForTimeout(20)
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(page.locator('.admin-order-row').nth(1)).toContainText('Apple holder')
  expect(f.writes()).toBe(0)
})

test('save stays on screen when arranging a long catalogue on a phone', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone save bar')
  await fixture(page)
  await page.route('**/api/admin/products/order', route => route.fulfill({ json: {
    revision: '', products: Array.from({ length: 50 }, (_, i) => ({ ...products[0], id: `p-${i}`, name: `Product ${i + 1}` })),
  } }))
  await page.reload()
  await page.getByRole('button', { name: 'Shop order', exact: true }).click()
  await expect(page.locator('.admin-order-row')).toHaveCount(50)
  await expect(page.getByRole('button', { name: 'Save shop order', exact: true })).toBeInViewport()
})
