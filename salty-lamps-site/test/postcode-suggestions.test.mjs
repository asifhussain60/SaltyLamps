import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestGet } from '../functions/api/postcode-suggestions.js'

const lookup = query => {
  const calls = []
  const env = { POSTCODE_SUGGESTIONS_SOURCE: 'local', DB: { prepare(sql) {
    calls.push({ sql })
    return { bind(...params) {
      calls.at(-1).params = params
      return { async all() { return { results: [{ postcode: 'ST4 3NP' }, { postcode: 'ST4 3NU' }] } } }
    } }
  } } }
  return { calls, response: onRequestGet({ request: new Request(`http://localhost/api/postcode-suggestions?query=${encodeURIComponent(query)}`), env }) }
}

test('postcode lookup uses the local D1 prefix index, ignoring input spaces and case', async () => {
  const { calls, response } = lookup('st4 3n')
  const result = await response
  assert.equal(result.status, 200)
  assert.deepEqual((await result.json()).suggestions, ['ST4 3NP', 'ST4 3NU'])
  assert.deepEqual(calls[0].params, ['ST43N', 'ST43N['])
  assert.match(calls[0].sql, /uk_postcodes.*postcode_key >= \?.*postcode_key < \?.*LIMIT 8/)
  assert.equal(result.headers.get('cache-control'), 'no-store')
})

test('postcode lookup starts after one UK postcode letter', async () => {
  const { calls, response } = lookup('s')
  assert.deepEqual((await (await response).json()).suggestions, ['ST4 3NP', 'ST4 3NU'])
  assert.deepEqual(calls[0].params, ['S', 'S['])
})

test('invalid and Northern Ireland queries never touch the unlicensed postcode index', async () => {
  for (const query of ['1', 'ST4<script>', 'ST4%3NP', '12345678', 'BT1']) {
    const { calls, response } = lookup(query)
    assert.deepEqual((await (await response).json()).suggestions, [])
    assert.deepEqual(calls, [])
  }
})

test('database errors return a temporary failure', async () => {
  const response = await onRequestGet({
    request: new Request('http://localhost/api/postcode-suggestions?query=SW1A'),
    env: { POSTCODE_SUGGESTIONS_SOURCE: 'local', DB: { prepare() { throw new Error('unavailable') } } },
  })
  assert.equal(response.status, 503)
})

test('national lookup returns valid Great Britain postcodes from the first letter', async () => {
  let called = ''
  const response = await onRequestGet({
    request: new Request('http://localhost/api/postcode-suggestions?query=S'),
    env: { DB: { prepare() { throw new Error('should not use sample data') } } },
    fetcher: async url => {
      called = url
      return new Response(JSON.stringify({ status: 200, result: ['S10 1AE', 'ST4 3NP', 'BT1 1AA', 'invalid'] }), { status: 200 })
    },
  })
  assert.equal(called, 'https://api.postcodes.io/postcodes/S/autocomplete?limit=8')
  assert.deepEqual((await response.json()).suggestions, ['S10 1AE', 'ST4 3NP'])
})

test('national lookup outage falls back to local postcode rows', async () => {
  const response = await onRequestGet({
    request: new Request('http://localhost/api/postcode-suggestions?query=ST4'),
    env: { DB: { prepare: () => ({ bind: () => ({ all: async () => ({ results: [{ postcode: 'ST4 3NP' }] }) }) }) } },
    fetcher: async () => { throw new Error('offline') },
  })
  assert.deepEqual((await response.json()).suggestions, ['ST4 3NP'])
})
