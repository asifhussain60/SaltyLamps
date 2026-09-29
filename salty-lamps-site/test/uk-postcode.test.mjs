import test from 'node:test'
import assert from 'node:assert/strict'
import { formatUkPostcode, isUkPostcode, sanitiseUkPostcodeInput } from '../functions/lib/uk-postcode.mjs'

test('UK postcodes can be typed or pasted with case and spacing variations', () => {
  for (const postcode of ['ST4 3NP', 'st43np', 'SW1A 1AA', 'M1 1AE', 'BT1 1AA', 'GIR 0AA']) {
    assert.equal(isUkPostcode(postcode), true, postcode)
  }
  assert.equal(formatUkPostcode('st43np'), 'ST4 3NP')
  assert.equal(sanitiseUkPostcodeInput('  st4    3np '), 'ST4 3NP')
})

test('incomplete and non-UK postal codes cannot advance checkout', () => {
  for (const postcode of ['', 'S', 'WSI4', '90210', '10001', 'ST4 3', 'ST4-3NP', 'ST4 3NP EXTRA']) {
    assert.equal(isUkPostcode(postcode), false, postcode)
  }
  assert.equal(sanitiseUkPostcodeInput('90210'), '')
  assert.equal(sanitiseUkPostcodeInput('st4-3np'), 'ST43NP')
})
