import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestGet } from '../functions/api/address-lookup.js'
const request = postcode => new Request(`https://test.saltylamps.co.uk/api/address-lookup?postcode=${encodeURIComponent(postcode)}`)

test('unconfigured and invalid address lookups do not call a provider', async () => {
  const previous = global.fetch
  global.fetch = () => { throw new Error('Unexpected provider request') }
  try {
    assert.deepEqual(await (await onRequestGet({ request: request('ST4 3NP'), env: {} })).json(), { available: false, addresses: [] })
    assert.equal((await onRequestGet({ request: request('bad'), env: { IDEAL_POSTCODES_API_KEY: 'test' } })).status, 400)
  } finally { global.fetch = previous }
})

test('address lookup maps house and flat fields without exposing the credential', async () => {
  const previous = global.fetch
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.ideal-postcodes.co.uk/v1/postcodes/ST43NP')
    assert.equal(options.headers.Authorization, 'api_key="private-test-key"')
    return Response.json({ result: [{ line_1: 'Flat 2', line_2: '10 Test Street', line_3: 'Test Quarter', post_town: 'Stoke-on-Trent', postcode: 'ST4 3NP' }] })
  }
  try {
    const response = await onRequestGet({ request: request('st4 3np'), env: { IDEAL_POSTCODES_API_KEY: 'private-test-key' } })
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), { available: true, addresses: [{ line1: 'Flat 2', line2: '10 Test Street, Test Quarter', city: 'Stoke-on-Trent', postcode: 'ST4 3NP' }] })
  } finally { global.fetch = previous }
})

test('provider outage, exhausted credit and unknown postcode retain manual fallback', async () => {
  const previous = global.fetch
  try {
    for (const status of [401, 402, 500]) {
      global.fetch = async () => Response.json({ message: 'private provider details' }, { status })
      const response = await onRequestGet({ request: request('ST4 3NP'), env: { IDEAL_POSTCODES_API_KEY: 'test' } })
      assert.equal(response.status, 503)
      assert.match((await response.json()).error, /Enter your address below/)
    }
    global.fetch = async () => Response.json({ code: 4040 }, { status: 404 })
    assert.deepEqual(await (await onRequestGet({ request: request('ST4 3NP'), env: { IDEAL_POSTCODES_API_KEY: 'test' } })).json(), { available: true, addresses: [] })
  } finally { global.fetch = previous }
})
