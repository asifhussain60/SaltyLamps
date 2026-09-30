import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fixtureCartProduct } from '../helpers/cart-product.js'

const routes = ['/', '/shop', '/product-page/angel-shape-himalayan-rock-salt-lamp', '/collection/home-gifts', '/gallery', '/process', '/reviews', '/refund-request', '/privacy-policy', '/admin', '/admin/settings/delivery']
for (const route of routes) {
  test(`accessibility and layout: ${route}`, async ({ page }, testInfo) => {
    await page.setViewportSize(testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
    await page.goto(route)
    await expect(page.locator('h1:visible').first()).toBeVisible()
    if (route.includes('product-page')) await expect(page.locator('.product-buy-panel')).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
    const findings = results.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))
    if (process.env.SALTY_VISUAL_AUDIT) {
      const dir = path.resolve('..', '..', '.visual-qa')
      await fs.mkdir(dir, { recursive: true })
      const name = `${testInfo.project.name}-${route.replaceAll('/', '-') || 'home'}`
      await page.screenshot({ path: path.join(dir, `${name}.png`) })
      if (route === '/shop') {
        await page.locator('.product-card').first().scrollIntoViewIfNeeded()
        await page.screenshot({ path: path.join(dir, `${name}-products.png`) })
      }
      await fs.writeFile(path.join(dir, `${name}.json`), JSON.stringify(findings, null, 2))
    }
    expect(findings).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  })
}

test('the cart remains accessible while editing quantities', async ({ page }, testInfo) => {
  await fixtureCartProduct(page)
  await page.setViewportSize(testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
  await page.goto('/product-page/angel-shape-himalayan-rock-salt-lamp')
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click()
  const cart = page.getByRole('dialog', { name: 'Shopping cart' })
  // Changing the quantity starts a delivery check and the Checkout button fades while it
  // runs. Scanning mid-fade measures a half-blended colour (2.57:1) that no visitor sees
  // for more than a moment, so let the check finish and stop animating before the scan.
  const delivery = page.waitForResponse(response => response.url().includes('/api/checkout/delivery'), { timeout: 5000 }).catch(() => null)
  await cart.getByRole('spinbutton').fill('12')
  await expect(cart.getByRole('heading', { name: '12 items' })).toBeVisible()
  await delivery
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  if (process.env.SALTY_VISUAL_AUDIT) {
    const dir = path.resolve('..', '..', '.visual-qa')
    await fs.mkdir(dir, { recursive: true })
    await page.screenshot({ path: path.join(dir, `${testInfo.project.name}-cart.png`) })
  }
  expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([])
})
