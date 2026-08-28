// Everything that decides whether this shop is findable.
//
// The expensive failure here is silent. A missing canonical, a sitemap listing a
// URL that 404s, a redirect pointing at a page that was never built — none of them
// break the site, none appear in any log, and all of them cost traffic that takes
// months to earn back. So they are asserted mechanically, on every route the site
// actually builds, rather than spot-checked by eye.
import { expect, test } from '@playwright/test'

const parseLocs = xml => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1])
const pathOf = url => { try { return new URL(url).pathname } catch { return url } }

test.describe('robots and sitemaps', () => {
  test('robots.txt allows the shop, hides the admin, and names the sitemap', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text()
    expect(body).toMatch(/Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/i)
    expect(body).toContain('/admin')
  })

  test('the sitemap index points at children that all parse', async ({ request }) => {
    const index = await request.get('/sitemap.xml')
    expect(index.ok()).toBeTruthy()
    const children = parseLocs(await index.text())
    expect(children.length, 'the index should list child sitemaps').toBeGreaterThan(1)

    for (const child of children) {
      const res = await request.get(pathOf(child))
      expect(res.ok(), `${child} did not load`).toBeTruthy()
      expect(await res.text()).toContain('<urlset')
    }
  })

  test('every URL in every sitemap resolves — no sitemap should advertise a 404', async ({ request }) => {
    const children = parseLocs(await (await request.get('/sitemap.xml')).text())
    const urls = new Set()
    for (const child of children) {
      for (const loc of parseLocs(await (await request.get(pathOf(child))).text())) urls.add(pathOf(loc))
    }
    expect(urls.size).toBeGreaterThan(20)

    const broken = []
    for (const path of urls) {
      const res = await request.get(path, { failOnStatusCode: false })
      if (res.status() >= 400) broken.push(`${path} → ${res.status()}`)
    }
    expect(broken, `sitemap URLs that do not resolve:\n${broken.join('\n')}`).toEqual([])
  })
})

test.describe('what a crawler reads on each page', () => {
  const routes = ['/', '/shop', '/gallery', '/process', '/category/salt-lamps']

  for (const route of routes) {
    test(`${route} carries a title, description, canonical and Open Graph`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveTitle(/.{10,}/)

      const description = await page.locator('meta[name="description"]').getAttribute('content')
      expect(description, `${route} has no meta description`).toBeTruthy()
      expect(description.length).toBeGreaterThan(50)

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
      expect(canonical, `${route} has no canonical`).toMatch(/^https?:\/\//)

      for (const property of ['og:title', 'og:description', 'og:url', 'og:image']) {
        await expect(page.locator(`meta[property="${property}"]`), `${route} is missing ${property}`)
          .toHaveCount(1)
      }
    })
  }

  test('the admin is never offered to search engines', async ({ page }) => {
    await page.goto('/admin')
    const robots = await page.locator('meta[name="robots"]').getAttribute('content').catch(() => null)
    expect(robots || '').toContain('noindex')
  })
})

test.describe('structured data', () => {
  test('a product page emits a valid Product with a complete Offer', async ({ page, request }) => {
    const locs = parseLocs(await (await request.get('/products-sitemap.xml')).text())
    await page.goto(pathOf(locs[0]))

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(blocks.length).toBeGreaterThan(0)

    const nodes = blocks.flatMap(b => {
      const parsed = JSON.parse(b)
      return parsed['@graph'] || [parsed]
    })
    const product = nodes.find(n => n['@type'] === 'Product')
    expect(product, 'no Product node on a product page').toBeTruthy()

    // Google's minimum for a merchant listing: a name, an image, and an offer with
    // a real price in a real currency. Everything under it is what turns a plain
    // blue link into a result with a price on it.
    expect(product.name).toBeTruthy()
    expect(product.image?.length).toBeGreaterThan(0)
    expect(product.offers.priceCurrency).toBe('GBP')
    expect(Number(product.offers.price)).toBeGreaterThan(0)
    expect(product.offers.availability).toMatch(/InStock|OutOfStock/)
    expect(product.offers.itemCondition).toContain('NewCondition')
    expect(product.offers.priceValidUntil, 'a merchant listing without priceValidUntil is often dropped')
      .toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(product.brand?.name).toBeTruthy()

    // Never assert a rating: the shop holds no numeric ratings, so any that
    // appeared here would have been invented — which is a policy violation.
    expect(product.aggregateRating, 'ratings must not be emitted until real ones are collected')
      .toBeUndefined()
  })

  test('a breadcrumb never points at a page that does not exist', async ({ page, request }) => {
    const locs = parseLocs(await (await request.get('/products-sitemap.xml')).text())
    await page.goto(pathOf(locs[0]))
    const nodes = (await page.locator('script[type="application/ld+json"]').allTextContents())
      .flatMap(b => { const p = JSON.parse(b); return p['@graph'] || [p] })
    const crumbs = nodes.find(n => n['@type'] === 'BreadcrumbList')
    if (!crumbs) return

    // Google reports the whole page as invalid if one crumb 404s — which is
    // exactly what a breadcrumb through the all-products bucket used to do.
    for (const item of crumbs.itemListElement) {
      const target = item.item?.['@id'] || item.item || item.url
      if (!target) continue
      const res = await request.get(pathOf(target), { failOnStatusCode: false })
      expect(res.status(), `breadcrumb points at ${target} which returns ${res.status()}`).toBeLessThan(400)
    }
  })

  test('the shop itself is described once, consistently', async ({ page }) => {
    await page.goto('/')
    const nodes = (await page.locator('script[type="application/ld+json"]').allTextContents())
      .flatMap(b => { const p = JSON.parse(b); return p['@graph'] || [p] })
    const stores = nodes.filter(n => n['@type'] === 'Store')
    expect(stores.length).toBe(1)
    expect(stores[0].address?.postalCode).toBeTruthy()
    // The build-time and runtime copies disagreed about this exact character.
    expect(stores[0].url, 'the Store url should be the canonical origin with a trailing slash').toMatch(/\/$/)
  })
})

test.describe('the old Wix addresses still lead somewhere', () => {
  // 54 URLs were indexed on the Wix site and only 17 exist unchanged here, because
  // this shop publishes one page per variant where Wix published one per product.
  // Every one of the rest is a redirect, and a redirect into a 404 earns nothing —
  // which one of the original rules did, pointing at a slug this site never built.
  test('every rule in _redirects lands on a real page', async ({ request }) => {
    const res = await request.get('/_redirects', { failOnStatusCode: false })
    test.skip(!res.ok(), '_redirects is not served as a file on this target')

    const rules = (await res.text()).split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(l => l.split(/\s+/))
      .filter(([from, to]) => from && to && from !== '/*' && !from.includes('*'))

    const broken = []
    for (const [from, to] of rules) {
      const target = await request.get(pathOf(to), { failOnStatusCode: false })
      if (target.status() >= 400) broken.push(`${from} → ${to} → ${target.status()}`)
    }
    expect(broken, `redirects whose destination does not exist:\n${broken.join('\n')}`).toEqual([])
  })
})
