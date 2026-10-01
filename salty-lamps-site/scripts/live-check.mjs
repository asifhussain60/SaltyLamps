// One read-only command for go-live day and the eight weeks after it.
//
//   npm run live:check                                   # defaults: www + admin host
//   node scripts/live-check.mjs --expect-test-host-gone  # once the test hostname is removed
//   node scripts/live-check.mjs --base http://127.0.0.1:8789 --admin http://127.0.0.1:8789 --skip bare,admin
//
// It runs the outside-in half of migration step 13 (docs/migration.md) and the parts of the
// full system check that need no login: robots and noindex, the sitemaps, one heading and a
// www canonical on a sample of pages, the bare domain, each old Wix address, product photos,
// and that the admin host still demands Cloudflare Access. Prints one PASS/FAIL line per
// check and exits 1 if anything failed, so it doubles as the weekly monitoring check.
//
// READ-ONLY BY CONSTRUCTION. Every request goes through request() below: GET or HEAD only,
// no cookies, no credentials, no admin API. Nothing here can change the shop or its database.
//
// Sitemaps and canonicals name https://www.saltylamps.co.uk whichever host served them, so
// every sitemap address and redirect target is fetched on --base by path. Pointing --base at
// a local copy therefore never reaches the real site.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(import.meta.url)
const CANONICAL_ORIGIN = 'https://www.saltylamps.co.uk'
const DEFAULT_ADMIN = 'https://admin.saltylamps.co.uk'
const DEFAULT_TEST_HOST = 'https://test.saltylamps.co.uk'
const SITEMAP_CHILDREN = ['pages', 'products', 'categories', 'images', 'videos'].map(name => `${name}-sitemap.xml`)
const COUNTED_SITEMAPS = ['pages-sitemap.xml', 'products-sitemap.xml', 'categories-sitemap.xml']
const CHECK_KEYS = ['robots', 'noindex', 'sitemaps', 'pages', 'bare', 'redirects', 'images', 'admin', 'testhost']
const NAMES = {
  robots: 'robots.txt',
  noindex: 'no noindex on the public host',
  sitemaps: 'sitemap index and its five child sitemaps',
  pages: 'sample pages: one heading, www canonical',
  bare: 'bare domain redirects to www in one hop',
  redirects: 'old Wix addresses: one 301 to a live page',
  images: 'product photos load',
  admin: 'admin host demands Cloudflare Access sign-in',
  testhost: 'retired test hostname is gone',
}
const USER_AGENT = 'SaltyLamps-live-check/1 (read-only)'
const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
// A blanket Disallow aimed at any of these takes the whole shop out of search.
const CRAWLERS = new Set(['*', 'googlebot', 'bingbot'])

const ok = reason => ({ ok: true, reason })
const fail = reason => ({ ok: false, reason })
const unescapeXml = text => text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&')
const describe = res => (res.error ? `request failed (${res.error.code})` : `HTTP ${res.status}`)
const hostOf = value => { try { return new URL(value).hostname.toLowerCase() } catch { return '' } }
const isAccessHost = host => host === 'cloudflareaccess.com' || host.endsWith('.cloudflareaccess.com')

// --- pure verdicts (unit-tested without a network) ---------------------------------------------

export function robotsVerdict(text) {
  let agents = []
  let inRules = false
  let blanket = null
  const sitemaps = []
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const field = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()
    if (field === 'sitemap') { sitemaps.push(value); continue }
    if (field === 'user-agent') {
      if (inRules) { agents = []; inRules = false }
      agents.push(value.toLowerCase())
      continue
    }
    inRules = true
    // `Disallow: /admin` is fine; only a bare `/` closes the whole site.
    if (field === 'disallow' && (value === '/' || value === '/*')) blanket ||= agents.find(agent => CRAWLERS.has(agent))
  }
  if (blanket) return fail(`blanket Disallow: / for ${blanket === '*' ? 'every crawler' : blanket}; search engines are told to stay away`)
  const wanted = `${CANONICAL_ORIGIN}/sitemap.xml`
  if (!sitemaps.includes(wanted)) return fail(`no "Sitemap: ${wanted}" line`)
  return ok('no blanket Disallow; names the www sitemap')
}

export const countH1 = html => (String(html).match(/<h1[\s>]/gi) || []).length

export function canonicalLinks(html) {
  const found = []
  for (const tag of String(html).match(/<link\b[^>]*>/gi) || []) {
    if (!/\brel\s*=\s*(["'])\s*canonical\s*\1/i.test(tag)) continue
    const href = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
    if (href) found.push(unescapeXml(href[1] ?? href[2]))
  }
  return found
}

// The canonical must be www plus the page's own path, whichever host answered.
export function pageVerdict({ status, html, path: pagePath, error }) {
  if (error) return fail(`request failed (${error.code})`)
  if (status !== 200) return fail(`HTTP ${status}, expected 200`)
  const headings = countH1(html)
  if (headings !== 1) return fail(`${headings} <h1> tags, expected exactly one`)
  const links = canonicalLinks(html)
  if (links.length !== 1) return fail(links.length ? `${links.length} canonical links, expected one` : 'no canonical link')
  const expected = CANONICAL_ORIGIN + pagePath
  if (links[0] !== expected) return fail(`canonical is ${links[0]}, expected ${expected}`)
  return ok(`200, one <h1>, canonical ${expected}`)
}

export function noindexProblems({ headers, html }) {
  const problems = []
  const header = headers?.get('x-robots-tag')
  if (header && /noindex/i.test(header)) problems.push(`x-robots-tag: ${header}`)
  for (const tag of String(html).match(/<meta\b[^>]*>/gi) || []) {
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] || ''
    if (/\bname\s*=\s*["'](robots|googlebot)["']/i.test(tag) && /noindex/i.test(content)) problems.push(`meta robots: ${content}`)
  }
  return problems
}

export const sitemapLocs = xml => [...String(xml).matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map(match => unescapeXml(match[1]))

// Only exact-path 301s can be requested. Wildcard/placeholder rules have no concrete address, and
// a rule with no status is a 302 on Pages, which would not carry search rankings.
export function parseRedirects(text) {
  const rules = []
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const [from, to, status] = line.split(/\s+/)
    if (status !== '301' || !from.startsWith('/') || /[*:]/.test(from) || /\*|:splat/.test(to)) continue
    rules.push({ from, to })
  }
  return rules
}

// first = the answer for the old address (redirect: manual); final = the answer for where that
// Location points (also manual, so a second hop shows up as a 3xx instead of being followed).
export function redirectVerdict({ rule, base, first, final }) {
  if (first.error) return fail(`request failed (${first.error.code})`)
  if (first.status !== 301) return fail(`expected one 301, got ${first.status}`)
  if (!first.location) return fail('301 without a Location header')
  const target = new URL(first.location, new URL(rule.from, base))
  if (target.origin !== new URL(base).origin) return fail(`301 goes to another host (${target.origin})`)
  const landed = target.pathname + target.search
  const expected = new URL(rule.to, base)
  if (landed !== expected.pathname + expected.search) return fail(`301 goes to ${landed}, the rule says ${rule.to}`)
  if (!final) return fail(`${landed} was not checked`)
  if (final.error) return fail(`${landed}: request failed (${final.error.code})`)
  if (final.status >= 300 && final.status < 400) return fail(`${landed} redirects again (${final.status}${final.location ? ` to ${final.location}` : ''})`)
  if (final.status !== 200) return fail(`${landed} answers ${final.status}`)
  return ok(`301 to ${landed}, which answers 200`)
}

// Signed-out, the admin host must bounce to Cloudflare Access. A 200 means the admin is open.
export function accessRedirectVerdict({ status, location, error }) {
  if (error) return fail(`request failed (${error.code}); cannot confirm the sign-in screen`)
  if (status === 200) return fail('admin is OPEN: HTTP 200 with no sign-in demanded')
  if (!(status >= 300 && status < 400)) return fail(`HTTP ${status}, expected a redirect to Cloudflare Access`)
  if (!isAccessHost(hostOf(location))) return fail(`redirects to ${location || 'nowhere'}, not Cloudflare Access`)
  return ok(`redirects to ${hostOf(location)} for sign-in`)
}

// Gone = nothing answers, or an error status. A page, or a redirect (even to the sign-in), is
// still attached. A timeout proves nothing either way, so it fails rather than passing.
export function testHostVerdict({ status, location, error }) {
  if (error) return error.timeout ? fail('timed out; cannot confirm it is gone') : ok(`no connection (${error.code})`)
  if (status >= 400) return ok(`answers HTTP ${status}; no shop served`)
  return fail(`still attached: HTTP ${status}${location ? ` redirecting to ${location}` : ''}`)
}

export const exitCode = results => (results.some(result => result.status === 'fail') ? 1 : 0)

export function formatReport(results) {
  const lines = []
  for (const { status, name, reason, details = [] } of results) {
    lines.push(`${status.toUpperCase()}  ${name}: ${reason}`)
    for (const detail of details.slice(0, 20)) lines.push(`        - ${detail}`)
    if (details.length > 20) lines.push(`        - ...and ${details.length - 20} more`)
  }
  const count = status => results.filter(result => result.status === status).length
  lines.push('', `${count('pass')} passed, ${count('fail')} failed, ${count('skip')} skipped.`)
  return lines.join('\n')
}

export function parseArgs(argv) {
  const opts = { base: CANONICAL_ORIGIN, admin: DEFAULT_ADMIN, expectTestHostGone: false, skip: [] }
  const origin = (value, flag) => {
    let url
    try { url = new URL(value) } catch { /* reported below */ }
    if (!url || !/^https?:$/.test(url.protocol)) throw new Error(`${flag} must be an http(s) address, got ${value}`)
    return url.origin
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const eq = arg.indexOf('=')
    const flag = eq > 0 ? arg.slice(0, eq) : arg
    const value = () => {
      if (eq > 0) return arg.slice(eq + 1)
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(`${flag} needs a value`)
      return argv[++i]
    }
    if (flag === '--base') opts.base = origin(value(), flag)
    else if (flag === '--admin') opts.admin = origin(value(), flag)
    else if (flag === '--expect-test-host-gone') opts.expectTestHostGone = true
    else if (flag === '--skip') {
      opts.skip = value().split(',').map(key => key.trim()).filter(Boolean)
      const unknown = opts.skip.find(key => !CHECK_KEYS.includes(key))
      if (unknown) throw new Error(`Unknown check "${unknown}"; choose from ${CHECK_KEYS.join(', ')}`)
    } else throw new Error(`Unknown option ${arg}`)
  }
  return opts
}

// --- network ----------------------------------------------------------------------------------

// The only place a request is made. A failure comes back as data so one dead host cannot stop
// the rest of the report.
async function request(fetchFn, url, { method, redirect, text, accept, timeoutMs }) {
  try {
    const response = await fetchFn(url, {
      method,
      redirect,
      credentials: 'omit',
      headers: { accept, 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    })
    // An unread body would hold the connection open; images only need the headers.
    const body = text ? await response.text() : (await response.body?.cancel(), '')
    return {
      status: response.status,
      headers: response.headers,
      location: response.headers.get('location'),
      type: response.headers.get('content-type') || '',
      body,
    }
  } catch (error) {
    return { error: { code: error.cause?.code || error.code || error.name || 'ERROR', timeout: error.name === 'TimeoutError', message: error.message } }
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i) } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

export async function runChecks({
  base, admin, fetch: fetchFn = globalThis.fetch, skip = [], expectTestHostGone = false,
  testHost = DEFAULT_TEST_HOST, redirectsText, concurrency = 6, timeoutMs = 15000,
}) {
  base = base.replace(/\/+$/, '')
  admin = admin.replace(/\/+$/, '')
  const memo = new Map()
  const once = (key, make) => { if (!memo.has(key)) memo.set(key, make()); return memo.get(key) }
  // Memoised, so robots.txt, the sitemaps and the sample pages are each fetched once and shared.
  // Accept defaults to */* like curl; the robots check also asks the way a browser does, because
  // functions/_middleware.js turns unknown files into 404 + noindex when Accept names text/html.
  const send = (url, { method = 'GET', redirect = 'manual', text = false, accept = '*/*' } = {}) =>
    once(`${method} ${redirect} ${text} ${accept} ${url}`, () => request(fetchFn, url, { method, redirect, text, accept, timeoutMs }))
  const verdict = (key, name, { ok: passed, reason }, details) => ({ key, name, status: passed ? 'pass' : 'fail', reason, ...(details?.length ? { details } : {}) })

  const loadSitemaps = () => once('sitemaps', async () => {
    const problems = []
    const index = await send(`${base}/sitemap.xml`, { text: true })
    const indexOk = !index.error && index.status === 200
    if (!indexOk) problems.push(`sitemap.xml: ${describe(index)}`)
    const listed = indexOk ? sitemapLocs(index.body) : []
    const offHost = listed.filter(loc => !loc.startsWith(`${CANONICAL_ORIGIN}/`))
    for (const name of SITEMAP_CHILDREN) {
      if (indexOk && !listed.some(loc => loc.endsWith(`/${name}`))) problems.push(`sitemap.xml does not list ${name}`)
    }
    const children = await mapLimit(listed, concurrency, async loc => {
      const name = loc.slice(loc.lastIndexOf('/') + 1)
      const res = await send(`${base}${new URL(loc, CANONICAL_ORIGIN).pathname}`, { text: true })
      const locs = !res.error && res.status === 200 ? sitemapLocs(res.body) : []
      if (res.error || res.status !== 200) problems.push(`${name}: ${describe(res)}`)
      else if (!locs.length) problems.push(`${name}: lists no addresses`)
      offHost.push(...locs.filter(url => !url.startsWith(`${CANONICAL_ORIGIN}/`)))
      return { name, locs }
    })
    if (offHost.length) problems.push(`${offHost.length} address(es) are not on ${CANONICAL_ORIGIN}, e.g. ${offHost[0]}`)
    const locsOf = name => children.find(child => child.name === name)?.locs || []
    const first = (name, prefix) => {
      const loc = locsOf(name).find(url => new URL(url, CANONICAL_ORIGIN).pathname.startsWith(prefix))
      return loc && new URL(loc, CANONICAL_ORIGIN).pathname
    }
    const addresses = COUNTED_SITEMAPS.reduce((sum, name) => sum + locsOf(name).length, 0)
    const samples = [
      { label: 'home page', path: '/' },
      { label: 'product page', prefix: '/product-page/', path: first('products-sitemap.xml', '/product-page/') },
      { label: 'category page', prefix: '/category/', path: first('categories-sitemap.xml', '/category/') },
      { label: 'collection page', prefix: '/collection/', path: first('categories-sitemap.xml', '/collection/') },
    ]
    return { index, problems, children, addresses, samples }
  })

  const loadPages = () => once('pages', async () => {
    const { samples } = await loadSitemaps()
    return Promise.all(samples.map(async sample => ({ ...sample, res: sample.path ? await send(`${base}${sample.path}`, { text: true }) : null })))
  })

  const checks = {
    async robots() {
      const res = await send(`${base}/robots.txt`, { text: true })
      if (res.error || res.status !== 200) return [verdict('robots', NAMES.robots, fail(describe(res)))]
      const found = robotsVerdict(res.body)
      if (!found.ok) return [verdict('robots', NAMES.robots, found)]
      // A crawler that sends a browser-style Accept must still get the robots file and the sitemap.
      const refused = []
      for (const file of ['/robots.txt', '/sitemap.xml']) {
        const asPage = await send(`${base}${file}`, { accept: BROWSER_ACCEPT })
        if (asPage.error || asPage.status !== 200) refused.push(`${file} ${describe(asPage)}`)
      }
      if (refused.length) return [verdict('robots', NAMES.robots, fail(`refused to a browser-style request: ${refused.join('; ')}`))]
      return [verdict('robots', NAMES.robots, found)]
    },

    async noindex() {
      const pages = await loadPages()
      const subjects = [
        ['robots.txt', await send(`${base}/robots.txt`, { text: true })],
        ['sitemap.xml', (await loadSitemaps()).index],
        ...pages.filter(page => page.res).map(page => [page.path, page.res]),
      ].filter(([, res]) => !res.error)
      if (!subjects.length) return [verdict('noindex', NAMES.noindex, fail('could not read any page to check'))]
      const problems = subjects.flatMap(([label, res]) => noindexProblems({ headers: res.headers, html: res.body }).map(problem => `${label}: ${problem}`))
      if (problems.length) return [verdict('noindex', NAMES.noindex, fail(`${problems.length} page(s) say noindex`), problems)]
      return [verdict('noindex', NAMES.noindex, ok(`none of the ${subjects.length} responses checked (robots.txt, sitemap.xml, sample pages) say noindex`))]
    },

    async sitemaps() {
      const { problems, children, addresses } = await loadSitemaps()
      if (problems.length) return [verdict('sitemaps', NAMES.sitemaps, fail(`${problems.length} problem(s): ${problems[0]}`), problems)]
      return [verdict('sitemaps', NAMES.sitemaps, ok(`index lists ${children.length} sitemaps, all 200; ${addresses} addresses in pages, products and categories`))]
    },

    async pages() {
      return (await loadPages()).map(sample => {
        const name = `${sample.label} ${sample.path || ''}`.trim()
        if (!sample.path) return verdict('pages', name, fail(`no ${sample.prefix} address found in the sitemaps`))
        return verdict('pages', name, pageVerdict({ ...sample.res, html: sample.res.body, path: sample.path }))
      })
    },

    async bare() {
      const host = new URL(base)
      if (!host.hostname.startsWith('www.')) return [{ key: 'bare', name: NAMES.bare, status: 'skip', reason: `${host.hostname} is not a www host, so there is no bare domain to test` }]
      host.hostname = host.hostname.slice(4)
      host.pathname = '/'
      const first = await send(host.href)
      const final = first.status === 301 && first.location ? await send(`${base}/`) : null
      const result = redirectVerdict({ rule: { from: host.href, to: '/' }, base, first, final })
      const hint = '; expected before migration step 12, because the bare domain is still served by Wix until a Cloudflare 301 rule replaces it'
      return [verdict('bare', NAMES.bare, result.ok ? result : fail(result.reason + hint))]
    },

    async redirects() {
      const rules = parseRedirects(redirectsText ?? fs.readFileSync(path.resolve(path.dirname(HERE), '../public/_redirects'), 'utf8'))
      if (!rules.length) return [verdict('redirects', NAMES.redirects, fail('no 301 rules found in public/_redirects'))]
      const bad = (await mapLimit(rules, concurrency, async rule => {
        const first = await send(new URL(rule.from, `${base}/`).href)
        let final = null
        if (first.status === 301 && first.location) {
          const target = new URL(first.location, new URL(rule.from, `${base}/`))
          if (target.origin === new URL(base).origin) final = await send(target.href)
        }
        const result = redirectVerdict({ rule, base, first, final })
        return result.ok ? null : `${rule.from}: ${result.reason}`
      })).filter(Boolean)
      if (bad.length) return [verdict('redirects', NAMES.redirects, fail(`${bad.length} of ${rules.length} old addresses are wrong`), bad)]
      return [verdict('redirects', NAMES.redirects, ok(`${rules.length} old addresses each give one 301 to a page that answers 200`))]
    },

    async images() {
      const res = await send(`${base}/api/products`, { text: true, accept: 'application/json' })
      if (res.error || res.status !== 200) return [verdict('images', NAMES.images, fail(`/api/products: ${describe(res)}`))]
      let products
      try { products = JSON.parse(res.body).products } catch { /* handled below */ }
      if (!Array.isArray(products) || !products.length) return [verdict('images', NAMES.images, fail('/api/products returned no products'))]
      const urls = new Set()
      for (const product of products) {
        for (const src of [product.image, ...(Array.isArray(product.images) ? product.images : [])]) {
          if (typeof src === 'string' && src.trim()) urls.add(new URL(src, `${base}/`).href)
        }
      }
      if (!urls.size) return [verdict('images', NAMES.images, fail(`${products.length} products but none has a photo`))]
      const bad = (await mapLimit([...urls], concurrency, async url => {
        const opts = { redirect: 'follow', accept: 'image/*' }
        let reply = await send(url, { ...opts, method: 'HEAD' })
        // Some handlers answer HEAD with an error; only a GET can say whether the photo loads.
        if (reply.error || reply.status !== 200) reply = await send(url, opts)
        const label = url.startsWith(`${base}/`) ? url.slice(base.length) : url
        if (reply.error || reply.status !== 200) return `${label}: ${describe(reply)}`
        return /^image\//i.test(reply.type) ? null : `${label}: content-type ${reply.type || 'missing'}, expected image/*`
      })).filter(Boolean)
      if (bad.length) return [verdict('images', NAMES.images, fail(`${bad.length} of ${urls.size} photos do not load`), bad)]
      return [verdict('images', NAMES.images, ok(`${urls.size} distinct photos from ${products.length} catalogue rows all answer 200 as images`))]
    },

    async admin() {
      return [verdict('admin', NAMES.admin, accessRedirectVerdict(await send(`${admin}/admin`)))]
    },

    async testhost() {
      return [verdict('testhost', NAMES.testhost, testHostVerdict(await send(`${testHost}/`)))]
    },
  }

  const results = []
  for (const key of CHECK_KEYS) {
    if (skip.includes(key)) results.push({ key, name: NAMES[key], status: 'skip', reason: 'skipped with --skip' })
    else if (key === 'testhost' && !expectTestHostGone) results.push({ key, name: NAMES[key], status: 'skip', reason: 'pass --expect-test-host-gone once the test host is removed' })
    else results.push(...await checks[key]())
  }
  return results
}

async function main() {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`${error.message}\nUsage: node scripts/live-check.mjs [--base URL] [--admin URL] [--expect-test-host-gone] [--skip ${CHECK_KEYS.join(',')}]`)
    process.exit(2)
  }
  console.log(`Read-only check of ${opts.base} (admin host ${opts.admin})\n`)
  const results = await runChecks(opts)
  console.log(formatReport(results))
  process.exitCode = exitCode(results)
}

if (process.argv[1] && path.resolve(process.argv[1]) === HERE) await main()
