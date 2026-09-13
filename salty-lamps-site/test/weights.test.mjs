import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseWeight,
  validateWeights,
  weightLabel,
  groupWeightLabel,
  validatePostageConfig,
  quotePostage,
  DEFAULT_POSTAGE_CONFIG,
} from '../functions/lib/weights.mjs'

test('weights distinguish missing, explicit clear and invalid input with exact gram conversion', () => {
  assert.equal(parseWeight(undefined), undefined)
  assert.equal(parseWeight(''), null)
  assert.equal(parseWeight('2.501', 'kg'), 2501)
  assert.equal(parseWeight('2501', 'g'), 2501)
  for (const v of [true, {}, [], -1, '0', '1e3', '0.0001', Infinity])
    assert.throws(() => parseWeight(v, 'kg'))
})
test('weight range and packed weight validate together; old clients preserve stored fields', () => {
  const old = {
    product_weight_min_g: 2000,
    product_weight_max_g: 3000,
    packed_weight_g: 3500,
    postal_group: 'Standard',
    weight_public: 1,
  }
  assert.deepEqual(validateWeights({}, old), old)
  assert.throws(
    () => validateWeights({ product_weight_min_g: 4000 }, old),
    /range/,
  )
  assert.throws(
    () => validateWeights({ packed_weight_g: 2500 }, old),
    /packed|Packed/,
  )
  assert.throws(
    () => validateWeights({ product_weight_min_g: null }, old),
    /both/,
  )
  assert.equal(
    validateWeights({ packed_weight_g: null }, old).packed_weight_g,
    null,
  )
})
test('public labels follow chosen option, privacy and group completeness', () => {
  const a = {
    productWeightMinG: 2000,
    productWeightMaxG: 3000,
    weightUnit: 'kg',
  }
  assert.equal(weightLabel(a), '2–3 kg')
  assert.equal(weightLabel({ ...a, productWeightMinG: null }), '')
  assert.equal(
    groupWeightLabel({
      variants: [a, { ...a, productWeightMinG: 4000, productWeightMaxG: 5000 }],
    }),
    '2–5 kg across options',
  )
  assert.equal(
    groupWeightLabel({ variants: [a, {}] }),
    'Weight varies by option',
  )
})
const config = () => ({
  ...DEFAULT_POSTAGE_CONFIG,
  rates: [
    {
      id: 'one',
      group: 'Standard',
      service: 'Tracked',
      country: 'GB',
      postcodes: '',
      min_g: 0,
      max_g: 5000,
      price_pence: 650,
    },
  ],
})
test('rates reject ambiguous overlaps and malformed money; adjacent boundaries are legal', () => {
  const c = config()
  assert.equal(validatePostageConfig(c).rates.length, 1)
  assert.throws(
    () =>
      validatePostageConfig({
        ...c,
        rates: [...c.rates, { ...c.rates[0], id: 'two', min_g: 4000 }],
      }),
    /overlap/,
  )
  assert.equal(
    validatePostageConfig({
      ...c,
      rates: [
        ...c.rates,
        { ...c.rates[0], id: 'two', min_g: 5000, max_g: 10000 },
      ],
    }).rates.length,
    2,
  )
  assert.throws(() =>
    validatePostageConfig({
      ...c,
      rates: [{ ...c.rates[0], price_pence: true }],
    }),
  )
})
test('postage multiplies full packs, matches inclusive upper edge, and never defaults missing to free', () => {
  const c = config()
  const line = { packed_weight_g: 2500, postal_group: 'Standard', quantity: 2 }
  assert.equal(
    quotePostage([line], c, { country: 'GB', postcode: 'SW1A1AA' }).options[0]
      .price_pence,
    650,
  )
  assert.equal(
    quotePostage([{ ...line, quantity: 3 }], c, { country: 'GB' }).status,
    'needs_review',
  )
  assert.equal(
    quotePostage([{ ...line, packed_weight_g: null }], c, { country: 'GB' })
      .total_weight_g,
    null,
  )
  assert.equal(
    quotePostage([line, { ...line, postal_group: 'Heavy' }], c, {
      country: 'GB',
    }).status,
    'needs_review',
  )
  assert.equal(quotePostage([line], c, { country: 'FR' }).options.length, 0)
})

test('checkout metadata preserves recorded weights, including explicitly unknown values', async () => {
  const { weightMetadata, weightsFromMetadata } = await import(
    '../functions/lib/weights.mjs'
  )
  const row = {
    product_weight_min_g: 2000,
    product_weight_max_g: 3000,
    packed_weight_g: 3500,
    postal_group: 'Standard',
    weight_public: 0,
  }
  assert.deepEqual(weightsFromMetadata(weightMetadata(row)), row)
  assert.equal(weightsFromMetadata({}).packed_weight_g, null)
  assert.equal(
    weightsFromMetadata(weightMetadata({})).product_weight_min_g,
    null,
  )
})
