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
//   local      `wrangler d1 execute salty-lamps-db --local --json` — no cloud creds.
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
import { categories, shopperPaths, pages, siteUrl, categoryAliases } from '../src/content/site-content.mjs'

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

async function productsFromRemote() {
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
      body: JSON.stringify({ sql: PRODUCTS_QUERY }),
    },
  )
  const body = await res.json()
  if (!body.success) throw new Error(`D1 query failed: ${JSON.stringify(body.errors)}`)
  ok(`products from remote D1 (database id via ${from})`)
  return flattenProductRows(body.result[0].results)
}

function productsFromLocal() {
  const raw = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--local', '--json', '--command', PRODUCTS_QUERY],
    { encoding: 'utf8', cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  // wrangler prints banner lines before the JSON; take from the first bracket.
  const jsonStart = raw.indexOf('[')
  if (jsonStart === -1) throw new Error('no JSON in wrangler output')
  const parsed = JSON.parse(raw.slice(jsonStart))
  ok(`products from local D1 (${DB_NAME})`)
  return flattenProductRows(parsed[0].results)
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

async function resolveProducts() {
  if (SOURCE === 'committed') {
    const prev = committedSnapshot()
    if (!prev) throw new Error('CONTENT_SNAPSHOT_SOURCE=committed but no snapshot exists yet')
    ok(`products from the committed snapshot (${prev.products.length})`)
    return prev.products
  }

  try {
    return SOURCE === 'local' ? productsFromLocal() : await productsFromRemote()
  } catch (err) {
    const prev = committedSnapshot()
    if (!prev) {
      // No fallback available. This is the one case worth failing on: a first build
      // with no snapshot and no database would emit a sitemap with zero products,
      // which is far worse for SEO than a failed build.
      console.error(`\n\x1b[31m✘\x1b[0m Could not read products (${err.message}) and no committed snapshot exists.`)
      console.error('  Set CLOUDFLARE_D1_TOKEN + CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_D1_DATABASE_ID,')
      console.error('  or run with CONTENT_SNAPSHOT_SOURCE=local against a seeded local D1.\n')
      process.exit(1)
    }
    const ageDays = Math.floor((Date.now() - new Date(prev.generatedAt).getTime()) / 86400000)
    warn(`Could not reach D1 (${err.message}).`)
    warn(`Falling back to the committed snapshot — ${prev.products.length} products, ${ageDays} day(s) old.`)
    warn('The site will build and deploy, but the catalogue in the sitemap may be stale.')
    return prev.products
  }
}

const products = await resolveProducts()

const snapshot = {
  // Bumped by hand when the snapshot's shape changes, so a stale committed file
  // can be detected rather than silently mis-read.
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: SOURCE,
  siteUrl,
  categoryAliases,
  categories,
  shopperPaths,
  pages,
  products,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`)
ok(`Wrote ${path.relative(root, outPath)} (${products.length} products, ${categories.length} categories)`)
