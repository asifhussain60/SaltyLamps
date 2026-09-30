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
//      account could never build correctly. Development builds fall back to the committed snapshot, warns loudly with the file's
//      age, and exit 0. Production builds require fresh live data and fail closed.
//
// The snapshot is COMMITTED. That makes it the storefront's first-paint content too
// (src/App.jsx imports it), so the shop renders real content with zero network and
// degrades to last-deployed content instead of a blank page.
//
// SOURCES  (env CONTENT_SNAPSHOT_SOURCE, default 'committed' for local builds)
//   live       Cloudflare D1 HTTP API, only with the validated owner-account
//              production config and token. No development remote fallback.
//   local      the running `wrangler pages dev` server — no cloud credentials needed.
//   committed  Use the checked-in file as-is. Never touches the network.
//   staging    The owner's test shop database, which is the shop that goes live and
//              holds real prices and copy. READ-ONLY: only the fixed SELECT statements
//              below run, checked by scripts/read-only-sql.mjs first. Run it on purpose,
//              review the diff of src/content/content-snapshot.json, commit it, then
//              deploy. `npm run content:refresh-staging`; needs `npx wrangler login` as
//              the owner. A failure is fatal here: it never falls back to the old file.
//              STAGING_SNAPSHOT_LOCAL_DIR=<folder> reads a disposable local copy instead.
//
// USAGE
//   node scripts/fetch-content-snapshot.mjs   # offline, no legacy account access
//   Production uses deploy-production.sh after all owner-account gates pass.
//   CONTENT_SNAPSHOT_SOURCE=local node scripts/fetch-content-snapshot.mjs
//   CONTENT_SNAPSHOT_SOURCE=committed node scripts/fetch-content-snapshot.mjs

import {
  APPROVED_OWNER_ACCOUNT_ID, RETIRED_PROPOSAL_ACCOUNT_ID, RETIRED_PROPOSAL_DATABASE_ID, validateProductionTarget,
} from './production-target.mjs'
import { assertReadOnlySql, resultSetsFromWrangler } from './read-only-sql.mjs'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRODUCTS_QUERY, PRODUCT_IMAGES_QUERY, flattenProductRows } from '../functions/lib/flatten-products.mjs'
import {
  CATEGORIES_QUERY, CATEGORY_ALIASES_QUERY, CONTENT_QUERIES, CONTENT_QUERY_KEYS, shapeContent,
} from '../functions/lib/content-queries.mjs'
import { siteUrl } from '../src/content/site-content.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outPath = path.join(root, 'src/content/content-snapshot.json')

const PRODUCTION = process.env.CONTENT_SNAPSHOT_PRODUCTION === '1'
const SOURCE = process.env.CONTENT_SNAPSHOT_SOURCE || (PRODUCTION ? 'live' : 'committed')
if (SOURCE === 'staging' && PRODUCTION) throw new Error('The staging source is not a production build; unset CONTENT_SNAPSHOT_PRODUCTION.')
if (PRODUCTION && SOURCE !== 'live') throw new Error('Production snapshots require a live source; committed/local fallback is forbidden.')
if (SOURCE === 'live' && (
  process.env.CLOUDFLARE_ACCOUNT_ID?.toLowerCase() === RETIRED_PROPOSAL_ACCOUNT_ID
  || process.env.CLOUDFLARE_D1_DATABASE_ID?.toLowerCase() === RETIRED_PROPOSAL_DATABASE_ID
)) throw new Error('Retired proposal Cloudflare account and database are forbidden.')
if (SOURCE === 'live' && !PRODUCTION) throw new Error('Live snapshots require the reviewed Salty Lamps owner-account production target.')
const productionTarget = PRODUCTION ? validateProductionTarget(process.env, root) : null
const DB_NAME = process.env.D1_DATABASE_NAME || 'salty-lamps-db'

const warn = msg => console.warn(`\x1b[33m!\x1b[0m ${msg}`)
const ok = msg => console.log(`  \x1b[32m✓\x1b[0m ${msg}`)

// ---------------------------------------------------------------------------
// Remote credentials and resource IDs come only from the validated owner target.

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
  const token = process.env.CLOUDFLARE_API_TOKEN
  const accountId = productionTarget.accountId
  const databaseId = productionTarget.databaseId

  const missing = [
    !token && 'CLOUDFLARE_API_TOKEN',
    !accountId && 'CLOUDFLARE_ACCOUNT_ID',
    !databaseId && 'CLOUDFLARE_D1_DATABASE_ID',
  ].filter(Boolean)
  if (missing.length) throw new Error(`missing ${missing.join(', ')}`)

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sql: REMOTE_QUERIES.map(q => q.trim().replace(/;\s*$/, '')).join(';\n') }),
    },
  )
  const body = await res.json()
  if (!res.ok || !body.success || !Array.isArray(body.result) || body.result.some(r => r.success === false)) throw new Error(`D1 query failed: ${JSON.stringify(body.errors)}`)

  const sets = body.result.map(r => r.results || [])
  ok(`products, taxonomy and content from the reviewed owner-account D1 target`)
  return snapshotFromSets(sets, 'live')
}

// Turns one result set per REMOTE_QUERIES entry, in order, into the snapshot's fields.
function snapshotFromSets(sets, resolvedFrom) {
  const [productRows, imageRows, categoryRows, aliasRows, ...contentSets] = sets
  if (contentSets.length < CONTENT_QUERY_KEYS.length) {
    throw new Error(`expected ${REMOTE_QUERIES.length} result sets, got ${sets.length} — is migration 004 applied?`)
  }
  return {
    resolvedFrom,
    products: flattenProductRows(productRows, imageRows),
    categories: categoryRows,
    categoryAliases: Object.fromEntries(aliasRows.map(r => [r.alias, r.slug])),
    content: shapeContent(Object.fromEntries(CONTENT_QUERY_KEYS.map((k, i) => [k, contentSets[i]]))),
  }
}

// The test shop's database, through the wrangler login already used for deploys.
// Read-only by construction: the statements are checked before wrangler starts, and the
// pinned config (wrangler.staging.toml) names the only database it can reach.
function fromStaging() {
  const statements = REMOTE_QUERIES.map(q => q.trim().replace(/;\s*$/, ''))
  assertReadOnlySql(statements)
  const localDir = process.env.STAGING_SNAPSHOT_LOCAL_DIR
  const requested = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!localDir && requested && requested.toLowerCase() !== APPROVED_OWNER_ACCOUNT_ID) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID is not the approved owner account.')
  }
  const target = localDir
    ? { cwd: localDir, args: ['--local', '--persist-to', path.join(localDir, 'state')] }
    : { cwd: root, args: ['--remote', '-c', 'wrangler.staging.toml'] }
  let output
  try {
    output = execFileSync(
      path.join(root, 'node_modules/.bin/wrangler'),
      ['d1', 'execute', 'DB', ...target.args, '--json', '--command', statements.join(';\n')],
      {
        cwd: target.cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
        timeout: 120000,
        env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: APPROVED_OWNER_ACCOUNT_ID, WRANGLER_SEND_METRICS: 'false' },
      },
    )
  } catch (err) {
    const reason = String(err.stderr || err.message).replace(/\x1b\[[0-9;]*m/g, '').trim().split('\n').filter(Boolean).slice(-3).join(' | ')
    throw new Error(`wrangler could not read the test shop database (${reason}). Run \`npx wrangler login\` as the Salty Lamps owner.`)
  }
  const sets = resultSetsFromWrangler(output.slice(output.indexOf('[')), REMOTE_QUERIES.length)
  ok(`products, taxonomy and content read (read-only) from ${localDir ? `the local copy in ${localDir}` : 'the test shop database'}`)
  return snapshotFromSets(sets, 'staging')
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
    if (SOURCE === 'staging') return fromStaging()
    return SOURCE === 'local' ? await fromLocal() : await fromRemote()
  } catch (err) {
    if (SOURCE === 'staging') throw err
    if (PRODUCTION) throw new Error(`Production snapshot unavailable; refusing stale/proposal fallback: ${err.message}`)
    const prev = committedSnapshot()
    if (!prev) {
      // No fallback available. This is the one case worth failing on: a first build
      // with no snapshot and no database would emit a sitemap with zero products and
      // a site with no copy, which is far worse for SEO than a failed build.
      console.error(`\n\x1b[31m✘\x1b[0m Could not read the catalogue (${err.message}) and no committed snapshot exists.`)
      console.error('  Use a committed snapshot or CONTENT_SNAPSHOT_SOURCE=local against a seeded local D1.\n')
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

// Reusing a committed fallback does not refresh its provenance or age. Otherwise
// an offline build makes old catalogue data look newly verified.
if (resolved.resolvedFrom === 'committed') {
  ok('Keeping the committed snapshot and its original freshness information.')
  process.exit(0)
}

const snapshot = {
  // Bumped by hand when the snapshot's shape changes, so a stale committed file can be
  // detected rather than silently mis-read. v2 adds `content` and sources categories
  // from D1 instead of the hardcoded module. v3 adds `content.contactEmail`, the shop's
  // published address, read from the admin_notify_email setting — additive, and every
  // reader falls back to DEFAULT_CONTACT_EMAIL, so a v2 file still builds correctly.
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  source: SOURCE,
  resolvedFrom: resolved.resolvedFrom || SOURCE,
  siteUrl,
  ...(productionTarget ? { target: { accountId: productionTarget.accountId, databaseId: productionTarget.databaseId }, verifiedAt: new Date().toISOString() } : {}),
  ...resolved,
}

// Write ONLY when the content actually changed.
//
// This file is tracked on purpose — it is the committed fallback that lets a deploy
// succeed when D1 or its token is unavailable, and src/App.jsx imports it directly.
// But `generatedAt` moves on every run, so an unconditional write left `npm run build`
// dirtying the working tree every single time: a one-line diff with no change in it.
// That trains everyone to ignore a dirty tree after a build, which is exactly when you
// most want to notice one.
//
// Comparing everything EXCEPT generatedAt means the timestamp still records when the
// content last genuinely changed, rather than when a build last ran.
const serialised = `${JSON.stringify(snapshot, null, 2)}\n`
const withoutTimestamp = ({ generatedAt, ...rest }) => JSON.stringify(rest)
const previous = committedSnapshot()
const unchanged = previous && withoutTimestamp(previous) === withoutTimestamp(snapshot)

const summary =
  `${resolved.products.length} products, ${resolved.categories.length} categories, ` +
  `${resolved.content.collections.length} collections, ${Object.keys(resolved.content.themes).length} themes`

if (unchanged) {
  ok(`${path.relative(root, outPath)} already current — ${summary} (not rewritten)`)
} else {
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, serialised)
  ok(`Wrote ${path.relative(root, outPath)} — ${summary}`)
}
