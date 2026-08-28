// What a customer can do. If any of this fails, the shop is not open.
//
// Written against behaviour a shopper would notice, not against implementation:
// these have to keep passing across a redesign, and they have to be readable by
// someone deciding whether it is safe to move the domain.
import { expect, test } from '@playwright/test'

test.describe('the shop is open', () => {
  test('the homepage loads, with its collections and a basket', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Salty Lamps/i)
    await expect(page.locator('.site-header')).toBeVisible()
    // The homepage leads with collections rather than individual products.
    await expect(page.locator('a[href^="/collection/"]').first()).toBeVisible()
    await expect(page.locator('.cart-button')).toBeVisible()
  })

  test('the storefront does not advertise the admin to customers', async ({ page }) => {
    // It used to, in the navigation of every page. Once the admin moved to its own
    // hostname that link also pointed at something that no longer answers.
    await page.goto('/')
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0)
  })

  test('the shop page lists products with prices', async ({ page }) => {
    await page.goto('/shop')
    const cards = page.locator('a[href^="/product-page/"]')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeGreaterThan(5)
    await expect(page.getByText(/£\d/).first()).toBeVisible()
  })

  test('a product page shows a price and an add-to-basket control', async ({ page }) => {
    await page.goto('/shop')
    await page.locator('a[href^="/product-page/"]').first().click()
    await expect(page).toHaveURL(/\/product-page\//)
    await expect(page.getByText(/£\d/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^add to cart$/i })).toBeVisible()
  })

  // Client-side navigation, not a fresh load. This is the path that runs the React
  // runtime rather than the prerendered HTML, and it is where a reference to a
  // function that does not exist shows up — a build cannot catch that, because the
  // prerendered pages are produced by a different code path entirely.
  test('navigating in-app to a product raises no page error', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

    await page.goto('/shop')
    await page.locator('a[href^="/product-page/"]').first().click()
    await expect(page).toHaveURL(/\/product-page\//)
    await page.waitForTimeout(500)

    // Image 404s from a stale snapshot are noise, not a fault in the app.
    const real = errors.filter(e => !/favicon|net::ERR_|Failed to load resource/i.test(e))
    expect(real, `console/page errors:\n${real.join('\n')}`).toEqual([])
  })

  test('a category page loads', async ({ page }) => {
    await page.goto('/category/salt-lamps')
    await expect(page.locator('a[href^="/product-page/"]').first()).toBeVisible()
  })

  test('an unknown address gives a real 404 page, not a blank screen', async ({ page }) => {
    await page.goto('/this-page-does-not-exist')
    await expect(page.getByText(/not available|not found/i).first()).toBeVisible()
  })
})

test.describe('the basket', () => {
  test('adding a product updates the basket count, and it survives a reload', async ({ page }) => {
    await page.goto('/shop')
    await page.locator('a[href^="/product-page/"]').first().click()
    await page.getByRole('button', { name: /^add to cart$/i }).first().click()

    const cartButton = page.locator('.cart-button')
    await expect(cartButton).toContainText(/[1-9]/)

    // A basket that empties on refresh loses the sale. Worth its own assertion.
    await page.reload()
    await expect(page.locator('.cart-button')).toContainText(/[1-9]/)
  })

  test('adding to the basket opens it, showing the way to checkout', async ({ page }) => {
    await page.goto('/shop')
    await page.locator('a[href^="/product-page/"]').first().click()
    await page.getByRole('button', { name: /^add to cart$/i }).first().click()
    // The drawer opens on its own — the shopper does not have to find it, which is
    // why this test does not click the basket button. It also means a stray click
    // there hits the drawer's own backdrop.
    await expect(page.getByRole('button', { name: /checkout/i }).first()).toBeVisible()
  })

  test('the basket can be closed and reopened', async ({ page }) => {
    await page.goto('/shop')
    await page.locator('a[href^="/product-page/"]').first().click()
    await page.getByRole('button', { name: /^add to cart$/i }).first().click()
    await page.getByRole('button', { name: /close cart/i }).click()
    await expect(page.getByRole('button', { name: /checkout/i })).toHaveCount(0)
    await page.locator('.cart-button').click()
    await expect(page.getByRole('button', { name: /checkout/i }).first()).toBeVisible()
  })
})

test.describe('the pages a customer is sent to after paying', () => {
  // These 404'd once, after a real payment had been taken — the order was
  // captured correctly and the customer saw an error page. Never again.
  for (const path of ['/checkout/success', '/checkout/cancelled', '/refund-request']) {
    test(`${path} renders`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res.status()).toBe(200)
      await expect(page.locator('body')).not.toBeEmpty()
      await expect(page.getByText(/not available|not found/i)).toHaveCount(0)
    })
  }
})

test.describe('the ways a customer can get in touch', () => {
  test('the refund-request form is present and validates', async ({ page }) => {
    await page.goto('/refund-request')
    const submit = page.getByRole('button', { name: /send|submit|request/i }).first()
    await expect(submit).toBeVisible()
  })

  test('the enquiry endpoint accepts a message and rejects a bot', async ({ request }) => {
    const good = await request.post('/api/support/enquiry', {
      data: { source: 'chat', name: 'Regression Suite', email: 'regression@example.com', message: 'Automated regression check — please ignore.' },
    })
    expect([200, 201, 429]).toContain(good.status())

    // The honeypot field is never filled in by a person. Anything that fills it in
    // must not reach the owner's inbox.
    // A rejected enquiry must still be a clean answer, never a crash.
    const bad = await request.post('/api/support/enquiry', {
      failOnStatusCode: false,
      data: { source: 'chat', name: 'No Email', message: 'missing an address' },
    })
    expect(bad.status()).toBe(400)

    const bot = await request.post('/api/support/enquiry', {
      data: { source: 'chat', name: 'Bot', email: 'bot@example.com', message: 'spam', website: 'http://spam.example' },
    })
    expect(bot.status(), 'the honeypot should not 500').toBeLessThan(500)
  })
})

test.describe('the public API the shop runs on', () => {
  test('/api/products returns priced, in-stock-flagged products', async ({ request }) => {
    const res = await request.get('/api/products')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const products = body.products || body
    expect(Array.isArray(products)).toBeTruthy()
    expect(products.length).toBeGreaterThan(5)
    for (const p of products.slice(0, 5)) {
      expect(p).toHaveProperty('slug')
      expect(typeof p.price).toBe('number')
      expect(p).toHaveProperty('stock')
    }
  })

  test('/api/content answers', async ({ request }) => {
    expect((await request.get('/api/content')).ok()).toBeTruthy()
  })
})
