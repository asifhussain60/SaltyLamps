import { expect, test } from '@playwright/test'

const collection = '/collection/saltwood-frames'
const isLocal = /127\.0\.0\.1|localhost/.test(process.env.E2E_BASE_URL || 'http://127.0.0.1:8788')

test('the unpriced collection stays off the homepage and offers a project quote on its own page', async ({ page }) => {
  test.setTimeout(75_000)
  await page.goto('/')
  const card = page.locator(`a[href="${collection}"]`).filter({ hasText: 'Saltwood Frames' }).first()
  await expect(card).toHaveCount(0)
  await page.goto(collection)
  await expect(page).toHaveURL(new RegExp(`${collection}$`))
  await expect(page.getByRole('heading', { name: 'Saltwood Frames', exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/\bAura\b|Wooden Frame Collection/i)
  await expect(page.getByRole('link', { name: /request a project quote/i })).toBeVisible()
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
