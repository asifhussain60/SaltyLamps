import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const ready = { status: 'ready', totalWeightG: 5000, options: [{ service: 'Tracked delivery', pricePence: 699, parcelCount: 1 }] }
const missing = { status: 'needs_review', message: 'We could not prepare delivery for this order. Please try again.', options: [] }
const cartOf = page => page.getByRole('dialog', { name:'Shopping cart' })
async function add(page) {
  await page.goto('/product-page/angel-shape-himalayan-rock-salt-lamp')
  await page.getByRole('button',{name:'Add to cart',exact:true}).click()
  return cartOf(page)
}

test('internal delivery gaps stay private and do not block the payment action',async({page})=>{
  await page.route('**/api/checkout/delivery',route=>route.fulfill({json:missing}))
  const cart=await add(page)
  await cart.getByRole('button',{name:'Checkout',exact:true}).click()
  const main=page.getByRole('main')
  await expect(main).not.toContainText(/confirm delivery|basket is saved|packed weight|Salt bowl/i)
  await expect(main.getByRole('button',{name:'Continue to address',exact:true})).toBeEnabled()
  await expect(main.getByRole('button',{name:'Get help with delivery',exact:true})).toHaveCount(0)
  await expect(main.getByRole('link',{name:'Email us about this basket',exact:true})).toHaveCount(0)
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
  expect(accessibility.violations.map(v=>v.id)).toEqual([])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  if(process.env.CHECKOUT_SCREENSHOTS) await page.screenshot({path:`../outputs/asim-test-suite/checkout-private-${test.info().project.name}.png`})
})

test('correcting an invalid draft by adding the item again restores checkout',async({page})=>{
  await page.route('**/api/checkout/delivery',route=>route.fulfill({json:ready}))
  const cart=await add(page)
  await cart.getByRole('spinbutton').fill('0')
  await expect(cart.getByRole('button',{name:'Checkout',exact:true})).toBeDisabled()
  await cart.getByRole('button',{name:'Close',exact:true}).click()
  await page.getByRole('button',{name:'Add to cart',exact:true}).click()
  await expect(cart.getByRole('spinbutton')).toHaveValue('2')
  await expect(cart.getByRole('button',{name:'Checkout',exact:true})).toBeEnabled()
})

test('checkout stays available while delivery data refreshes',async({page})=>{
  let available=false
  await page.route('**/api/checkout/delivery',route=>route.fulfill({json:available?ready:missing}))
  const cart=await add(page)
  await expect(cart).not.toContainText(/confirm delivery|packed weight/i)
  await expect(cart.getByRole('button',{name:'Checkout',exact:true})).toBeEnabled()
  available=true
  await cart.getByRole('spinbutton').fill('2')
  await expect(cart.getByText('£6.99',{exact:true})).toBeVisible()
  await expect(cart.getByRole('button',{name:'Checkout',exact:true})).toBeEnabled()
})

test('a stalled delivery check times out and retries without losing the basket',async({page})=>{
  let stalled=true, requested=false
  await page.route('**/api/checkout/delivery',async route=>{
    requested=true
    if (!stalled) await route.fulfill({json:ready})
  })
  const cart=await add(page)
  await expect.poll(()=>requested).toBe(true)
  await expect(cart.getByText(/delivery check took too long/)).toBeVisible({timeout:15000})
  stalled=false
  await cart.getByRole('button',{name:'Retry delivery check'}).click()
  await expect(cart.getByText('£6.99',{exact:true})).toBeVisible()
  await expect(cart.getByRole('button',{name:'Checkout',exact:true})).toBeEnabled()
  await expect(cart.getByRole('spinbutton')).toHaveValue('1')
})

test('unavailable product loading is explained in the saved cart and can be retried',async({page})=>{
  await page.route('**/api/checkout/delivery',route=>route.fulfill({json:ready}))
  await add(page)
  let fail=true
  await page.route('**/api/products',route=>fail?route.fulfill({status:503,json:{error:'Unavailable'}}):route.continue())
  await page.reload()
  await page.locator('.cart-button').click()
  const cart=cartOf(page)
  await expect(cart.getByText(/could not refresh product prices/)).toBeVisible()
  fail=false
  await cart.getByRole('button',{name:'Retry product check'}).click()
  await expect(cart.getByRole('button',{name:'Checkout',exact:true})).toBeEnabled()
})

test('a malformed payment response offers recovery rather than sending shoppers to a broken address',async({page})=>{
  await page.route('**/api/checkout/delivery',route=>route.fulfill({json:ready}))
  await page.route('**/api/checkout',route=>route.fulfill({json:{}}))
  const cart=await add(page)
  await cart.getByRole('button',{name:'Checkout',exact:true}).click()
  const main=page.getByRole('main')
  await main.getByLabel('Delivery postcode').fill('ST4 3NP')
  await main.getByRole('button',{name:'Continue to address',exact:true}).click()
  await main.getByLabel('Email address').fill('buyer@example.com')
  await main.getByLabel('Full name').fill('Example Buyer')
  await main.getByLabel('Address line 1').fill('10 High Street')
  await main.getByLabel('Town or city').fill('Stoke-on-Trent')
  await main.getByRole('button',{name:'Continue to payment',exact:true}).click()
  await expect(main.getByRole('status').filter({hasText:'could not open the payment page'})).toBeVisible()
  await expect(main.getByRole('button',{name:'Continue to payment',exact:true})).toBeEnabled()
  await expect(main.getByLabel('Delivery postcode',{exact:true})).toHaveValue('ST4 3NP')
})
