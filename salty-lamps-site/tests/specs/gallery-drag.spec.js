import { test, expect } from '@playwright/test'

const photos = ['culinary-10kg-fine', 'culinary-5kg-fine', 'culinary-1kg-fine', 'culinary-10kg-coarse', 'culinary-5kg-coarse', 'culinary-1kg-coarse'].map((name, i) => ({ id: i + 1, path: `/media/light-catalogue/${name}.webp` }))
async function fixture(page, count = 6) {
  let stored = photos.slice(0, count), writes = [], failure = false
  await page.route('**/api/admin/products', route => route.fulfill({ json: { products: [{ id: 'gallery-fixture', name: 'Gallery fixture', slug: 'gallery-fixture', description: '', visible: true, image: stored[0]?.path || '', images: stored, skus: [] }] } }))
  await page.route('**/api/admin/products/gallery-fixture/images/order', route => {
    writes.push(route.request().postDataJSON().imageIds)
    if (failure) return route.fulfill({ status: 500, json: { error: { message: 'Could not save image order.' } } })
    stored = writes.at(-1).map(id => photos.find(p => p.id === id))
    return route.fulfill({ json: { images: stored, primary_path: stored[0].path } })
  })
  await page.goto('/admin/products/gallery-fixture')
  await expect(page.locator('.admin-gallery-grid > .admin-gallery-item')).toHaveCount(count)
  return { writes, fail: (value = true) => { failure = value } }
}
const tiles = page => page.locator('.admin-gallery-grid > .admin-gallery-item')
async function drag(page, from, to) {
  const source = tiles(page).nth(from).getByRole('button', { name: /^Drag image/ })
  await source.scrollIntoViewIfNeeded()
  const start = await source.boundingBox(), end = await tiles(page).nth(to).boundingBox()
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2, { steps: 4 })
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 20 })
  await expect(page.locator('.admin-gallery-placeholder')).toHaveCount(1)
}

test('gallery has drag controls and keeps replace/delete without directional buttons', async ({ page }) => {
  await fixture(page)
  await expect(page.getByText('Drag photos to reorder. The first photo is primary.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Move image (left|right)/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Drag image/ })).toHaveCount(6)
  await expect(page.getByRole('button', { name: 'Replace image', exact: true })).toHaveCount(6)
  await expect(page.getByRole('button', { name: 'Delete image', exact: true })).toHaveCount(6)
  const image = await tiles(page).first().locator('img').boundingBox()
  for (const control of [tiles(page).first().getByRole('button', { name: 'Replace image', exact: true }), tiles(page).first().getByRole('button', { name: 'Delete image', exact: true }), tiles(page).first().getByText('Primary', { exact: true })]) {
    expect((await control.boundingBox()).y).toBeGreaterThanOrEqual(image.y + image.height)
  }
})

test('pointer leaves an empty full-size slot at the target and only saves on drop', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'touch checked separately')
  const f = await fixture(page)
  const target = await tiles(page).nth(4).boundingBox()
  await drag(page, 0, 4)
  const slot = page.locator('.admin-gallery-placeholder')
  await expect.poll(async () => Math.abs((await slot.boundingBox()).x - target.x)).toBeLessThan(5)
  await expect.poll(async () => Math.abs((await slot.boundingBox()).y - target.y)).toBeLessThan(5)
  await expect(slot.locator('img')).not.toBeVisible()
  await expect(page.locator('.admin-gallery-overlay img')).toHaveAttribute('src', photos[0].path)
  const floating = await page.locator('.admin-gallery-overlay img').boundingBox()
  expect(floating.width).toBeLessThan((await slot.boundingBox()).width * 0.9)
  expect(f.writes).toEqual([])
  await page.mouse.up()
  await expect.poll(() => f.writes).toEqual([[2, 3, 4, 5, 1, 6]])
  await expect(slot).toHaveCount(0)
  await page.reload()
  await expect(tiles(page).nth(4).locator('img')).toHaveAttribute('src', photos[0].path)
})

test('escape and dropping outside cancel without writing', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'pointer cancellation')
  const f = await fixture(page)
  await drag(page, 0, 2)
  await page.keyboard.press('Escape'); await page.mouse.up()
  await expect(page.locator('.admin-gallery-placeholder')).toHaveCount(0)
  await expect(tiles(page).first().locator('img')).toHaveAttribute('src', photos[0].path)
  await drag(page, 0, 2)
  const grid = await page.locator('.admin-gallery-grid').boundingBox()
  const slot = await page.locator('.admin-gallery-placeholder').boundingBox()
  await page.mouse.move(grid.x + grid.width + 15, slot.y + slot.height / 2, { steps: 20 }); await page.mouse.up()
  await expect(page.locator('.admin-gallery-placeholder')).toHaveCount(0)
  await expect(tiles(page).first().locator('img')).toHaveAttribute('src', photos[0].path)
  expect(f.writes).toEqual([])
})

test('failed saves restore original order and keyboard dragging can retry', async ({ page }) => {
  const f = await fixture(page)
  f.fail()
  const handle = page.getByRole('button', { name: 'Drag image 1', exact: true })
  await handle.scrollIntoViewIfNeeded(); await handle.focus(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space')
  await expect.poll(() => f.writes.length).toBe(1)
  await expect(page.getByText('Could not save image order.', { exact: true })).toBeVisible()
  await expect(tiles(page).first().locator('img')).toHaveAttribute('src', photos[0].path)
  await expect(page.locator('.admin-gallery-placeholder')).toHaveCount(0)
  await expect(handle).toBeEnabled()
  f.fail(false)
  await handle.focus(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space')
  await expect.poll(() => f.writes.length).toBe(2)
  await expect(tiles(page).first().locator('img')).toHaveAttribute('src', photos[1].path)
})

test('touch dragging previews a slot and saves the new primary image', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone touch sensor')
  const f = await fixture(page)
  const source = page.getByRole('button', { name: 'Drag image 1', exact: true })
  await source.scrollIntoViewIfNeeded()
  const start = await source.boundingBox(), end = await tiles(page).nth(1).boundingBox()
  const client = await page.context().newCDPSession(page)
  const x = start.x + start.width / 2, y = start.y + start.height / 2
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await page.waitForTimeout(350)
  for (let step = 1; step <= 16; step++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (end.x + end.width / 2 - x) * step / 16, y: y + (end.y + end.height / 2 - y) * step / 16 }] })
    await page.waitForTimeout(20)
  }
  await expect(page.locator('.admin-gallery-placeholder')).toHaveCount(1)
  expect(f.writes).toEqual([])
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(() => f.writes).toEqual([[2, 1, 3, 4, 5, 6]])
  await expect(tiles(page).first().locator('img')).toHaveAttribute('src', photos[1].path)
})

test('a single image cannot be dragged', async ({ page }) => {
  await fixture(page, 1)
  await expect(page.getByRole('button', { name: 'Drag image 1', exact: true })).toBeDisabled()
})

test('new product pictures reorder locally before creation', async ({ page }) => {
  await page.goto('/admin/products/new')
  await page.locator('.admin-gallery-add input').setInputFiles([
    '../public/media/light-catalogue/culinary-10kg-fine.webp',
    '../public/media/light-catalogue/culinary-5kg-fine.webp',
  ])
  await expect(tiles(page)).toHaveCount(2)
  const first = await tiles(page).first().locator('img').getAttribute('src')
  let writes = 0
  page.on('request', request => { if (request.method() !== 'GET' && request.url().includes('/api/admin/products')) writes++ })
  await page.getByRole('button', { name: 'Drag image 1', exact: true }).scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'Drag image 1', exact: true }).focus()
  await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space')
  await expect(tiles(page).nth(1).locator('img')).toHaveAttribute('src', first)
  await expect(page.getByRole('button', { name: /Move image/ })).toHaveCount(0)
  expect(writes).toBe(0)
})
