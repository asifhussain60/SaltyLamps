import test from 'node:test'
import assert from 'node:assert/strict'
import { hasUnsupportedClaim, unsupportedSentences, isPublishableReview, publicCollectionSections, publicProduct, withoutUnsupportedClaims } from '../functions/lib/public-copy.mjs'
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

const ANGEL = 'Angel Shape Himalayan Rock Salt Lamp'

test('the live shop shows what the owner saved, even for a product with fixed reviewed wording', () => {
  const edited = publicProduct({ productName: ANGEL, description: 'A new description written in the admin.', tags: [] }, { useStoredDescription: true })
  assert.equal(edited.description, 'A new description written in the admin.')
})

test('the build-time pages and a call without the option keep the reviewed wording', () => {
  const stored = { productName: ANGEL, description: 'Legacy export text.', tags: [] }
  assert.match(publicProduct(stored).description, /^A hand-finished angel-shaped lamp/)
  assert.match(publicProduct(stored, {}).description, /^A hand-finished angel-shaped lamp/)
  // Array.map passes the index as the second argument; that must not switch the behaviour on.
  assert.match([stored].map(publicProduct)[0].description, /^A hand-finished angel-shaped lamp/)
})

test('an unsupported claim is left out of the owner wording, and the rest is kept', () => {
  const saved = 'A warm lamp. It promotes a calming atmosphere through natural air purification. Each piece is hand finished.'
  const shown = publicProduct({ productName: ANGEL, description: saved, tags: [] }, { useStoredDescription: true }).description
  assert.equal(shown, 'A warm lamp. Each piece is hand finished.')
  assert.equal(hasUnsupportedClaim(saved), true)
  assert.equal(hasUnsupportedClaim(shown), false)
  assert.equal(withoutUnsupportedClaims('Nothing risky here.'), 'Nothing risky here.')
})

test('when every sentence is an unsupported claim the reviewed wording is used, and unnamed products still show their text', () => {
  const allBad = publicProduct({ productName: ANGEL, description: 'Purifies the room. It improves air quality.', tags: [] }, { useStoredDescription: true })
  assert.match(allBad.description, /^A hand-finished angel-shaped lamp/)
  const other = publicProduct({ productName: 'Some Other Lamp', description: 'Plain lamp text with a worm glow.', tags: [] }, { useStoredDescription: true })
  assert.equal(other.description, 'Plain lamp text with a warm glow.')
  const blank = publicProduct({ productName: 'Some Other Lamp', description: '', tags: [] }, { useStoredDescription: true })
  assert.equal(blank.description, '')
})

test('the admin can quote exactly which sentences the shop leaves out', () => {
  const saved = 'A warm lamp. It promotes a calming atmosphere through natural air purification. Each piece is hand finished.'
  assert.deepEqual(unsupportedSentences(saved), ['It promotes a calming atmosphere through natural air purification.'])
  assert.deepEqual(unsupportedSentences('Nothing risky here.'), [])
  assert.equal(withoutUnsupportedClaims(saved), 'A warm lamp. Each piece is hand finished.')
})
