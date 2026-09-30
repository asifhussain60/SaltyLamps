// A description saved in the admin must be what the shop shows, including for the products
// that have fixed reviewed wording, without ever publishing an unsupported health claim.
import { test, expect } from '@playwright/test'

test.skip(!/127\.0\.0\.1|localhost/.test(process.env.E2E_BASE_URL || 'http://127.0.0.1:8788'), 'Writes to the catalogue: disposable local database only')

const shown = async request => (await (await request.get('/api/products')).json()).products.find(p => p.productName === 'Angel Shape Himalayan Rock Salt Lamp')?.description
const angel = async request => (await (await request.get('/api/admin/products')).json()).products.find(p => p.name === 'Angel Shape Himalayan Rock Salt Lamp')
const save = (request, p, description) => request.patch(`/api/admin/products/${p.id}`, {
  data: { name: p.name, slug: p.slug, description, image: p.image, categories: p.categories, tags: p.tags, visible: !!p.visible },
})

test('an edited description reaches the shop, and an unsupported claim is left out', async ({ request }) => {
  const before = await angel(request)
  expect(before, 'the Angel lamp exists in the fixture').toBeTruthy()
  try {
    const edited = `Edited in the admin ${crypto.randomUUID()}.`
    expect((await save(request, before, edited)).ok()).toBe(true)
    expect(await shown(request)).toBe(edited)

    const withClaim = 'A warm lamp. It promotes a calming atmosphere through natural air purification. Each piece is hand finished.'
    expect((await save(request, before, withClaim)).ok()).toBe(true)
    expect(await shown(request)).toBe('A warm lamp. Each piece is hand finished.')
    // What the owner typed is kept as typed in the admin; only the public copy leaves the claim out.
    expect((await angel(request)).description).toBe(withClaim)
  } finally {
    await save(request, before, before.description)
  }
  expect(await shown(request)).toBe(before.description)
})

test('the admin quotes the sentence the shop leaves out, and flags the product in the list', async ({ page, request }) => {
  const p = await angel(request)
  const original = p.description
  try {
    await page.goto(`/admin/products/${p.id}`)
    const box = page.getByRole('textbox', { name: /^Product Detail/ }).first()
    await box.fill('A warm lamp. It offers natural air purification. Each piece is hand finished.')
    await expect(page.getByRole('status').filter({ hasText: 'Left out of the shop' })).toContainText('It offers natural air purification.')
    await box.fill('A plain, honest description.')
    await expect(page.getByText('Left out of the shop')).toHaveCount(0)

    // Saved with a claim, the product carries a badge in the products list.
    expect((await save(request, p, 'A warm lamp. It offers natural air purification.')).ok()).toBe(true)
    await page.goto('/admin/products')
    await expect(page.getByRole('row').filter({ hasText: p.name }).getByText('Wording trimmed')).toBeVisible()
    expect((await save(request, p, 'A plain, honest description.')).ok()).toBe(true)
    await page.goto('/admin/products')
    await expect(page.getByRole('row').filter({ hasText: p.name }).getByText('Wording trimmed')).toHaveCount(0)
  } finally {
    await save(request, p, original)
  }
})

const lede = page => page.locator('.product-lede')

test('Product Description opens with the standard text, and the owner wording replaces it on the shop', async ({ page, request }) => {
  const p = await angel(request)
  try {
    await page.goto(`/product-page/${p.slug}`)
    const standard = (await lede(page).innerText()).trim()
    expect(standard).toContain(p.name)

    await page.goto(`/admin/products/${p.id}`)
    const box = page.getByRole('textbox', { name: /^Product Description/ })
    await expect(box).toHaveValue(standard)
    // Saving without touching it stores nothing, so the product keeps following the standard text.
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
    expect((await angel(request)).intro).toBe('')

    await box.fill('My own opening paragraph. It offers natural air purification.')
    await expect(page.getByRole('status').filter({ hasText: 'Left out of the shop' })).toContainText('It offers natural air purification.')
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
    await page.goto(`/product-page/${p.slug}`)
    await expect(lede(page)).toHaveText('My own opening paragraph.')

    // A caller that does not send the field at all must not wipe the owner wording.
    expect((await save(request, p, p.description)).ok()).toBe(true)
    expect((await angel(request)).intro).toBe('My own opening paragraph. It offers natural air purification.')

    await page.goto(`/admin/products/${p.id}`)
    await box.fill('')
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
    await page.goto(`/product-page/${p.slug}`)
    await expect(lede(page)).toHaveText(standard)
  } finally {
    await request.patch(`/api/admin/products/${p.id}`, { data: { name: p.name, slug: p.slug, description: p.description, intro: '', image: p.image, categories: p.categories, tags: p.tags, visible: !!p.visible } })
  }
})

test('Product Description is filled even when the shop\'s public routes are refused, as they are on the admin host', async ({ page, request }) => {
  // functions/_middleware.js answers 404 to every public /api/* route on the admin hostname.
  // Local runs skip that rule, so simulate it here; a box that borrowed a public route stays empty.
  const p = await angel(request)
  for (const path of ['products', 'categories', 'content']) await page.route(`**/api/${path}`, route => route.fulfill({ status: 404, body: 'Not found' }))
  const copy = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/shop-copy')
  await page.goto(`/admin/products/${p.id}`)
  expect((await copy).status()).toBe(200)
  await expect(page.getByRole('textbox', { name: /^Product Description/ })).toContainText(p.name)
})

test('a product can be created, read, updated and deleted with its Product Description', async ({ page, request }) => {
  const name = `Intro lifecycle ${crypto.randomUUID().slice(0, 8)}`
  let id
  try {
    // CREATE through the screen. The box opens with the standard text for a new product.
    await page.goto('/admin/products/new')
    await page.getByLabel('Name', { exact: true }).fill(name)
    await page.getByLabel('SKU code', { exact: true }).fill('INTRO-LIFE')
    await page.getByLabel('Price (£)', { exact: true }).fill('9.99')
    const intro = page.getByRole('textbox', { name: /^Product Description/ })
    await expect(intro).not.toHaveValue('')
    await intro.fill('Created with my own opening paragraph.')
    await page.getByRole('textbox', { name: /^Product Detail/ }).fill('Created with my own product detail.')
    await page.getByRole('button', { name: 'Create product', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/products\/product_[\w-]+$/)
    id = new URL(page.url()).pathname.split('/').pop()

    // READ: the API, the admin screen after a reload, and the shop all agree.
    const row = async () => (await (await request.get('/api/admin/products')).json()).products.find(p => p.id === id)
    expect(await row()).toMatchObject({ intro: 'Created with my own opening paragraph.', description: 'Created with my own product detail.' })
    await page.reload()
    await expect(page.getByRole('textbox', { name: /^Product Description/ })).toHaveValue('Created with my own opening paragraph.')
    await expect(page.getByRole('textbox', { name: /^Product Detail/ })).toHaveValue('Created with my own product detail.')
    const slug = (await row()).slug
    await page.goto(`/product-page/${slug}`)
    await expect(lede(page)).toHaveText('Created with my own opening paragraph.')
    await expect(page.getByText('Created with my own product detail.')).toBeVisible()

    // UPDATE both boxes independently.
    await page.goto(`/admin/products/${id}`)
    await page.getByRole('textbox', { name: /^Product Description/ }).fill('Updated opening paragraph.')
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
    expect(await row()).toMatchObject({ intro: 'Updated opening paragraph.', description: 'Created with my own product detail.' })
    await page.getByRole('textbox', { name: /^Product Detail/ }).fill('Updated product detail.')
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
    expect(await row()).toMatchObject({ intro: 'Updated opening paragraph.', description: 'Updated product detail.' })

    // The other update routes keep the owner wording: the per-field PATCH with no intro sent.
    const patched = await request.patch(`/api/admin/products/${id}`, { data: { name, slug, description: 'Patched detail.', image: '', categories: '', tags: '', visible: true } })
    expect(patched.ok()).toBe(true)
    expect(await row()).toMatchObject({ intro: 'Updated opening paragraph.', description: 'Patched detail.' })

    // DELETE removes it from the admin list and the shop.
    expect((await request.delete(`/api/admin/products/${id}`)).ok()).toBe(true)
    expect(await row()).toBeUndefined()
    await page.goto(`/product-page/${slug}`)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(lede(page)).toHaveCount(0)
    id = null
  } finally {
    if (id) await request.delete(`/api/admin/products/${id}`)
  }
})
