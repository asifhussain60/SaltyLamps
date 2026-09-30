import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertProductionAddress, flattenRichText, productFacts, staticBody, withStaticBody,
} from '../src/content/static-body.mjs'

const shell = `<body>
    <section id="startup-status" aria-live="polite" style="x">
      <h1 style="font-size:1.5rem">Salty Lamps</h1>
      <p id="startup-message">Loading your page…</p>
    </section>
    <div id="root"></div>
  </body>`

test('a crawler gets the product name, price, stock and description without running JavaScript', () => {
  const body = staticBody({
    crumbs: [{ name: 'Home', href: '/' }, { name: 'Salt lamps', href: '/category/salt-lamps' }],
    heading: 'Angel Shape Himalayan Rock Salt Lamp',
    lead: 'A hand-finished angel-shaped lamp.',
    facts: productFacts({ price: 29.99, stock: true, sku: 'RSL-A' }),
  })
  assert.match(body, /<h1>Angel Shape Himalayan Rock Salt Lamp<\/h1>/)
  assert.match(body, /£29\.99/)
  assert.match(body, /Available to order/)
  assert.match(body, /href="\/category\/salt-lamps"/)
})

test('selling copy appears as headed sections and empty sections are left out', () => {
  const body = staticBody({
    heading: 'Lamp',
    sections: [
      { title: 'Care and setup', items: ['Keep dry.', 'Check the bulb.'] },
      { title: 'Why it is worth choosing', text: 'Adds warmth.' },
      { title: 'Empty section', items: [] },
    ],
  })
  assert.match(body, /<h2>Care and setup<\/h2><ul><li>Keep dry\.<\/li>/)
  assert.match(body, /<h2>Why it is worth choosing<\/h2><p>Adds warmth\.<\/p>/)
  assert.doesNotMatch(body, /Empty section/)
})

test('an out-of-stock product says so rather than advertising availability', () => {
  assert.deepEqual(productFacts({ price: 5, stock: false })[1], ['Availability', 'Currently out of stock'])
})

test('shop-supplied text is escaped so a product name cannot inject markup', () => {
  const body = staticBody({ heading: 'Salt <script>alert(1)</script> & "lamps"' })
  assert.doesNotMatch(body, /<script>/)
  assert.match(body, /&lt;script&gt;/)
})

test('the page keeps exactly one h1 once the body is placed and the loading panel is hidden', () => {
  const html = withStaticBody(shell, staticBody({ heading: 'Real heading' }))
  assert.equal((html.match(/<h1/g) || []).length, 1)
  assert.match(html, /<section id="startup-status" hidden/)
  assert.match(html, /<div id="root"><main/)
})

test('highlight fragments flatten to plain words', () => {
  assert.equal(flattenRichText(['Our ', { hl: 'lamps' }, ' glow.']), 'Our lamps glow.')
})

test('the build refuses anything but the real shop address', () => {
  const ok = [{ name: 'sitemap.xml', text: '<loc>https://www.saltylamps.co.uk/shop</loc>' }]
  assert.doesNotThrow(() => assertProductionAddress('https://www.saltylamps.co.uk', ok))
  assert.throws(() => assertProductionAddress('https://test.saltylamps.co.uk', ok), /search engines must be pointed/)
  for (const leak of [
    'https://test.saltylamps.co.uk/shop', 'https://admin.saltylamps.co.uk/', 'https://salty-lamps-staging.pages.dev/', 'http://localhost:8788/',
  ]) {
    assert.throws(() => assertProductionAddress('https://www.saltylamps.co.uk', [{ name: 'x.html', text: leak }]), /private address/, leak)
  }
})
