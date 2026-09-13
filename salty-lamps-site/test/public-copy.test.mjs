import test from 'node:test'
import assert from 'node:assert/strict'
import { isPublishableReview, publicCollectionSections, publicProduct } from '../functions/lib/public-copy.mjs'
import { buildCollectionSections } from '../functions/lib/section-rules.mjs'

test('public catalogue copy removes unsupported claims and adds grounded kitchen purpose tags', () => {
  const lamp = publicProduct({ productName: 'Fire Basket Himalayan Rock Salt Lamp', description: 'Purifies air with a worm glow', tags: [] })
  assert.match(lamp.description, /warm glow/i)
  assert.doesNotMatch(lamp.description, /purif|air quality/i)

  const bowl = publicProduct({ productName: 'Himalayan Rock Salt Bowl', description: '', tags: [], categories: ['rock-salt-pantry-items'] })
  assert.deepEqual(bowl.tags, ['serving', 'hosting'])
})

test('gift and kitchen sections cannot absorb products from the wrong purpose', () => {
  const giftSections = publicCollectionSections([
    { id: 'home-gifts:gift-sets-offers', parent_id: null, title: 'Gifts', sort_order: 1, rule: { categories: { any: ['special-deal'] } } },
  ], 'home-gifts')
  const giftResult = buildCollectionSections(giftSections, [
    { id: 'horse', stock: true, categories: ['special-deal', 'equestrian-salt-licks'], tags: [] },
    { id: 'lamp', stock: true, categories: ['special-deal'], tags: [] },
  ])
  assert.deepEqual(giftResult[0].groups[0].products.map(p => p.id), ['lamp'])

  const kitchenSections = publicCollectionSections([
    { id: 'kitchen-food:cookware-serving', parent_id: null, title: 'Serving', sort_order: 1, rule: { tags: { any: ['serving'] } } },
    { id: 'kitchen-food:pantry-barware', parent_id: null, title: 'Pantry', sort_order: 2, rule: { categories: { any: ['rock-salt-pantry-items'] } } },
  ], 'kitchen-food')
  const products = [
    publicProduct({ id: 'bowl', stock: true, productName: 'Himalayan Rock Salt Bowl', categories: ['rock-salt-pantry-items'], tags: [] }),
    publicProduct({ id: 'salt', stock: true, productName: 'Himalayan Crystal Culinary Salt', categories: ['rock-salt-pantry-items'], tags: [] }),
  ]
  const kitchenResult = buildCollectionSections(kitchenSections, products)
  assert.deepEqual(kitchenResult.map(s => [s.title, s.groups[0].products.map(p => p.id)]), [['Serving', ['bowl']], ['Pantry', ['salt']]])
})

test('health and air-treatment testimonials are withheld from public reuse', () => {
  assert.equal(isPublishableReview({ quote: 'Delivery was quick and carefully packed.' }), true)
  assert.equal(isPublishableReview({ quote: 'This purified the air and helped asthma.' }), false)
})
