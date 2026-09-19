import { test, expect } from '@playwright/test'

test.use({ timezoneId: 'America/New_York' })

test('confirmation shows a complete receipt and truthful sent-email guidance', async ({ page }) => {
  await page.route('**/api/checkout/verify?*', route => route.fulfill({ json: {
    status: 'paid', orderReference: '#PRACTICE', placedAt: '2026-09-19T15:00:00.000Z', customerEmail: 'asim@example.com',
    emailDelivery: { status: 'sent', to: 'asim@example.com' },
    delivery: { name: 'Asim', city: 'Stoke-on-Trent', postcode: 'ST4 3NP', service: 'Tracked delivery' },
    items: [{ id: 'one', name: 'Himalayan salt bowl — 6\" Dia', quantity: 2, unitPricePence: 1499, totalPence: 2998, image: '/media/light-catalogue/bowl8.webp' }],
    totals: { itemsPence: 2998, deliveryPence: 699, totalPence: 3697 },
  } }))
  await page.goto('/checkout/success?session_id=cs_test_practice1234')
  await expect(page.getByRole('heading', { name: 'Thank you. Your order is confirmed.' })).toBeVisible()
  await expect(page.getByText('#PRACTICE')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Products ordered' })).toBeVisible()
  await expect(page.getByText('Himalayan salt bowl — 6\" Dia')).toBeVisible()
  await expect(page.getByText('£36.97')).toBeVisible()
  await expect(page.getByText('asim@example.com')).toBeVisible()
  await expect(page.getByText(/spam or junk folder/i)).toBeVisible()
  await expect(page.getByRole('button', { name: "Let's Chat" })).toHaveCount(0)
})

test('proposal confirmation never claims that a disabled email was sent', async ({ page }) => {
  await page.route('**/api/checkout/verify?*', route => route.fulfill({ json: {
    status: 'paid', orderReference: '#PRACTICE', customerEmail: 'asim@example.com',
    emailDelivery: { status: 'disabled', to: 'asim@example.com' }, items: [],
    delivery: {}, totals: { itemsPence: 0, deliveryPence: 0, totalPence: 0 },
  } }))
  await page.goto('/checkout/success?session_id=cs_test_practice1234')
  await expect(page.getByRole('heading', { name: 'Email is off on this test site' })).toBeVisible()
  await expect(page.getByText(/no message was sent/i)).toBeVisible()
})

test('Admin chart and order dates use the shop day in a US browser', async ({ page, request }) => {
  const data = await (await request.get('/api/admin/stats')).json()
  data.sales_series = [{ day: '2026-09-18', revenue_pence: 0, orders: 0 }, { day: '2026-09-19', revenue_pence: 3698, orders: 1 }]
  data.recent_orders = [{ id: 'cs_test_date_check', created_at: '2026-09-18 23:30:00', customer_email: 'practice@example.com', amount_total_pence: 3698, status: 'paid', fulfilment_status: 'unfulfilled' }]
  await page.route('**/api/admin/stats', route => route.fulfill({ json: data }))
  await page.goto('/admin')
  await expect(page.getByRole('img', { name: 'Daily sales from 18 Sept 2026 to 19 Sept 2026: £36.98 across 1 orders. Each data point includes its daily value.', exact: true })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'practice@example.com' })).toContainText('19 Sept 2026')
})
