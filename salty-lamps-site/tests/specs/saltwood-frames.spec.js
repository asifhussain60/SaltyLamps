import { expect, test } from '@playwright/test'

const collection = '/collection/saltwood-frames'
const isLocal = /127\.0\.0\.1|localhost/.test(process.env.E2E_BASE_URL || 'http://127.0.0.1:8788')

test('the unpriced collection offers a project quote without a buy action', async ({ page }) => {
  test.setTimeout(75_000)
  const catalog = page.waitForResponse(response => response.url().endsWith('/api/products') && response.status() === 200)
  await page.goto('/')
  await catalog
  const card = page.locator(`a[href="${collection}"]`).filter({ hasText: 'Saltwood Frames' }).first()
  if (await card.count()) await expect(card).not.toContainText(/£\d/)
  await page.goto(collection)
  await expect(page).toHaveURL(new RegExp(`${collection}$`))
  await expect(page.getByRole('heading', { name: 'Saltwood Frames', exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/\bAura\b|Wooden Frame Collection/i)
  await expect(page.getByRole('link', { name: /request a project quote/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /add to cart/i })).toHaveCount(0)
  await page.getByRole('button', { name: 'Play the Saltwood Frames film', exact: true }).click()
  const video = page.locator('.collection-hero-video video')
  await expect.poll(() => video.evaluate(v => v.currentTime)).toBeGreaterThan(2)
  expect(await video.evaluate(v => v.duration)).toBeCloseTo(45, 1)
  expect(await video.evaluate(v => v.error?.code)).toBeUndefined()
  await expect(video).toHaveAttribute('src', /saltwood-frames-hero-16x9\.mp4/)
  // Wrangler's local asset server ignores byte ranges; exercise continuous playback there.
  if (!['127.0.0.1', 'localhost'].includes(new URL(page.url()).hostname)) {
    await video.evaluate(v => { v.currentTime = 38 })
  }
  await expect.poll(() => video.evaluate(v => v.currentTime), { timeout: 50_000 }).toBeGreaterThan(39)
  expect(await video.evaluate(v => v.muted)).toBe(false)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
})

test('legacy collection and media addresses redirect to the replacements', async ({ request }) => {
  const paths = [
    ['/collection/aura-collection', collection],
    ['/collection/wooden-frame-collection', collection],
    ['/collection/wooden-frame-collection/salt-wall-panels', `${collection}/salt-wall-panels`],
    ['/media/video/collection/wooden-frame-collection-hero-16x9.mp4', '/media/video/collection/saltwood-frames-hero-16x9.mp4'],
    ['/collection/aura-collection/salt-wall-panels', `${collection}/salt-wall-panels`],
    ['/category/auraframes-uk', collection],
    ['/product-page/saltwood-frame', collection],
    ['/media/video/collection/aura-collection-hero-16x9.mp4', '/media/video/collection/saltwood-frames-hero-16x9.mp4'],
  ]
  for (const [oldPath, newPath] of paths) {
    const response = await request.get(oldPath, { maxRedirects: 0 })
    expect(response.status(), oldPath).toBe(301)
    expect(new URL(response.headers().location, response.url()).pathname).toBe(newPath)
  }
})


test('admin categories and products retain Saltwood Frames branding', async ({ request }) => {
  test.skip(!isLocal, 'the public deployment deliberately does not expose owner data')
  const categories = await request.get('/api/admin/categories')
  expect(categories.status()).toBe(200)
  const category = (await categories.json()).categories.find(c => c.slug === 'salt-wall-panels')
  expect(category.name).toBe('Saltwood Frames')
  expect(category.image).toContain('saltwood-frames')
  expect(category.visible).toBe(0)
  const products = await request.get('/api/admin/products')
  expect(products.status()).toBe(200)
  const payload = await products.json()
  expect(JSON.stringify(payload)).not.toMatch(/Wooden Frame Collection|Aura Collection/)
  expect(JSON.stringify(payload)).toContain('Saltwood Frames')
})

test('the Saltwood Frames category can be made visible in Admin', async ({ page }) => {
  test.skip(!isLocal, 'the deployed admin is protected')

  let category = {
    slug: 'salt-wall-panels',
    name: 'Saltwood Frames',
    description: 'Illuminated Himalayan salt wall art in hand-finished wood frames.',
    image: '/media/light-catalogue/saltwood-lobby.webp',
    theme: 'panel',
    sort_order: 100,
    visible: 0,
    is_virtual: 0,
    product_count: 1,
  }

  await page.route('**/api/admin/categories', async route => {
    if (route.request().method() !== 'GET') return route.continue()
    await route.fulfill({ json: { categories: [category] } })
  })
  await page.route('**/api/admin/categories/salt-wall-panels', async route => {
    const submitted = route.request().postDataJSON()
    expect(submitted.visible).toBe(true)
    category = { ...category, visible: 1 }
    await route.fulfill({ json: { slug: category.slug } })
  })

  await page.goto('/admin/categories')
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Saltwood Frames still has 1 product. Hide it here by turning Visible off and saving, or reassign those products before deleting it.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Edit Saltwood Frames' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit' }).click()
  const visible = page.getByRole('checkbox')
  await expect(visible).not.toBeChecked()
  await visible.check()
  await expect(visible).toBeChecked()
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('row').filter({ hasText: 'Saltwood Frames' })).toContainText('Yes')
})
