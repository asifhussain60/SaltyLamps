import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function setup(page,request,items=[{skuId:129,qty:2}]) {
 const data=await (await request.get('/api/products')).json()
 const base=data.products[0]
 data.products=data.products.filter(p=>![129,131,133].includes(p.skuId))
 for(const [skuId,weight,price,stockQty] of [[129,1000,3.99,20],[131,5000,11.99,4],[133,10000,16.99,0]]) {
  data.products.push({...base,id:`sku-${skuId}`,skuId,productId:'fixture-salt',productName:'Culinary salt',name:`Culinary salt — ${weight/1000}Kg / Fine`,variantLabel:`${weight/1000}Kg / Fine`,slug:`fixture-salt-${skuId}`,price,stock:stockQty>0,stockQty,productWeightMinG:weight,productWeightMaxG:weight,deliveryNeedsConfirmation:false})
 }
 await page.route('**/api/products',r=>r.fulfill({json:data}))
 await page.addInitScript(items=>{if(!sessionStorage.getItem('salty-lamps-cart'))sessionStorage.setItem('salty-lamps-cart',JSON.stringify(items))},items)
 await page.route('**/api/checkout/delivery',r=>{
  const items=r.request().postDataJSON().items
  const weight=items.reduce((s,i)=>s+(i.skuId===129?1000:5000)*i.quantity,0)
  return r.fulfill({json:{status:'ready',totalWeightG:weight,options:[{service:'Fixture delivery',pricePence:weight>3000?799:399}]}})
 })
 await page.goto('/shop')
 await page.locator('.cart-button').click()
 return page.getByRole('dialog',{name:'Shopping cart'})
}

test('weight changes update price, total product weight, shipping and saved option',async({page,request})=>{
 const cart=await setup(page,request)
 await expect(cart.locator('.cart-option')).toContainText('1 kg')
 await cart.getByRole('combobox').selectOption('131')
 await expect(cart.getByRole('spinbutton')).toHaveValue('2')
 await expect(cart.locator('.cart-line-total strong')).toHaveText('£23.98')
 await expect(cart.locator('.cart-option')).toContainText('10 kg for 2')
 await expect(cart.locator('.cart-total strong')).toHaveText('£31.97')
 await expect(cart.getByRole('combobox')).toBeFocused()
 await cart.getByRole('button',{name:'Checkout',exact:true}).click()
 await expect(page).toHaveURL(/\/checkout$/)
 await expect(page.getByRole('heading',{name:'Review your order'})).toBeVisible()
 await expect(page.getByRole('heading',{name:'Review your order'})).toBeFocused()
 await expect(page.getByRole('main').getByRole('combobox')).toHaveValue('131')
 const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('salty-lamps-cart')))
 expect(saved).toEqual([{skuId:131,qty:2}])
 await page.reload()
 await expect(page.getByRole('main').getByRole('combobox')).toHaveValue('131')
 await expect(page.getByRole('main').getByRole('spinbutton')).toHaveValue('2')
 const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
 expect(results.violations.map(v=>v.id)).toEqual([])
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 if(process.env.REVIEW_SCREENSHOTS) await page.screenshot({path:`../outputs/asim-test-suite/order-review-${test.info().project.name}.png`,fullPage:true})
})

test('changing to an existing option merges quantities and respects stock limits',async({page,request})=>{
 const cart=await setup(page,request,[{skuId:129,qty:2},{skuId:131,qty:3}])
 await cart.getByRole('combobox').first().selectOption('131')
 await expect(cart.getByRole('status').filter({hasText:'Only 4'})).toBeVisible()
 await expect(cart.locator('.cart-line')).toHaveCount(2)
 await cart.getByRole('spinbutton').first().fill('1')
 await cart.getByRole('combobox').first().selectOption('131')
 await expect(cart.locator('.cart-line')).toHaveCount(1)
 await expect(cart.getByRole('spinbutton')).toHaveValue('4')
 await expect(cart.getByRole('combobox')).toHaveValue('131')
 await expect(cart.locator('.cart-line-total strong')).toHaveText('£47.96')
 await expect(cart.locator('option[value="133"]')).toHaveAttribute('disabled','')
})

test('order review passes the changed option and quantity into secure checkout',async({page,request})=>{
 const cart=await setup(page,request)
 await cart.getByRole('button',{name:'Checkout',exact:true}).click()
 const main=page.getByRole('main')
 await main.getByRole('combobox').selectOption('131')
 await expect(main.locator('.cart-total strong')).toHaveText('£31.97')
 let payload
 await page.route('**/api/checkout',r=>{payload=r.request().postDataJSON();return r.fulfill({json:{url:new URL('/checkout/cancelled',page.url()).href,sessionId:'cs_test_review'}})})
 await main.getByRole('button',{name:'Continue to payment',exact:true}).click()
 await expect(page).toHaveURL(/\/checkout\/cancelled$/)
 expect(payload.items).toEqual([{skuId:131,quantity:2}])
})

test('internal delivery gaps stay private and the payment action remains available',async({page,request})=>{
 const cart=await setup(page,request)
 await page.route('**/api/checkout/delivery',r=>r.fulfill({json:{status:'needs_review',message:'Delivery needs confirmation.',itemsNeedingDelivery:[{skuId:129,name:'Test salt'}],options:[]}}))
 await cart.getByRole('button',{name:'Checkout',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Review your order'})).toBeVisible()
 const main=page.getByRole('main')
 await expect(main).not.toContainText(/Delivery needs confirmation|Test salt|packed weight/i)
 await expect(main.getByRole('button',{name:'Get help with delivery',exact:true})).toHaveCount(0)
 await expect(main.getByRole('button',{name:'Continue to payment',exact:true})).toBeEnabled()
})

test('an empty review has a route back to shopping',async({page})=>{
 await page.goto('/checkout')
 await expect(page.getByRole('heading',{name:'Your cart is empty',exact:true})).toBeVisible()
 await expect(page.getByRole('link',{name:'Browse the shop',exact:true})).toHaveAttribute('href','/shop')
})
