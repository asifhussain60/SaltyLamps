// Writes src/content/content-snapshot.json — the build-time snapshot of everything
// the site renders that doesn't come from a runtime fetch.
//
// WHY THIS EXISTS
//
// Two problems it solves at once:
//
//   1. scripts/generate-seo.mjs used to text-scrape src/App.jsx with indexOf slicing
//      and Function() eval to recover `categories`, `shopperPaths` and `pages`. That
//      broke the build if a const was renamed, reordered, or referenced anything
//      beyond img/media. Content now comes from a real module (and later from D1).
//
//   2. The build hard-failed when D1 was unreachable — top-level await, no fallback,
//      with a database id hardcoded to the DEV database, so the owner's production
//      account could never build correctly. This script NEVER throws on a fetch
//      failure: it falls back to the committed snapshot, warns loudly with the file's
//      age, and exits 0. A deploy is never blocked by an expired token.
//
// The snapshot is COMMITTED. That makes it the storefront's first-paint content too
// (src/App.jsx imports it), so the shop renders real content with zero network and
// degrades to last-deployed content instead of a blank page.
//
// SOURCES  (env CONTENT_SNAPSHOT_SOURCE, default 'live')
//   live       Cloudflare D1 HTTP API. Needs CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_D1_TOKEN
//              + a database id (see resolveDatabaseId below). Falls back on any failure.
//   local      the running `wrangler pages dev` server — no cloud credentials needed.
//   committed  Use the checked-in file as-is. Never touches the network.
//
// USAGE
//   node scripts/fetch-content-snapshot.mjs
//   CONTENT_SNAPSHOT_SOURCE=local node scripts/fetch-content-snapshot.mjs
//   CONTENT_SNAPSHOT_SOURCE=committed node scripts/fetch-content-snapshot.mjs

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PRODUCTS_QUERY, PRODUCT_IMAGES_QUERY, flattenProductRows } from '../functions/lib/flatten-products.mjs'
import {
  CATEGORIES_QUERY, CATEGORY_ALIASES_QUERY, CONTENT_QUERIES, CONTENT_QUERY_KEYS, shapeContent,
} from '../functions/lib/content-queries.mjs'
import { siteUrl } from '../src/content/site-content.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outPath = path.join(root, 'src/content/content-snapshot.json')

const SOURCE = process.env.CONTENT_SNAPSHOT_SOURCE || 'live'
const DB_NAME = process.env.D1_DATABASE_NAME || 'salty-lamps-db'

const warn = msg => console.warn(`\x1b[33m!\x1b[0m ${msg}`)
const ok = msg => console.log(`  \x1b[32m✓\x1b[0m ${msg}`)

// ---------------------------------------------------------------------------
// Credentials and database id

function keychainSecret(service, account = 'salty-lamps-proposal') {
  try {
    return execFileSync('security', ['find-generic-password', '-s', service, '-a', account, '-w'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

// Resolution order matters. The env var wins so CI and the owner's production account
// can target their own database; wrangler.toml is next because deploy-production.sh
// already instructs the owner to write the new database_id there, and the Pages runtime
// binds from that same file — so production self-heals with no extra step. The Keychain
// is last and dev-machine-only.
function resolveDatabaseId() {
  if (process.env.CLOUDFLARE_D1_DATABASE_ID) {
    return { id: process.env.CLOUDFLARE_D1_DATABASE_ID, from: 'CLOUDFLARE_D1_DATABASE_ID' }
  }
  const tomlPath = path.join(root, 'wrangler.toml')
  if (fs.existsSync(tomlPath)) {
    const match = fs.readFileSync(tomlPath, 'utf8').match(/^\s*database_id\s*=\s*"([^"]+)"/m)
    if (match) return { id: match[1], from: 'wrangler.toml' }
  }
  const kc = keychainSecret('salty-lamps-proposal-cloudflare-d1-database-id')
  if (kc) return { id: kc, from: 'Keychain' }
  return { id: '', from: 'nowhere' }
}

// ---------------------------------------------------------------------------
// Product sources

// Every query the snapshot needs, in one round trip. The D1 HTTP API accepts several
// statements and returns one result set per statement, positionally — so this list
// and the destructuring below must stay in step.
const REMOTE_QUERIES = [
  PRODUCTS_QUERY,
  PRODUCT_IMAGES_QUERY,
  CATEGORIES_QUERY,
  CATEGORY_ALIASES_QUERY,
  ...CONTENT_QUERIES,
]

async function fromRemote() {
  const token = process.env.CLOUDFLARE_D1_TOKEN
    || keychainSecret('salty-lamps-proposal-cloudflare-d1-token')
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    || keychainSecret('salty-lamps-proposal-cloudflare-account-id')
  const { id: databaseId, from } = resolveDatabaseId()

  const missing = [
    !token && 'CLOUDFLARE_D1_TOKEN',
    !accountId && 'CLOUDFLARE_ACCOUNT_ID',
    !databaseId && 'CLOUDFLARE_D1_DATABASE_ID (or a database_id in wrangler.toml)',
  ].filter(Boolean)
  if (missing.length) throw new Error(`missing ${missing.join(', ')}`)

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sql: REMOTE_QUERIES.map(q => q.trim().replace(/;\s*$/, '')).join(';\n') }),
    },
  )
  const body = await res.json()
  if (!body.success) throw new Error(`D1 query failed: ${JSON.stringify(body.errors)}`)

  const sets = body.result.map(r => r.results || [])
  const [productRows, imageRows, categoryRows, aliasRows, ...contentSets] = sets
  if (contentSets.length < CONTENT_QUERY_KEYS.length) {
    throw new Error(`expected ${REMOTE_QUERIES.length} result sets, got ${sets.length} — is migration 004 applied?`)
  }

  ok(`products, taxonomy and content from remote D1 (database id via ${from})`)
  return {
    resolvedFrom: 'live',
    products: flattenProductRows(productRows, imageRows),
    categories: categoryRows,
    categoryAliases: Object.fromEntries(aliasRows.map(r => [r.alias, r.slug])),
    content: shapeContent(Object.fromEntries(CONTENT_QUERY_KEYS.map((k, i) => [k, contentSets[i]]))),
  }
}

// Reads through the RUNNING dev server rather than `wrangler d1 execute --local`.
//
// This is not a stylistic choice. Those two commands can bind DIFFERENT sqlite files
// under .wrangler/state/v3/d1/miniflare-D1DatabaseObject/, keyed by an opaque hash —
// a documented Cloudflare quirk that bit this build once already, producing a snapshot
// full of stale prices that looked entirely plausible. Going through the server's own
// endpoint guarantees the snapshot sees exactly the database the site is serving.
//
// Requires `wrangler pages dev` to be running. That is a fair trade for correctness.
async function fromLocal() {
  const url = process.env.LOCAL_API || 'http://localhost:8788'
  const get = async pathname => {
    let res
    try {
      res = await fetch(`${url}${pathname}`)
    } catch {
      throw new Error(`no dev server at ${url} — start \`wrangler pages dev dist --port 8788 --d1 DB=${DB_NAME}\` first`)
    }
    if (!res.ok) throw new Error(`${url}${pathname} returned ${res.status}`)
    return res.json()
  }

  const [products, taxonomy, content] = await Promise.all([
    get('/api/products'), get('/api/categories'), get('/api/content'),
  ])
  ok(`products, taxonomy and content from the running dev server at ${url}`)
  return {
    resolvedFrom: 'local',
    products: products.products,
    categories: taxonomy.categories,
    categoryAliases: taxonomy.aliases,
    content,
  }
}

function committedSnapshot() {
  if (!fs.existsSync(outPath)) return null
  try {
    return JSON.parse(fs.readFileSync(outPath, 'utf8'))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------

// `resolvedFrom` records what the snapshot ACTUALLY read, which is not always what
// was asked for — a live fetch that falls back still has to say "committed", or the
// file claims a freshness it does not have.
const pickSnapshot = prev => ({
  products: prev.products,
  categories: prev.categories,
  categoryAliases: prev.categoryAliases,
  content: prev.content,
  resolvedFrom: 'committed',
})

async function resolveSnapshot() {
  if (SOURCE === 'committed') {
    const prev = committedSnapshot()
    if (!prev) throw new Error('CONTENT_SNAPSHOT_SOURCE=committed but no snapshot exists yet')
    ok(`everything from the committed snapshot (${prev.products.length} products)`)
    return pickSnapshot(prev)
  }

  try {
    return SOURCE === 'local' ? await fromLocal() : await fromRemote()
  } catch (err) {
    const prev = committedSnapshot()
    if (!prev) {
      // No fallback available. This is the one case worth failing on: a first build
      // with no snapshot and no database would emit a sitemap with zero products and
      // a site with no copy, which is far worse for SEO than a failed build.
      console.error(`\n\x1b[31m✘\x1b[0m Could not read the catalogue (${err.message}) and no committed snapshot exists.`)
      console.error('  Set CLOUDFLARE_D1_TOKEN + CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_D1_DATABASE_ID,')
      console.error('  or run with CONTENT_SNAPSHOT_SOURCE=local against a seeded local D1.\n')
      process.exit(1)
    }
    const ageDays = Math.floor((Date.now() - new Date(prev.generatedAt).getTime()) / 86400000)
    warn(`Could not reach D1 (${err.message}).`)
    warn(`Falling back to the committed snapshot — ${prev.products.length} products, ${ageDays} day(s) old.`)
    warn('The site will build and deploy, but the catalogue and copy may be stale.')
    return pickSnapshot(prev)
  }
}

const resolved = await resolveSnapshot()

// A partial snapshot is worse than a stale one: it would silently ship a site with no
// collections or no selling copy and nothing would look obviously broken. Refuse.
for (const [key, value] of Object.entries({
  products: resolved.products, categories: resolved.categories, content: resolved.content,
})) {
  const empty = !value || (Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0)
  if (empty) {
    console.error(`\n\x1b[31m✘\x1b[0m The snapshot came back with no ${key}.`)
    console.error('  Refusing to write a partial snapshot — it would ship a site with missing content')
    console.error('  that looks intact. Check that migrations 003 and 004 are applied to the target database.\n')
    process.exit(1)
  }
}

const snapshot = {
  // Bumped by hand when the snapshot's shape changes, so a stale committed file can be
  // detected rather than silently mis-read. v2 adds `content` and sources categories
  // from D1 instead of the hardcoded module.
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  source: SOURCE,
  resolvedFrom: resolved.resolvedFrom || SOURCE,
  siteUrl,
  ...resolved,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`)
ok(
  `Wrote ${path.relative(root, outPath)} — ${resolved.products.length} products, ` +
  `${resolved.categories.length} categories, ${resolved.content.collections.length} collections, ` +
  `${Object.keys(resolved.content.themes).length} themes`,
)
