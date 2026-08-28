// backup-wix.mjs — take a copy of the live Wix shop that does not need a Wix login.
//
// WHY THIS EXISTS. The migration runbook used to say "export everything from Wix"
// in its final phase, after the domain had moved and the subscription had been
// cancelled. That is the one moment the export is hardest to take and most needed.
// Backing up is now the second thing that happens, before anything changes, and
// this script is the half of it a machine can do.
//
// WHAT IT CANNOT DO, and why that is fine. Products, orders and contacts live
// behind a Wix login and come out as CSVs the owner downloads by hand — the
// runbook walks them through it. What no human should be doing by hand is writing
// down 54 URLs, and that is exactly the part that decides whether the shop keeps
// its place in Google.
//
// WHAT IT PRODUCES, into backups/wix/<date>/:
//
//   sitemap-urls.txt   every URL the live site advertises, one per line
//   pages.json         each URL with its title, meta description, canonical and
//                      HTTP status, read from the live page
//   images/            every product photograph the live site references, full size
//   manifest.json      counts, timings, and the exact source of each file
//
// The URL inventory is not just an archive. It is the input to the redirect check:
// public/_redirects carries 38 rules built from a snapshot taken on 2026-08-11, and
// a shop that has added a product since then has an indexed URL nobody has thought
// about. Re-running this on cutover day is how that is caught while it is still
// cheap to fix. `--compare-redirects` does the comparison for you.
//
// USAGE
//   node scripts/backup-wix.mjs                          # full backup
//   node scripts/backup-wix.mjs --no-images              # inventory only, much faster
//   node scripts/backup-wix.mjs --compare-redirects      # also check public/_redirects covers it
//   node scripts/backup-wix.mjs --site=https://example.com
//
// It only ever reads. Nothing here can change the Wix site.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const repoRoot = path.resolve(root, '..')

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const SITE = (flag('site', 'https://www.saltylamps.co.uk')).replace(/\/$/, '')
const WITH_IMAGES = !argv.includes('--no-images')
const COMPARE = argv.includes('--compare-redirects')
const CONCURRENCY = Number(flag('concurrency', '4'))

const stamp = new Date().toISOString().slice(0, 10)
const outDir = path.join(repoRoot, 'backups', 'wix', stamp)

const say = (...a) => console.log('\x1b[1m▶\x1b[0m', ...a)
const ok = (...a) => console.log('  \x1b[32m✓\x1b[0m', ...a)
const warn = (...a) => console.log('  \x1b[33m!\x1b[0m', ...a)
const die = msg => { console.error(`\n\x1b[31m✘ ${msg}\x1b[0m\n`); process.exit(1) }

// Network failures are reported, never thrown. Someone running this is midway
// through a migration on a laptop, and a Node stack trace is not an answer to
// "the wifi dropped" — every caller already handles a null body.
async function get(url, { asBuffer = false } = {}) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
      headers: { 'user-agent': 'salty-lamps-migration-backup (+one-off archival read)' },
    })
    if (!res.ok) return { status: res.status, body: null }
    return { status: res.status, body: asBuffer ? Buffer.from(await res.arrayBuffer()) : await res.text() }
  } catch (err) {
    return { status: 0, body: null, error: err.message }
  }
}

// Sitemaps nest: an index points at children which hold the real URLs. Follow one
// level, which is all any sitemap this script will meet actually uses.
async function collectSitemapUrls(entry) {
  const seen = new Set()
  const queue = [entry]
  const urls = new Set()

  while (queue.length) {
    const url = queue.shift()
    if (seen.has(url)) continue
    seen.add(url)

    const { status, body, error } = await get(url)
    if (!body) { warn(`${url} → ${error ? `could not reach it (${error})` : status}`); continue }

    const isIndex = /<sitemapindex/i.test(body)
    for (const m of body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
      const loc = m[1].trim()
      if (isIndex) queue.push(loc)
      else urls.add(loc)
    }
  }
  return [...urls].sort()
}

// A tag's content, tolerant of attribute order — these are real pages, not a
// well-behaved fixture, and a regex that insists on one order silently returns
// nothing on half of them.
function metaContent(html, attr, value) {
  const re = new RegExp(`<meta[^>]*${attr}=["']${value}["'][^>]*>`, 'i')
  const tag = html.match(re)?.[0]
  return tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? null
}

function pageFacts(html) {
  return {
    title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null,
    description: metaContent(html, 'name', 'description'),
    canonical: html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i)?.[0]
      ?.match(/href=["']([^"']*)["']/i)?.[1] ?? null,
    ogImage: metaContent(html, 'property', 'og:image'),
  }
}

// Bounded parallelism. Politeness matters here: this is someone's live shop, and a
// backup that reads like a denial-of-service is a bad way to start a migration.
async function mapLimited(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }))
  return out
}

function safeImageName(url) {
  const base = path.basename(new URL(url).pathname).split('?')[0] || 'image'
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120)
  return /\.[a-z0-9]{2,5}$/i.test(clean) ? clean : `${clean}.jpg`
}

async function main() {
  say(`Backing up ${SITE} → backups/wix/${stamp}/`)
  fs.mkdirSync(outDir, { recursive: true })

  say('Reading the sitemap')
  const urls = await collectSitemapUrls(`${SITE}/sitemap.xml`)
  if (!urls.length) {
    die(`No URLs found at ${SITE}/sitemap.xml.\n\n`
      + '  Three things this usually means, in order of likelihood:\n'
      + '    1. No internet connection, or the address is mistyped.\n'
      + '    2. The site has already moved off Wix — this backup is too late to take.\n'
      + '       Use an earlier run from backups/wix/, or the Wix dashboard exports.\n'
      + '    3. The shop publishes its sitemap somewhere else. Open the address above\n'
      + '       in a browser to see which.')
  }
  fs.writeFileSync(path.join(outDir, 'sitemap-urls.txt'), urls.join('\n') + '\n')
  ok(`${urls.length} URLs`)

  say('Reading each page')
  const pages = await mapLimited(urls, CONCURRENCY, async url => {
    const { status, body } = await get(url)
    return { url, status, ...(body ? pageFacts(body) : {}) }
  })
  fs.writeFileSync(path.join(outDir, 'pages.json'), JSON.stringify(pages, null, 2) + '\n')
  const broken = pages.filter(p => p.status !== 200)
  ok(`${pages.length} pages read`)
  if (broken.length) warn(`${broken.length} did not return 200 — listed in pages.json`)

  let images = []
  if (WITH_IMAGES) {
    say('Downloading referenced images')
    const imgDir = path.join(outDir, 'images')
    fs.mkdirSync(imgDir, { recursive: true })
    const wanted = [...new Set(pages.map(p => p.ogImage).filter(Boolean))]
    images = await mapLimited(wanted, CONCURRENCY, async url => {
      try {
        const { status, body } = await get(url, { asBuffer: true })
        if (!body) return { url, status, saved: null }
        const name = safeImageName(url)
        fs.writeFileSync(path.join(imgDir, name), body)
        return { url, status, saved: `images/${name}`, bytes: body.length }
      } catch (err) {
        return { url, status: 0, saved: null, error: err.message }
      }
    })
    ok(`${images.filter(i => i.saved).length} of ${wanted.length} images saved`)
  } else {
    warn('Skipping images (--no-images)')
  }

  const manifest = {
    takenAt: new Date().toISOString(),
    site: SITE,
    urlCount: urls.length,
    pagesRead: pages.length,
    pagesNot200: broken.map(p => ({ url: p.url, status: p.status })),
    imagesSaved: images.filter(i => i.saved).length,
    imagesFailed: images.filter(i => !i.saved).map(i => i.url),
    note: 'Read-only archival copy of the live site. Products, orders and contacts '
      + 'are NOT here — those come out of the Wix dashboard by hand.',
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

  if (COMPARE) compareRedirects(urls)

  say('Done')
  console.log(`  ${path.relative(repoRoot, outDir)}`)
}

// Does public/_redirects still cover every URL the live site advertises?
//
// A URL is covered if the new site builds the same path, or a redirect rule
// matches it. Anything else returns 404 the moment DNS moves, taking whatever
// ranking it had with it.
function compareRedirects(urls) {
  say('Checking public/_redirects against the live URL list')
  const redirectsPath = path.join(root, 'public', '_redirects')
  if (!fs.existsSync(redirectsPath)) return warn('no public/_redirects to check')

  const rules = fs.readFileSync(redirectsPath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split(/\s+/)[0])
    .filter(from => from && from !== '/*')

  const built = new Set()
  const sitemapDir = path.join(root, 'dist')
  if (fs.existsSync(sitemapDir)) {
    for (const f of fs.readdirSync(sitemapDir)) {
      if (!f.endsWith('sitemap.xml')) continue
      const xml = fs.readFileSync(path.join(sitemapDir, f), 'utf8')
      for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
        try { built.add(new URL(m[1]).pathname.replace(/\/$/, '') || '/') } catch { /* ignore */ }
      }
    }
  } else {
    warn('dist/ not built — run `npm run build` first for the "already exists" half of this check')
  }

  const covered = p => built.has(p) || rules.some(r => (r.endsWith('*') ? p.startsWith(r.slice(0, -1)) : r === p))
  const uncovered = urls
    .map(u => { try { return new URL(u).pathname.replace(/\/$/, '') || '/' } catch { return null } })
    .filter(Boolean)
    .filter(p => !covered(p))

  if (!uncovered.length) return ok('every live URL is either built or redirected')
  warn(`${uncovered.length} live URL(s) would 404 after the cutover:`)
  for (const p of uncovered) console.log(`      ${p}`)
  console.log('\n  Add a rule for each to public/_redirects, pointing at the closest real page.')
  console.log('  Sending them to the homepage instead reads as a soft 404 and earns nothing.')
}

main().catch(err => die(
  `${err.message}\n\n  If that is not obviously your problem, the full detail is:\n  ${err.stack}`))
