import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  accessRedirectVerdict, canonicalLinks, countH1, exitCode, formatReport, noindexProblems, pageVerdict,
  parseArgs, parseRedirects, redirectVerdict, robotsVerdict, runChecks, sitemapLocs, testHostVerdict,
} from '../scripts/live-check.mjs'

const WWW = 'https://www.saltylamps.co.uk'
const ADMIN = 'https://admin.saltylamps.co.uk'
const TEST_HOST = 'https://test.saltylamps.co.uk'
const ACCESS = 'https://safina.cloudflareaccess.com/cdn-cgi/access/login/admin.saltylamps.co.uk'
const GOOD_ROBOTS = `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /admin\n\nSitemap: ${WWW}/sitemap.xml\n`

// --- robots.txt ---------------------------------------------------------------

test('robots.txt: the shipped file passes, a blanket Disallow or a missing sitemap does not', () => {
  assert.equal(robotsVerdict(fs.readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8')).ok, true)
  assert.equal(robotsVerdict(GOOD_ROBOTS).ok, true)
  // The keep-out file the middleware serves on every non-www host.
  assert.match(robotsVerdict(`User-agent: *\nDisallow: /\n`).reason, /blanket Disallow/)
  assert.equal(robotsVerdict(`User-agent: *\nDisallow: / # all\nSitemap: ${WWW}/sitemap.xml`).ok, false)
  assert.equal(robotsVerdict(`User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nAllow: /\nSitemap: ${WWW}/sitemap.xml`).ok, false)
  assert.equal(robotsVerdict(`User-agent: *\nDisallow:\nSitemap: ${WWW}/sitemap.xml`).ok, true)
  assert.match(robotsVerdict('User-agent: *\nAllow: /\n').reason, /Sitemap/)
  assert.equal(robotsVerdict(`User-agent: *\nAllow: /\nSitemap: ${TEST_HOST}/sitemap.xml`).ok, false)
})

// --- pages: heading, canonical, noindex ---------------------------------------

const html = ({ h1 = 1, canonical = `${WWW}/shop`, meta = 'index,follow' } = {}) =>
  `<html><head>${canonical ? `<link rel="canonical" href="${canonical}" />` : ''}<meta name="robots" content="${meta}" /></head><body><header>x</header>${'<h1 class="t">Heading</h1>'.repeat(h1)}</body></html>`

test('countH1 counts real h1 tags only', () => {
  assert.equal(countH1(html({ h1: 0 })), 0)
  assert.equal(countH1(html({ h1: 2 })), 2)
  assert.equal(countH1('<h1>a</h1><H1 id=x>b</H1><h10>no</h10>'), 2)
})

test('canonicalLinks reads either attribute order and quote style', () => {
  assert.deepEqual(canonicalLinks(`<link href='${WWW}/a' rel='canonical'><link rel="stylesheet" href="/x.css">`), [`${WWW}/a`])
  assert.deepEqual(canonicalLinks('<link rel="canonical" href="https://a/1"><link rel="canonical" href="https://a/2">'), ['https://a/1', 'https://a/2'])
  assert.deepEqual(canonicalLinks('<html></html>'), [])
})

test('pageVerdict demands 200, one heading and a www canonical for the page\'s own path', () => {
  const ok = { status: 200, html: html(), path: '/shop' }
  assert.equal(pageVerdict(ok).ok, true)
  assert.match(pageVerdict({ ...ok, status: 404 }).reason, /404/)
  assert.match(pageVerdict({ ...ok, html: html({ h1: 2 }) }).reason, /2 <h1>/)
  assert.match(pageVerdict({ ...ok, html: html({ h1: 0 }) }).reason, /0 <h1>/)
  assert.match(pageVerdict({ ...ok, html: html({ canonical: `${TEST_HOST}/shop` }) }).reason, /canonical/)
  assert.match(pageVerdict({ ...ok, html: html({ canonical: `${WWW}/other` }) }).reason, /canonical/)
  assert.match(pageVerdict({ ...ok, html: html({ canonical: '' }) }).reason, /canonical/)
  assert.match(pageVerdict({ ...ok, html: html({ canonical: `${WWW}/shop` }) .replace('</head>', `<link rel="canonical" href="${WWW}/shop"></head>`) }).reason, /2 canonical/)
  assert.equal(pageVerdict({ status: 200, html: html({ canonical: `${WWW}/` }), path: '/' }).ok, true)
})

test('noindexProblems finds a noindex header or meta tag and ignores index,follow', () => {
  const headers = value => new Headers(value ? { 'x-robots-tag': value } : {})
  assert.deepEqual(noindexProblems({ headers: headers(), html: html() }), [])
  assert.match(noindexProblems({ headers: headers('noindex, nofollow'), html: '' })[0], /x-robots-tag/)
  assert.match(noindexProblems({ headers: headers(), html: html({ meta: 'noindex,follow' }) })[0], /meta robots/)
})

// --- sitemaps -----------------------------------------------------------------

test('sitemapLocs returns page addresses and ignores image and video locations', () => {
  const xml = `<urlset><url><loc>${WWW}/a</loc><image:image><image:loc>${WWW}/i.jpg</image:loc></image:image>`
    + `<video:video><video:content_loc>${WWW}/v.mp4</video:content_loc></video:video></url><url><loc> ${WWW}/b&amp;c </loc></url></urlset>`
  assert.deepEqual(sitemapLocs(xml), [`${WWW}/a`, `${WWW}/b&c`])
  assert.deepEqual(sitemapLocs('<sitemapindex></sitemapindex>'), [])
})

// --- old Wix addresses --------------------------------------------------------

test('the real _redirects file yields exactly the 56 old addresses, no wildcards', () => {
  const rules = parseRedirects(fs.readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8'))
  assert.equal(rules.length, 56)
  assert.ok(rules.every(rule => rule.from.startsWith('/') && rule.to.startsWith('/') && !rule.from.includes('*') && !rule.to.includes(':splat')))
  assert.deepEqual(rules[0], { from: '/category/himalyan-salt-massage-relaxation-products', to: '/category/himalayan-salt-massage-relaxation-products' })
})

test('parseRedirects skips comments, blanks, splats and anything but a 301', () => {
  const text = '# note\n\n/a /b 301\n/c /d 302\n/e /f 200\n/g/* /h/:splat 301\n  /i   /j   301  \n/k /l\n'
  assert.deepEqual(parseRedirects(text), [{ from: '/a', to: '/b' }, { from: '/i', to: '/j' }])
})

test('redirectVerdict wants one 301 to the expected page that answers 200', () => {
  const rule = { from: '/old', to: '/new' }
  const first = { status: 301, location: '/new' }
  const final = { status: 200 }
  const verdict = args => redirectVerdict({ rule, base: WWW, first, final, ...args })
  assert.equal(verdict({}).ok, true)
  assert.equal(verdict({ first: { status: 301, location: `${WWW}/new` } }).ok, true)
  assert.match(verdict({ final: { status: 301, location: '/newer' } }).reason, /again/)
  assert.match(verdict({ final: { status: 404 } }).reason, /404/)
  assert.match(verdict({ first: { status: 302, location: '/new' }, final: null }).reason, /302/)
  assert.match(verdict({ first: { status: 200 }, final: null }).reason, /200/)
  assert.match(verdict({ first: { status: 301, location: 'https://wix.example/new' }, final: null }).reason, /another host/)
  assert.match(verdict({ first: { status: 301, location: '/elsewhere' } }).reason, /\/elsewhere/)
  assert.match(verdict({ first: { error: { code: 'ECONNRESET' } }, final: null }).reason, /ECONNRESET/)
  assert.match(verdict({ final: { error: { code: 'ETIMEDOUT' } } }).reason, /ETIMEDOUT/)
})

// --- admin and test host ------------------------------------------------------

test('accessRedirectVerdict: only a redirect to Cloudflare Access proves sign-in is demanded', () => {
  assert.equal(accessRedirectVerdict({ status: 302, location: ACCESS }).ok, true)
  assert.equal(accessRedirectVerdict({ status: 303, location: ACCESS }).ok, true)
  assert.match(accessRedirectVerdict({ status: 200 }).reason, /OPEN/)
  assert.match(accessRedirectVerdict({ status: 302, location: 'https://example.com/login' }).reason, /not Cloudflare Access/)
  assert.equal(accessRedirectVerdict({ status: 403 }).ok, false)
  assert.equal(accessRedirectVerdict({ status: 302, location: 'https://evilcloudflareaccess.com/x' }).ok, false)
  assert.equal(accessRedirectVerdict({ error: { code: 'ENOTFOUND' } }).ok, false)
})

test('testHostVerdict: gone means no connection or an error status, never a page or a sign-in redirect', () => {
  assert.equal(testHostVerdict({ error: { code: 'ENOTFOUND' } }).ok, true)
  assert.equal(testHostVerdict({ status: 404 }).ok, true)
  assert.equal(testHostVerdict({ status: 530 }).ok, true)
  assert.equal(testHostVerdict({ status: 522 }).ok, true)
  assert.match(testHostVerdict({ status: 200 }).reason, /still/)
  assert.match(testHostVerdict({ status: 302, location: ACCESS }).reason, /still/)
  assert.equal(testHostVerdict({ error: { code: 'TimeoutError', timeout: true } }).ok, false)
})

// --- the whole run against a fake network -------------------------------------

const dnsError = () => Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })
const locs = (...urls) => `<urlset>${urls.map(url => `<url><loc>${url}</loc></url>`).join('')}</urlset>`
const REDIRECTS = '/old-lamp /product-page/a-lamp 301\n/old-blog /shop 301\n/wild/* /shop/:splat 301\n'
const PAGES = ['/', '/product-page/a-lamp', '/category/lamps', '/collection/gifts']

// A tiny healthy shop. `patch` swaps individual routes to build a failing one.
function fakeNetwork(origin = WWW, patch = {}) {
  const routes = new Map()
  const add = (method, url, status, body = '', headers = {}) =>
    routes.set(`${method} ${url}`, () => new Response(status === 204 || status === 301 || status === 302 ? null : body, { status, headers }))
  const pageHtml = path => html({ canonical: `${WWW}${path}` })
  add('GET', `${origin}/robots.txt`, 200, GOOD_ROBOTS)
  add('GET', `${origin}/sitemap.xml`, 200, locs(...['pages', 'products', 'categories', 'images', 'videos'].map(name => `${WWW}/${name}-sitemap.xml`)))
  add('GET', `${origin}/pages-sitemap.xml`, 200, locs(`${WWW}/`, `${WWW}/shop`))
  add('GET', `${origin}/products-sitemap.xml`, 200, locs(`${WWW}/product-page/a-lamp`))
  add('GET', `${origin}/categories-sitemap.xml`, 200, locs(`${WWW}/category/lamps`, `${WWW}/collection/gifts`))
  add('GET', `${origin}/images-sitemap.xml`, 200, locs(`${WWW}/product-page/a-lamp`))
  add('GET', `${origin}/videos-sitemap.xml`, 200, locs(`${WWW}/`))
  for (const path of PAGES) add('GET', `${origin}${path}`, 200, pageHtml(path), { 'content-type': 'text/html' })
  add('GET', `${origin}/shop`, 200, pageHtml('/shop'))
  add('GET', `${origin}/api/products`, 200, JSON.stringify({ products: [
    { image: '/media/a.jpg', images: ['/media/a.jpg', '/media/b.jpg'] },
    { image: '/api/images/c.webp' },
    { image: null },
  ] }), { 'content-type': 'application/json' })
  for (const image of ['/media/a.jpg', '/media/b.jpg', '/api/images/c.webp']) add('HEAD', `${origin}${image}`, 200, '', { 'content-type': 'image/jpeg' })
  add('GET', `${origin}/old-lamp`, 301, '', { location: '/product-page/a-lamp' })
  add('GET', `${origin}/old-blog`, 301, '', { location: '/shop' })
  add('GET', 'https://saltylamps.co.uk/', 301, '', { location: `${WWW}/` })
  add('GET', `${ADMIN}/admin`, 302, '', { location: ACCESS })
  routes.set(`GET ${TEST_HOST}/`, () => dnsError())
  for (const [key, make] of Object.entries(patch)) routes.set(key, typeof make === 'function' ? make : () => make.clone())
  const calls = []
  const fetch = async (url, init = {}) => {
    const method = init.method || 'GET'
    calls.push({ method, url: String(url), init })
    const result = (routes.get(`${method} ${url}`) || (() => new Response('no such route', { status: 404 })))(init)
    if (result instanceof Error) throw result
    return result
  }
  return { fetch, calls }
}

const run = (network, extra = {}) => runChecks({ base: WWW, admin: ADMIN, fetch: network.fetch, redirectsText: REDIRECTS, expectTestHostGone: true, ...extra })
const failed = results => results.filter(r => r.status === 'fail')

test('a healthy shop passes every check, one line each', async () => {
  const results = await run(fakeNetwork())
  assert.deepEqual(failed(results), [], formatReport(results))
  assert.deepEqual(results.map(r => r.key), ['robots', 'noindex', 'sitemaps', 'pages', 'pages', 'pages', 'pages', 'bare', 'redirects', 'images', 'admin', 'testhost'])
  assert.match(results.find(r => r.key === 'redirects').reason, /^2 old addresses/)
  assert.match(results.find(r => r.key === 'images').reason, /^3 distinct photos/)
  assert.match(results.find(r => r.key === 'sitemaps').reason, /5 addresses/)
  assert.equal(exitCode(results), 0)
})

test('the retired test hostname is only checked when asked', async () => {
  const results = await run(fakeNetwork(), { expectTestHostGone: false })
  assert.equal(results.find(r => r.key === 'testhost').status, 'skip')
  assert.equal(exitCode(results), 0)
})

test('every way a launch can go wrong is reported as its own failure and exits 1', async () => {
  const pageHtml = path => html({ canonical: `${WWW}${path}` })
  const network = fakeNetwork(WWW, {
    'GET https://www.saltylamps.co.uk/robots.txt': new Response('User-agent: *\nDisallow: /\n'),
    'GET https://www.saltylamps.co.uk/product-page/a-lamp': () => new Response(pageHtml('/product-page/a-lamp'), { headers: { 'x-robots-tag': 'noindex, nofollow' } }),
    'GET https://www.saltylamps.co.uk/category/lamps': () => new Response(html({ h1: 2, canonical: `${WWW}/category/lamps` })),
    'GET https://www.saltylamps.co.uk/collection/gifts': () => new Response(html({ canonical: `${TEST_HOST}/collection/gifts` })),
    'GET https://saltylamps.co.uk/': () => new Response('wix', { status: 200 }),
    'GET https://www.saltylamps.co.uk/shop': () => new Response(null, { status: 301, headers: { location: '/store' } }),
    'HEAD https://www.saltylamps.co.uk/media/b.jpg': () => new Response('', { status: 404 }),
    'GET https://www.saltylamps.co.uk/media/b.jpg': () => new Response('', { status: 404 }),
    'GET https://admin.saltylamps.co.uk/admin': () => new Response('<html>admin</html>'),
    'GET https://test.saltylamps.co.uk/': () => new Response(null, { status: 302, headers: { location: ACCESS } }),
  })
  const results = await run(network)
  assert.deepEqual(failed(results).map(r => r.key).sort(), ['admin', 'bare', 'images', 'noindex', 'pages', 'pages', 'redirects', 'robots', 'testhost'], formatReport(results))
  assert.match(results.find(r => r.key === 'redirects').details.join('\n'), /old-blog.*again/)
  assert.match(results.find(r => r.key === 'images').details.join('\n'), /b\.jpg.*404/)
  assert.match(results.find(r => r.key === 'admin').reason, /OPEN/)
  assert.equal(exitCode(results), 1)
  assert.match(formatReport(results), /^FAIL {2}robots\.txt/m)
})

test('a missing child sitemap fails the sitemap check', async () => {
  const results = await run(fakeNetwork(WWW, { 'GET https://www.saltylamps.co.uk/categories-sitemap.xml': () => new Response('', { status: 404 }) }))
  assert.match(results.find(r => r.key === 'sitemaps').reason, /categories-sitemap\.xml.*404/)
  assert.equal(results.find(r => r.key === 'sitemaps').status, 'fail')
})

test('a sitemap index that omits a child is named in the failure', async () => {
  const network = fakeNetwork(WWW, { 'GET https://www.saltylamps.co.uk/sitemap.xml': () => new Response(locs(`${WWW}/pages-sitemap.xml`)) })
  const sitemaps = (await run(network)).find(r => r.key === 'sitemaps')
  assert.equal(sitemaps.status, 'fail')
  assert.match(sitemaps.reason, /products-sitemap\.xml/)
})

test('skip drops a check without running it, and unreachable hosts fail loudly rather than pass', async () => {
  const network = fakeNetwork()
  const results = await run(network, { skip: ['images', 'redirects'] })
  assert.deepEqual(results.filter(r => r.status === 'skip').map(r => r.key), ['redirects', 'images'])
  assert.ok(!network.calls.some(call => call.url.includes('/api/products') || call.url.includes('/old-lamp')))
  const down = await runChecks({ base: WWW, admin: ADMIN, fetch: async () => { throw dnsError() }, redirectsText: REDIRECTS })
  assert.ok(failed(down).length >= 8)
  assert.equal(exitCode(down), 1)
})

test('it never writes, never sends credentials, and stays on the hosts it was pointed at', async () => {
  const network = fakeNetwork()
  await run(network)
  assert.ok(network.calls.length > 20)
  for (const { method, url, init } of network.calls) {
    assert.ok(['GET', 'HEAD'].includes(method), `${method} ${url}`)
    assert.ok(!init.credentials || init.credentials === 'omit', url)
    assert.ok(!Object.keys(init.headers || {}).some(name => /^(cookie|authorization)$/i.test(name)), url)
    assert.ok(init.signal, `no timeout on ${url}`)
  }
  const hosts = new Set(network.calls.map(call => new URL(call.url).hostname))
  assert.deepEqual([...hosts].sort(), ['admin.saltylamps.co.uk', 'saltylamps.co.uk', 'test.saltylamps.co.uk', 'www.saltylamps.co.uk'])
})

test('pointed at another base, sitemap, page and redirect requests stay on that base even though they name www', async () => {
  const base = 'http://127.0.0.1:8789'
  const network = fakeNetwork(base)
  const results = await runChecks({ base, admin: base, fetch: network.fetch, redirectsText: REDIRECTS })
  assert.ok(network.calls.every(call => new URL(call.url).origin === base), network.calls.map(c => c.url).join('\n'))
  assert.equal(results.find(r => r.key === 'bare').status, 'skip')
  // The canonical must still be www, so these pass; the local admin is not behind Access, so it fails.
  assert.deepEqual(failed(results).map(r => r.key), ['admin'])
})

test('a redirect that leaves the checked host fails instead of being followed', async () => {
  const network = fakeNetwork(WWW, { 'GET https://www.saltylamps.co.uk/old-lamp': () => new Response(null, { status: 301, headers: { location: 'https://old-wix.example/lamp' } }) })
  const results = await run(network)
  assert.match(results.find(r => r.key === 'redirects').details.join('\n'), /another host/)
  assert.ok(!network.calls.some(call => call.url.startsWith('https://old-wix.example')))
})

test('HEAD answered with an error falls back to GET before a photo is called broken', async () => {
  const network = fakeNetwork(WWW, {
    'HEAD https://www.saltylamps.co.uk/media/a.jpg': () => new Response('', { status: 405 }),
    'GET https://www.saltylamps.co.uk/media/a.jpg': () => new Response('bytes', { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    'HEAD https://www.saltylamps.co.uk/media/b.jpg': () => new Response('', { status: 200, headers: { 'content-type': 'text/html' } }),
  })
  const images = (await run(network)).find(r => r.key === 'images')
  assert.equal(images.status, 'fail')
  assert.ok(network.calls.some(call => call.method === 'GET' && call.url.endsWith('/media/a.jpg')))
  assert.doesNotMatch(images.details.join('\n'), /a\.jpg/)
  assert.match(images.details.join('\n'), /b\.jpg.*text\/html/)
})

// --- command line, report, exit code ------------------------------------------

test('parseArgs gives the go-live defaults and rejects typos rather than ignoring them', () => {
  assert.deepEqual(parseArgs([]), { base: WWW, admin: ADMIN, expectTestHostGone: false, skip: [] })
  assert.deepEqual(parseArgs(['--base', 'http://127.0.0.1:8789/', '--admin=http://127.0.0.1:8789', '--expect-test-host-gone', '--skip', 'images,redirects']),
    { base: 'http://127.0.0.1:8789', admin: 'http://127.0.0.1:8789', expectTestHostGone: true, skip: ['images', 'redirects'] })
  assert.throws(() => parseArgs(['--bsae', 'x']), /Unknown option/)
  assert.throws(() => parseArgs(['--skip', 'image']), /Unknown check/)
  assert.throws(() => parseArgs(['--base', 'ftp://x']), /http/)
  assert.throws(() => parseArgs(['--base']), /needs a value/)
})

test('formatReport prints one line per check and a count; exitCode ignores skips', () => {
  const results = [
    { key: 'robots', name: 'robots.txt', status: 'pass', reason: 'fine' },
    { key: 'images', name: 'photos', status: 'fail', reason: '1 broken', details: ['/a.jpg: 404'] },
    { key: 'bare', name: 'bare domain', status: 'skip', reason: 'not a www host' },
  ]
  const lines = formatReport(results).split('\n')
  assert.deepEqual(lines.slice(0, 4), ['PASS  robots.txt: fine', 'FAIL  photos: 1 broken', '        - /a.jpg: 404', 'SKIP  bare domain: not a www host'])
  assert.match(lines.at(-1), /1 passed, 1 failed, 1 skipped/)
  assert.equal(exitCode(results), 1)
  assert.equal(exitCode(results.filter(r => r.status !== 'fail')), 0)
  assert.equal(exitCode([]), 0)
})

test('robots.txt and the sitemap must also answer a browser-style request', async () => {
  // functions/_middleware.js once answered these with 404 + noindex whenever Accept named text/html.
  const asPage = body => init => (String(init.headers?.accept).includes('text/html') ? new Response('missing', { status: 404 }) : new Response(body))
  const network = fakeNetwork(WWW, { [`GET ${WWW}/robots.txt`]: asPage(GOOD_ROBOTS) })
  const robots = (await run(network)).find(result => result.key === 'robots')
  assert.equal(robots.status, 'fail')
  assert.match(robots.reason, /browser-style/)
  assert.match(robots.reason, /robots\.txt/)
  assert.equal((await run(fakeNetwork())).find(result => result.key === 'robots').status, 'pass')
})
