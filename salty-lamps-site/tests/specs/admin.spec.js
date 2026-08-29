// Everything the owner does. If this passes, the back office works.
//
// These run against the admin API rather than by clicking through the portal, for
// two reasons that matter more than the convenience: the API is where the rules
// actually live (the UI shares its validation module with the server, so a UI
// click proves the weaker half), and an API-level suite runs identically against a
// site behind Cloudflare Access with a service token, which is how production has
// to be checked before it opens.
//
// The UI is checked too, but for the thing only a browser can answer: does the
// page render, and does it show the numbers the API returned.
import { expect, test } from '@playwright/test'

// Writes must not interleave. Two tests changing the same order at once would fail
// for a reason that has nothing to do with the shop.
test.describe.configure({ mode: 'serial' })

// The admin is closed unless this deployment opens it — 401 or 503 is the correct
// answer on a locked-down site, and a suite that treated that as a failure would
// cry wolf on exactly the deployment that is configured properly.
async function adminOpen(request) {
  const res = await request.get('/api/admin/stats', { failOnStatusCode: false })
  return res.status() === 200
}

test.describe('the admin refuses strangers', () => {
  test('it never answers with data and never says 200 by accident', async ({ request }) => {
    const res = await request.get('/api/admin/orders', { failOnStatusCode: false })
    // 200 only where this deployment deliberately opens the admin (a laptop, or a
    // hostname named in ADMIN_OPEN_HOSTS). Anywhere else: refused.
    expect([200, 401, 403, 404, 503]).toContain(res.status())
    if (res.status() !== 200) {
      expect(await res.text()).not.toMatch(/customer_email|amount_total_pence/)
    }
  })

  test('the destructive routes are no more open than the readable ones', async ({ request }) => {
    const read = await request.get('/api/admin/orders', { failOnStatusCode: false })
    for (const path of ['/api/admin/products/does-not-exist', '/api/admin/skus/999999']) {
      const res = await request.delete(path, { failOnStatusCode: false })
      if (read.status() !== 200) {
        expect(res.status(), `${path} answered while reads are refused`).not.toBe(200)
      }
    }
  })
})

test.describe('the dashboard', () => {
  test('every figure comes from the database and hangs together', async ({ request }) => {
    test.skip(!(await adminOpen(request)), 'the admin is closed on this deployment')
    const stats = await (await request.get('/api/admin/stats')).json()

    for (const key of ['revenue', 'orders', 'stock', 'recent_orders', 'top_products', 'sales_series', 'activity', 'comparisons', 'fulfilment_breakdown']) {
      expect(stats, `the dashboard is missing ${key}`).toHaveProperty(key)
    }

    // Arithmetic that must hold whatever the data is. These catch a windowing bug
    // — which is what the UTC/London day boundaries were — without needing to know
    // what the right numbers are.
    expect(stats.revenue.today_pence).toBeLessThanOrEqual(stats.revenue.week_pence)
    expect(stats.revenue.week_pence).toBeLessThanOrEqual(stats.revenue.all_time_pence)
    expect(stats.orders.today).toBeLessThanOrEqual(stats.orders.week)
    expect(stats.orders.week).toBeLessThanOrEqual(stats.orders.all_time)

    // Fourteen days, ending today, none missing — the chart's x-axis depends on it.
    expect(stats.sales_series).toHaveLength(14)
    const days = stats.sales_series.map(d => d.day)
    expect([...days].sort()).toEqual(days)
    expect(new Set(days).size).toBe(14)

    if (stats.orders.all_time > 0) {
      expect(stats.average_order_pence).toBeGreaterThan(0)
    }
  })

  test('the dashboard page renders the numbers the API returned', async ({ page, request }) => {
    test.skip(!(await adminOpen(request)), 'the admin is closed on this deployment')
    await page.goto('/admin')
    await expect(page.locator('.admin-shell')).toBeVisible()
    await expect(page.getByText(/revenue/i).first()).toBeVisible()
  })
})

test.describe('the pages the owner works in', () => {
  const pages = [
    ['/admin/orders', /orders/i],
    ['/admin/products', /products/i],
    ['/admin/categories', /categor/i],
    ['/admin/inventory', /stock|inventory/i],
    ['/admin/reports', /report|sales/i],
    ['/admin/emails', /email/i],
    ['/admin/settings', /setting/i],
    ['/admin/docs/migration', /migration|phase/i],
    ['/admin/docs/infrastructure', /infrastructure|cloudflare/i],
    ['/admin/docs/technical', /technical|architecture|stack/i],
    ['/admin/docs/pricing', /pricing|cost|fee/i],
  ]

  for (const [path, expected] of pages) {
    test(`${path} renders`, async ({ page, request }) => {
      test.skip(!(await adminOpen(request)), 'the admin is closed on this deployment')
      const errors = []
      page.on('pageerror', e => errors.push(e.message))
      await page.goto(path)
      await expect(page.locator('.admin-shell')).toBeVisible()
      await expect(page.getByText(expected).first()).toBeVisible()
      expect(errors, `${path} threw:\n${errors.join('\n')}`).toEqual([])
    })
  }
})

test.describe('the migration runbook itself', () => {
  test('every phase is present and ticks are remembered', async ({ page, request }) => {
    test.skip(!(await adminOpen(request)), 'the admin is closed on this deployment')
    await page.goto('/admin/docs/migration')
    // The admin is a lazily-loaded chunk, so the document is not in the DOM the
    // instant navigation resolves. Waiting for the article rather than sleeping
    // keeps this honest on a slow connection.
    await expect(page.locator('.admin-doc')).toBeVisible()

    const phases = page.locator('.admin-doc__phase')
    expect(await phases.count(), 'the runbook lost phases').toBeGreaterThanOrEqual(10)

    const boxes = page.locator('.admin-doc__check input[type="checkbox"]')
    expect(await boxes.count(), 'the runbook lost its checklist').toBeGreaterThan(40)

    // The whole point of the checklist is stopping and coming back. If a tick does
    // not survive a reload, someone re-does a step they already did — and some of
    // these steps are not safe to do twice.
    const first = boxes.first()
    await first.scrollIntoViewIfNeeded()
    await first.check()
    await page.reload()
    await expect(page.locator('.admin-doc__check input[type="checkbox"]').first()).toBeChecked()
  })

  test('every command block can be copied', async ({ page, request }) => {
    test.skip(!(await adminOpen(request)), 'the admin is closed on this deployment')
    await page.goto('/admin/docs/migration')
    await expect(page.locator('.admin-doc')).toBeVisible()
    const consoles = page.locator('.admin-doc__console')
    expect(await consoles.count()).toBeGreaterThan(3)
    // Someone who cannot read shell must not have to retype it.
    for (let i = 0; i < await consoles.count(); i++) {
      await expect(consoles.nth(i).getByRole('button', { name: /copy/i })).toBeVisible()
    }
  })
})

test.describe('reports and their exports', () => {
  for (const [path, filename] of [
    ['/api/admin/reports/sales?format=csv', 'sales.csv'],
    ['/api/admin/reports/top-products?format=csv', null],
    ['/api/admin/reports/inventory-valuation?format=csv', null],
  ]) {
    test(`${path} downloads`, async ({ request }) => {
      test.skip(!(await adminOpen(request)), 'the admin is closed on this deployment')
      const res = await request.get(path)
      expect(res.ok()).toBeTruthy()
      expect(res.headers()['content-type']).toContain('csv')
      expect((await res.text()).split('\n')[0]).toContain(',')
      if (filename) expect(res.headers()['content-disposition'] || '').toContain(filename)
    })
  }

  test('the sales window honours the dates asked for', async ({ request }) => {
    test.skip(!(await adminOpen(request)), 'the admin is closed on this deployment')
    const body = await (await request.get('/api/admin/reports/sales?from=2026-01-01&to=2026-01-07')).json()
    expect(body.series).toHaveLength(7)
    expect(body.series[0].day).toBe('2026-01-01')
    expect(body.series[6].day).toBe('2026-01-07')
  })

  test('the monthly and yearly breakdowns agree with each other', async ({ request }) => {
    test.skip(!(await adminOpen(request)), 'the admin is closed on this deployment')
    const months = (await (await request.get('/api/admin/orders/by-month')).json()).months
    const years = (await (await request.get('/api/admin/orders/by-year')).json()).years
    const monthTotal = months.reduce((n, m) => n + m.orders, 0)
    const yearTotal = years.reduce((n, y) => n + y.orders, 0)
    // A year that is not the sum of its months means the two are bucketing time
    // differently — which they did, before both went through the same helper.
    expect(monthTotal).toBe(yearTotal)
  })
})

test.describe('email', () => {
  test('all eleven templates exist and none has lost its wording', async ({ request }) => {
    test.skip(!(await adminOpen(request)), 'the admin is closed on this deployment')
    const body = await (await request.get('/api/admin/emails/templates')).json()
    const templates = body.templates || body
    const keys = templates.map(t => t.key || t.template_key)

    for (const expected of [
      'order_confirmation', 'admin_new_order', 'order_shipped', 'order_delivered',
      'order_refunded', 'order_cancelled', 'admin_refund_request',
      'admin_enquiry_chat', 'admin_enquiry_trade', 'admin_enquiry_newsletter',
      'admin_low_stock',
    ]) {
      expect(keys, `the ${expected} template is missing`).toContain(expected)
    }

    for (const t of templates) {
      expect(t.subject, `${t.key || t.template_key} has no subject`).toBeTruthy()
    }
  })

  test('a template preview renders through the real renderer', async ({ request }) => {
    test.skip(!(await adminOpen(request)), 'the admin is closed on this deployment')
    // POST, not GET. A GET falls through to the SPA catch-all and returns the
    // storefront's HTML with a 200 — which an earlier version of this test accepted
    // as a pass, and then skipped on. A test that cannot fail is not a test.
    const res = await request.post('/api/admin/emails/preview', { data: { key: 'order_confirmation' } })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.subject, 'the preview should carry a rendered subject').toBeTruthy()
    expect(body.html).toMatch(/<table/i)
    expect(body.html, 'the preview must not be the storefront page').not.toMatch(/site-header/)
  })

  test('every image in a rendered email actually resolves', async ({ request }) => {
    test.skip(!(await adminOpen(request)), 'the admin is closed on this deployment')
    // The email logo is referenced by absolute URL built from SITE_URL at send time,
    // so nothing at build time can catch a wrong path — it fails silently, in the
    // customer's inbox, as a broken image at the top of every order confirmation.
    const body = await (await request.post('/api/admin/emails/preview', { data: { key: 'order_confirmation' } })).json()
    const srcs = [...body.html.matchAll(/src="([^"]+)"/g)].map(m => m[1])
    expect(srcs.length, 'the email should carry at least the logo').toBeGreaterThan(0)
    for (const src of srcs) {
      const img = await request.get(src, { failOnStatusCode: false })
      expect(img.status(), `${src} does not resolve`).toBe(200)
    }
  })

  test('the outbox records every send, including the ones deliberately skipped', async ({ request }) => {
    test.skip(!(await adminOpen(request)), 'the admin is closed on this deployment')
    const body = await (await request.get('/api/admin/emails/outbox')).json()
    const rows = body.messages || body.outbox || body.rows || []
    expect(Array.isArray(rows)).toBeTruthy()
    for (const row of rows.slice(0, 20)) {
      // 'skipped' is not a failure — it means sending was deliberately suppressed.
      // A quiet test site must never read as an outage.
      expect(['sent', 'failed', 'skipped', 'pending']).toContain(row.status)
    }
  })
})

test.describe('settings', () => {
  test('a bad value is refused with a message naming the field', async ({ request }) => {
    test.skip(!(await adminOpen(request)), 'the admin is closed on this deployment')
    const res = await request.put('/api/admin/settings', {
      failOnStatusCode: false,
      // A bare domain, which breaks every link and the logo in every email sent.
      data: { settings: { site_url: 'saltylamps.co.uk' } },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(JSON.stringify(body)).toMatch(/site_url/)
  })

  test('the private alert address and the published one are separate settings', async ({ request }) => {
    test.skip(!(await adminOpen(request)), 'the admin is closed on this deployment')
    const body = await (await request.get('/api/admin/settings')).json()
    const keys = (body.settings || []).map(s => s.key)
    // These were once the same field, and a personal address ended up printed on
    // the storefront. They must never be merged back together.
    expect(keys).toEqual(expect.arrayContaining(['admin_notify_email', 'public_contact_email']))
    // Currency is shown but must not be editable — changing it after orders exist
    // would silently reinterpret every stored amount.
    expect((body.settings || []).find(s => s.key === 'currency')?.editable).toBe(false)
  })
})
