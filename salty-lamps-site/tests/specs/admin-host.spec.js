// The admin lives on its own hostname, and nowhere else.
//
// This is the file that decides whether it is safe to set ADMIN_HOSTS in
// production. It has to prove BOTH directions, because each failure is bad in a
// different way: if the admin answers on the shop's domain the split has not
// happened, and if it does not answer on the admin domain the owner is locked out
// of their own business.
//
// It also proves that an unconfigured deployment fails closed rather than
// publishing the owner portal on a new preview hostname.
import { expect, test } from '@playwright/test'

const ADMIN_HOST = process.env.E2E_ADMIN_HOST || null
const SPLIT_EXPECTED = Boolean(ADMIN_HOST)
const IS_LOCAL = /127\.0\.0\.1|localhost/.test(process.env.E2E_BASE_URL || 'http://127.0.0.1:8788')

test.describe('admin responses are never cached', () => {
  // A previously-authorised 200 replayed to a stranger is the whole reason this
  // header exists: removing the dev bypass once closed sixteen endpoints while the
  // seventeenth kept serving a cached copy of the catalogue.
  test('every admin API response says no-store', async ({ request }) => {
    const res = await request.get('/api/admin/orders', { failOnStatusCode: false })
    expect(res.headers()['cache-control'] || '').toContain('no-store')
  })
})

test.describe('when the split is not configured', () => {
  test.skip(SPLIT_EXPECTED, 'E2E_ADMIN_HOST is set, so the split is expected')
  test.skip(IS_LOCAL, 'the owner portal is deliberately available on the local development server')

  test('the admin is absent from the site being tested', async ({ page }) => {
    const res = await page.goto('/admin')
    expect(res.status()).toBe(404)
  })

  test('the admin API is absent', async ({ request }) => {
    const res = await request.get('/api/admin/stats', { failOnStatusCode: false })
    expect(res.status()).toBe(404)
  })
})

test.describe('local owner access', () => {
  test.skip(!IS_LOCAL, 'this exception applies only to the local development server')

  test('the owner portal remains usable on the laptop', async ({ page, request }) => {
    expect((await page.goto('/admin')).status()).toBe(200)
    expect((await request.get('/api/admin/stats')).status()).toBe(200)
  })
})

test.describe('when the admin has its own hostname', () => {
  test.skip(!SPLIT_EXPECTED, 'set E2E_ADMIN_HOST=https://admin.example.com to run these')

  test('the customer-facing site does not serve /admin', async ({ page }) => {
    const res = await page.goto('/admin')
    const status = res.status()
    const url = page.url()
    // Either refused outright, or forwarded to the admin hostname. Both are
    // correct; serving it here is not.
    const forwarded = new URL(url).host === new URL(ADMIN_HOST).host
    expect(forwarded || status === 404, `/admin on the shop returned ${status} at ${url}`).toBeTruthy()
  })

  test('the customer-facing site does not serve the admin API', async ({ request }) => {
    const res = await request.get('/api/admin/stats', { failOnStatusCode: false })
    expect(res.status(), 'the admin API must be absent from the shop domain').toBe(404)
  })

  test('the admin hostname does serve the admin', async ({ page }) => {
    const res = await page.goto(`${ADMIN_HOST}/admin`)
    // 200 once signed in; a redirect to a Cloudflare Access sign-in page is also
    // correct and is what production should do.
    expect([200, 302, 303]).toContain(res.status())
  })

  test('the shop still works on the shop hostname', async ({ page }) => {
    // The point of this one is that hiding the admin did not hide anything else.
    // The homepage leads with collections; products live on /shop.
    await page.goto('/')
    await expect(page.locator('a[href^="/collection/"]').first()).toBeVisible()
    await page.goto('/shop')
    await expect(page.locator('a[href^="/product-page/"]').first()).toBeVisible()
  })
})

test.describe('only one hostname is offered to search engines', () => {
  test.skip(!SPLIT_EXPECTED, 'needs a second hostname to compare against')

  test('the admin hostname tells crawlers to stay away', async ({ request }) => {
    const robots = await request.get(`${ADMIN_HOST}/robots.txt`)
    expect((await robots.text())).toContain('Disallow: /')

    const page = await request.get(`${ADMIN_HOST}/`, { failOnStatusCode: false })
    expect(page.headers()['x-robots-tag'] || '').toContain('noindex')
  })

  test('the shop hostname does NOT tell crawlers to stay away', async ({ request }) => {
    const robots = await request.get('/robots.txt')
    const body = await robots.text()
    expect(body, 'the real shop must never be noindexed').not.toMatch(/^Disallow: \/$/m)
    const home = await request.get('/')
    expect(home.headers()['x-robots-tag'] || '').not.toContain('noindex')
  })
})
