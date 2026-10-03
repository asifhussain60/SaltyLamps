import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequest } from '../functions/_middleware.js'

test('the launch page is temporary, never cached, and cannot forward commerce writes', async () => {
  for (const path of ['/going-live', '/going-live.html']) for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'DELETE']) {
    let assetReads = 0
    const response = await onRequest({
      request: new Request(`https://www.saltylamps.co.uk${path}`, { method }),
      env: {}, next: async () => { assetReads++; return new Response('<h1>Going live shortly</h1>', { headers: { 'content-type': 'text/html' } }) },
    })
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('retry-after'), '3600')
    assert.equal(assetReads, ['GET', 'HEAD'].includes(method) ? 1 : 0)
    if (method === 'HEAD') assert.equal(await response.text(), '')
  }
})
