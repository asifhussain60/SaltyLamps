import assert from 'node:assert/strict'
import test from 'node:test'
import { collectionCategoryMetaDescription, productMetaDescription } from '../src/content/seo.mjs'
import { productGroupSchema, productSchema } from '../src/content/schema.mjs'

test('product search descriptions distinguish variants without keyword stuffing', () => {
  const base = {
    productName: 'Natural salt lamp',
    name: 'Natural salt lamp — Small',
    variantLabel: 'Small',
    description: 'A hand-finished lamp cut from natural Himalayan rock salt. Colour and texture vary.',
    price: 19.99,
    stock: true,
  }
  const small = productMetaDescription(base)
  const large = productMetaDescription({ ...base, name: 'Natural salt lamp — Large', variantLabel: 'Large', price: 29.99 })
  assert.notEqual(small, large)
  assert.match(small, /Small/)
  assert.match(large, /Large/)
  assert.match(small, /£19\.99/)
})

test('a category inside a collection gets its own search description', () => {
  const category = { name: 'Salt lamps', description: 'Warm-glow lamps for bedrooms and lounges.' }
  const collection = { name: 'Home and gifts', shortName: 'homes and gifts' }
  assert.notEqual(collectionCategoryMetaDescription(category, collection), category.description)
  assert.match(collectionCategoryMetaDescription(category, collection), /homes and gifts/i)
})

test('a variant points back to an honest ProductGroup', () => {
  const product = {
    name: 'Natural salt lamp — Small', productName: 'Natural salt lamp', productId: 'lamp-1',
    sku: 'SL-S', description: 'Natural lamp.', price: 19.99, stock: true,
  }
  const group = productGroupSchema(product, { ref: '#group-lamp-1' })
  const variant = productSchema(product, {
    url: 'https://example.test/product/small', imageUrls: ['https://example.test/small.jpg'],
    groupId: product.productId, groupRef: '#group-lamp-1',
  })
  assert.equal(group['@type'], 'ProductGroup')
  assert.equal(group.productGroupID, 'lamp-1')
  assert.deepEqual(variant.isVariantOf, { '@id': '#group-lamp-1' })
  assert.equal(variant.inProductGroupWithID, 'lamp-1')
})
