import { test, expect } from '@playwright/test'
test.describe.configure({ mode: 'serial' })
let id, config, skuIds
const weights = {
  product_weight_min_g: 2000,
  product_weight_max_g: 3000,
  packed_weight_g: 3500,
  postal_group: 'QA Standard',
  weight_public: 1,
}
test.beforeAll(async ({ request }) => {
  config = (await (await request.get('/api/admin/postage')).json()).config
  const response = await request.post('/api/admin/products', {
    data: {
      product: {
        name: 'Weight QA Fixture',
        slug: 'weight-qa-fixture',
        categories: 'salt-lamps',
        visible: true,
      },
      skus: [
        {
          sku: 'WQA-S',
          variant_label: 'Small',
          price: '20',
          track_mode: 'binary',
          in_stock: true,
          ...weights,
        },
        {
          sku: 'WQA-L',
          variant_label: 'Large',
          price: '30',
          track_mode: 'binary',
          in_stock: true,
          ...weights,
          product_weight_min_g: 4000,
          product_weight_max_g: 5000,
          packed_weight_g: 5500,
        },
      ],
    },
  })
  expect(response.status()).toBe(201)
  id = (await response.json()).id
  skuIds = (await (await request.get('/api/admin/products')).json()).products
    .find((p) => p.id === id)
    .skus.map((s) => s.id)
})
test.afterAll(async ({ request }) => {
  if (id) await request.delete(`/api/admin/products/${id}`)
  if (config) await request.put('/api/admin/postage', { data: { config } })
})
test('admin product fields save, survive reload, validate and warn before navigation', async ({
  page,
  request,
}) => {
  await page.goto(`/admin/products/${id}`)
  await expect(
    page.getByLabel('Packed shipping weight (kg)').first(),
  ).toHaveValue('3.5')
  await page.getByLabel('Packed shipping weight (kg)').first().fill('3.75')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(
    page.getByLabel('Packed shipping weight (kg)').first(),
  ).toHaveValue('3.75')
  await page.getByLabel('Packed shipping weight (kg)').first().fill('1')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(
    page.getByText(
      'Packed weight must cover the maximum product weight, including packaging.',
    ),
  ).toBeVisible()
  let warned = false
  page.once('dialog', async (d) => {
    warned = true
    await d.dismiss()
  })
  if (await page.getByRole('button', { name: 'Toggle menu' }).isVisible())
    await page.getByRole('button', { name: 'Toggle menu' }).click()
  await page.getByRole('link', { name: 'Inventory', exact: true }).click()
  expect(warned).toBe(true)
  expect(page.url()).toContain(id)
  const p = (
    await (await request.get('/api/admin/products')).json()
  ).products.find((p) => p.id === id)
  expect(p.skus[0].packed_weight_g).toBe(3750)
})
test('product option changes weight; quick view and basket use the selected option', async ({
  page,
}) => {
  await page.goto('/product-page/weight-qa-fixture-small')
  await expect(page.locator('.product-weight-detail')).toContainText('2–3 kg')
  const picker = page.locator('.option-picker')
  await picker.getByRole('button', { name: /Large/ }).click()
  await expect(page.locator('.product-weight-detail')).toContainText('4–5 kg')
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click()
  await expect(page.locator('.cart-line .product-weight-inline')).toHaveText(
    '4–5 kg',
  )
  await page.getByRole('button', { name: /Increase Weight QA/ }).click()
  await expect(page.locator('.cart-line .product-weight-inline')).toHaveText(
    '8–10 kg total product weight',
  )
  await page.getByRole('button', { name: 'Close', exact: true }).first().click()
  await page.goto('/shop')
  await page
    .getByPlaceholder('Lamp, holder, lick, brick...')
    .first()
    .fill('Weight QA')
  await page
    .locator('.product-card')
    .filter({ hasText: 'Weight QA Fixture' })
    .getByRole('button', { name: 'View', exact: true })
    .click()
  await expect(
    page.locator('.quick-view .product-weight-detail'),
  ).toContainText('2–3 kg')
})
test('delivery settings save and convert public display without changing stored grams', async ({
  page,
  request,
}) => {
  await page.goto('/admin/settings')
  await page.getByRole('button', { name: 'Delivery', exact: true }).click()
  await page.getByLabel('Customer weight display unit').selectOption('g')
  await page.getByLabel('Show weight summaries on catalogue cards').check()
  await page.getByRole('button', { name: 'Save delivery settings' }).click()
  await expect(page.getByText('Delivery settings saved.')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Delivery', exact: true }).click()
  await expect(page.getByLabel('Customer weight display unit')).toHaveValue('g')
  await page.goto('/product-page/weight-qa-fixture-small')
  await expect(page.locator('.product-weight-detail')).toContainText(
    '2,000–3,000 g',
  )
  const p = (await (await request.get('/api/products')).json()).products.find(
    (p) => p.skuId === skuIds[0],
  )
  expect(p.productWeightMinG).toBe(2000)
  expect(p.packed_weight_g).toBeUndefined()
})
test('inventory weights and exports carry the same stored values', async ({
  page,
  request,
}) => {
  await page.goto('/admin/inventory')
  await page.getByRole('tab', { name: 'Weights', exact: true }).click()
  await page.getByLabel('Search weights').fill('Weight QA')
  await expect(
    page.getByLabel('Packed shipping weight (kg)').first(),
  ).toHaveValue('3.75')
  await page.getByLabel('Packed shipping weight (kg)').first().fill('3.8')
  await page
    .getByRole('button', { name: 'Save weights (1)', exact: true })
    .click()
  await expect(page.getByText('Weights saved.', { exact: true })).toBeVisible()
  const res = await request.get('/api/admin/reports/postage?kind=weights')
  expect(res.status()).toBe(200)
  expect(await res.text()).toContain('3800')
})
