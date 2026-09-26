import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestGet } from '../functions/api/postcode-suggestions.js'

const lookup = query => {
  const calls = []
  const env = { DB: { prepare(sql) {
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

test('invalid and short queries never touch the database', async () => {
  for (const query of ['S', 'ST4<script>', 'ST4%3NP', '12345678', 'BT1']) {
    const { calls, response } = lookup(query)
    assert.deepEqual((await (await response).json()).suggestions, [])
    assert.deepEqual(calls, [])
  }
})

test('database errors return a temporary failure', async () => {
  const response = await onRequestGet({
    request: new Request('http://localhost/api/postcode-suggestions?query=SW1A'),
    env: { DB: { prepare() { throw new Error('unavailable') } } },
  })
  assert.equal(response.status, 503)
})
