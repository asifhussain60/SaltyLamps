import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('every legacy redirect works for browser requests and has a built destination', async ({ request }) => {
  const root = new URL('../../dist/', import.meta.url)
  const rules = fs.readFileSync(new URL('_redirects', root), 'utf8').split('\n').filter(line => line.startsWith('/'))
  expect(rules.length).toBeGreaterThan(40)
  for (const rule of rules) {
    const [pattern, target, code] = rule.split(/\s+/)
    const source = pattern.replace('*', '')
    const destination = target.replace(':splat', '')
    const response = await request.get(source, { headers: { accept: 'text/html' }, maxRedirects: 0 })
    expect(response.status(), source).toBe(Number(code))
    expect(response.headers().location, source).toBe(destination)
    if (!pattern.includes('*')) {
      const relative = destination === '/' ? 'index.html' : destination.slice(1)
      expect(fs.existsSync(new URL(relative, root)) || fs.existsSync(new URL(relative + '.html', root)), destination).toBe(true)
      const resolved = await request.head(destination, { maxRedirects: 4 })
      expect(resolved.status(), destination).toBe(200)
    }
  }
  for (const route of ['/checkout', '/checkout/address']) {
    const response = await request.get(route, { headers: { accept: 'text/html' }, maxRedirects: 4 })
    expect(response.status(), route).toBe(200)
    expect(await response.text()).toContain('id="root"')
  }
  const missing = await request.get('/does-not-exist-fixture', { headers: { accept: 'text/html' } })
  expect(missing.status()).toBe(404)
})
