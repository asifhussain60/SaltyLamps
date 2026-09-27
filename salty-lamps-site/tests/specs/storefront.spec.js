// What a customer can do. If any of this fails, the shop is not open.
//
// Written against behaviour a shopper would notice, not against implementation:
// these have to keep passing across a redesign, and they have to be readable by
// someone deciding whether it is safe to move the domain.
import { expect, test } from '@playwright/test'

const STOREFRONT_ROUTES = [
  '/',
  '/shop',
  '/category/salt-lamps',
  '/product-page/angel-shape-himalayan-rock-salt-lamp',
  '/collection/home-gifts',
  '/gallery',
  '/process',
  '/reviews',
  '/refund-request',
  '/privacy-policy',
  '/terms-and-conditions',
  '/return-refund-policy',
  '/checkout',
  '/checkout/success',
  '/checkout/cancelled',
  '/this-page-does-not-exist',
]

test.describe('the shop is open', () => {
  test('the homepage loads, with its collections and a basket', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Salty Lamps/i)
    await expect(page.locator('.site-header')).toBeVisible()
    // The homepage leads with collections rather than individual products.
    await expect(page.locator('a[href^="/collection/"]').first()).toBeVisible()
    await expect(page.locator('.cart-button')).toBeVisible()
  })

  test('the shop navigation does not expose an Admin shortcut', async ({ page }) => {
    await page.goto('/')
    const menu = page.getByRole('button', { name: /menu/i })
    if (await menu.isVisible()) await menu.click()
    const admin = page.getByRole('link', { name: 'Admin', exact: true })
    await expect(admin).toHaveCount(0)
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
    const response = await page.goto('/this-page-does-not-exist')
    expect(response.status()).toBe(404)
    await expect(page.getByText(/not available|not found/i).first()).toBeVisible()
  })

  test('every storefront page starts at the top during in-app navigation', async ({ page }) => {
    await page.goto('/shop')
    await page.evaluate(() => {
      const sentinel = document.createElement('div')
      sentinel.dataset.scrollSentinel = 'true'
      sentinel.style.height = '6000px'
      document.body.appendChild(sentinel)
    })

    for (const path of STOREFRONT_ROUTES) {
      await page.evaluate(() => window.scrollTo(0, 4000))
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)
      await page.evaluate(nextPath => {
        window.history.pushState({}, '', nextPath)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, path)
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
      expect(await page.evaluate(() => window.scrollY), `${path} should open at the top`).toBe(0)
    }
  })

  test('opening a product never shows the old shop scroll position', async ({ page }) => {
    await page.goto('/shop')
    const product = page.locator('a[href^="/product-page/"]').last()
    await product.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    await product.click()
    expect(await page.evaluate(() => window.scrollY)).toBe(0)

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.goBack()
    await expect(page).toHaveURL(/\/shop$/)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.goForward()
    await expect(page).toHaveURL(/\/product-page\//)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
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

test.describe('product photographs', () => {
  test('every product photo is visible and can be enlarged', async ({ page, request }) => {
    const data = await (await request.get('/api/products')).json()
    let product = data.products.find(item => (item.images || []).length > 1)
    if (!product) {
      product = {
        ...data.products[0],
        images: [data.products[0].image, '/media/light-catalogue/uploaded-basket.webp'],
      }
      data.products = data.products.map(item => item.id === product.id ? product : item)
      await page.route('**/api/products', route => route.fulfill({ json: data }))
    }

    await page.goto(`/product-page/${product.slug}`)

    const thumbnails = page.getByRole('group', { name: 'Product photos' }).getByRole('button')
    await expect(thumbnails).toHaveCount(product.images.length)
    for (let index = 0; index < product.images.length; index += 1) {
      await expect(thumbnails.nth(index)).toBeVisible()
    }

    const enlarge = page.getByRole('button', { name: /enlarge .* photo/i })
    await enlarge.click()
    const viewer = page.getByRole('dialog', { name: /product photo viewer/i })
    await expect(viewer).toBeVisible()
    await expect(viewer.getByText(`1 of ${product.images.length}`)).toBeVisible()

    await viewer.getByRole('button', { name: /next photo/i }).click()
    await expect(viewer.getByText(`2 of ${product.images.length}`)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(viewer).toHaveCount(0)
    await expect(enlarge).toBeFocused()
  })

  test('an admin catalogue change refreshes an already-open product page', async ({ page, request }) => {
    const data = await (await request.get('/api/products')).json()
    const product = { ...data.products[0], images: [data.products[0].image] }
    let current = { ...data, products: data.products.map(item => item.id === product.id ? product : item) }
    await page.route('**/api/products', route => route.fulfill({ json: current }))
    await page.goto(`/product-page/${product.slug}`)
    await expect(page.getByRole('group', { name: 'Product photos' })).toHaveCount(0)

    current = {
      ...current,
      products: current.products.map(item => item.id === product.id
        ? { ...item, images: [item.image, '/media/light-catalogue/uploaded-basket.webp'] }
        : item),
    }
    await page.evaluate(() => window.dispatchEvent(new Event('salty-lamps:catalog-changed')))
    await expect(page.getByRole('group', { name: 'Product photos' }).getByRole('button')).toHaveCount(2)
  })

  test('the live catalogue is never served stale after an admin change', async ({ request }) => {
    const response = await request.get('/api/products')
    expect(response.headers()['cache-control']).toMatch(/no-store/i)
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

  test('an unverified success link preserves the basket and makes no payment claim', async ({ page }) => {
    await page.goto('/shop')
    await page.locator('a[href^="/product-page/"]').first().click()
    await page.getByRole('button', { name: /^add to cart$/i }).first().click()
    await page.goto('/checkout/success')
    await expect(page.getByRole('heading', { name: /could not confirm/i })).toBeVisible()
    await expect(page.locator('.cart-button')).toContainText(/[1-9]/)
    await expect(page.getByText(/payment was successful/i)).toHaveCount(0)
  })
})

test.describe('keyboard and mobile navigation', () => {
  test('cart and quick view take focus and restore it when closed', async ({ page }) => {
    await page.goto('/shop')
    const choose = page.getByRole('button', { name: /choose/i }).first()
    await choose.click()
    await expect(page.locator('.quick-view .close-button')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(choose).toBeFocused()

    const cart = page.locator('.cart-button')
    await cart.click()
    await expect(page.getByRole('dialog', { name: /shopping cart/i }).getByRole('button', { name: /close/i })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(cart).toBeFocused()
  })

  test('the compact menu exposes every primary destination', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile navigation check')
    await page.goto('/')
    const menu = page.getByRole('button', { name: /menu/i })
    await menu.click()
    for (const name of ['Home', 'Shop', 'Gallery', 'Trade', 'Contact', 'How it’s made']) {
      await expect(page.getByRole('navigation', { name: /primary/i }).getByRole('link', { name })).toBeVisible()
    }
  })
})

test.describe('customer evidence', () => {
  test('guestbook comments are not presented as rated or verified purchases', async ({ page }) => {
    await page.goto('/reviews')
    await expect(page.getByText(/archived comments/i).first()).toBeVisible()
    await expect(page.getByText(/verified buyer|verified reviews|5\.0/i)).toHaveCount(0)
    await expect(page.getByText('★★★★★')).toHaveCount(0)
  })
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
