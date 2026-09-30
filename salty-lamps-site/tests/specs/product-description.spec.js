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
    const box = page.getByRole('textbox', { name: /^Description/ }).first()
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
