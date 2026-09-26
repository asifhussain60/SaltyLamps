// catalogue-reset.mjs — capture the catalogue to a file, and reset any database back to it.
//
// WHY THIS EXISTS
//
// There was no safe way to get a database to a known catalogue state. The only
// bulk-load path was d1/seed.sql, which is frozen and unusable: its source CSV was
// never committed, and it opens with DELETE FROM skus. Because skus.id is
// AUTOINCREMENT and order_items.sku_id points at it, reseeding silently orphans every
// historical order line. So "reset the catalogue" and "keep the order history" were
// mutually exclusive. They are not any more.
//
// WHAT IT DOES INSTEAD
//
// data/catalogue.json is the source of truth for products, variants, prices and
// stock. This tool reconciles a live database TO that file:
//
//   • products and variants that are missing are created,
//   • ones whose fields differ are updated in place, so ids are preserved and no
//     order line is ever orphaned,
//   • ones present live but absent from the file are REPORTED, not deleted — and
//     even with --prune, anything referenced by an order is refused by the API.
//
// Every write goes through the admin API rather than SQL, so each change lands in
// admin_audit with an actor, exactly like a human edit. That is the whole reason a
// reset is safe to run against a database that has taken real money.
//
// WHEN ASIM'S SPREADSHEET COMES BACK
//
// scripts/import_owner_workbook.py writes the returned workbook into a database.
// Run it, check the result, then `capture` here to promote that state into
// data/catalogue.json and commit it. From then on any environment — a colleague's
// laptop, the test site, production — is one `apply` away from matching.
//
// GOING LIVE: THE WIX EXPORT
//
// `import-wix` merges a Wix "Export Products to CSV" file into the baseline, which
// is how production gets the REAL catalogue on the day it opens rather than a seed
// captured months earlier. Wix's handleId is already this database's products.id,
// so an import lands on the rows that exist rather than duplicating them.
//
// WHAT WINS, AND WHY IT IS NOT SYMMETRICAL. Wix is the live shop, so Wix is right
// about price, stock and what is on sale. This site is not a copy of Wix — it has
// curated descriptions, images rehosted and compressed locally, and a category
// taxonomy that does not exist in Wix at all. So:
//
//   from Wix        name, price, stock, track mode, visibility
//   kept from here  description, image, categories, tags, slug
//   new products    everything from Wix; flagged, because they arrive with no image
//   gone from Wix   REPORTED, never deleted — a product missing from an export is
//                   far more often a filtered export than a discontinued product
//
// `--fields=` overrides which fields Wix wins on, so the policy is arguable rather
// than hidden.
//
// USAGE
//   node scripts/catalogue-reset.mjs capture            # live  -> data/catalogue.json
//   node scripts/catalogue-reset.mjs plan               # what apply would change (default)
//   node scripts/catalogue-reset.mjs apply              # data/catalogue.json -> live
//   node scripts/catalogue-reset.mjs apply --prune      # also remove extras (never referenced ones)
//   node scripts/catalogue-reset.mjs import-wix --csv=<file>   # Wix export -> data/catalogue.json
//
//   --api=<url>    admin API base            (default http://localhost:8788)
//   --file=<path>  baseline file             (default data/catalogue.json)
//   --csv=<path>   Wix product export        (import-wix only)
//   --fields=a,b   which fields Wix wins on  (import-wix only)
//
// Against the deployed test site: --api=https://salty-lamps-proposal.pages.dev
//
// AGAINST A PRODUCTION SITE BEHIND CLOUDFLARE ACCESS. Every write goes through the
// admin API, and in production that API is gated by Access — which answers a script
// with a sign-in page, not data. Create an Access SERVICE TOKEN (Zero Trust →
// Access controls → Service auth) , add it to the admin application's policy, and
// export its two values:
//
//   export CF_ACCESS_CLIENT_ID=....access
//   export CF_ACCESS_CLIENT_SECRET=....
//
// They are picked up automatically. Without them the first call fails with an HTML
// login page and a message saying exactly this.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWixExport } from './lib/wix-catalogue.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const COMMAND = argv.find(a => !a.startsWith('--')) || 'plan'
const API = flag('api', process.env.ADMIN_API || 'http://localhost:8788')
const FILE = path.resolve(root, flag('file', 'data/catalogue.json'))
const PRUNE = argv.includes('--prune')
const CSV = flag('csv', null)
// Which fields the Wix export is allowed to overwrite. Overridable so the policy
// can be argued with rather than only obeyed.
const WIX_WINS = String(flag('fields', 'name,price_pence,track_mode,quantity,in_stock,visible'))
  .split(',').map(f => f.trim()).filter(Boolean)

const c = { dim: s => `\x1b[2m${s}\x1b[0m`, red: s => `\x1b[31m${s}\x1b[0m`, green: s => `\x1b[32m${s}\x1b[0m`, yellow: s => `\x1b[33m${s}\x1b[0m`, bold: s => `\x1b[1m${s}\x1b[0m` }
const gbp = pence => `£${(pence / 100).toFixed(2)}`
const die = msg => { console.error(`\n${c.red('✘')} ${msg}\n`); process.exit(1) }

// ---------------------------------------------------------------------------
// API

// A Cloudflare Access service token, when one is in the environment. This is the
// documented way for a machine to get through Access; without it a production
// admin API answers a script with a sign-in page.
function accessHeaders() {
  const id = process.env.CF_ACCESS_CLIENT_ID
  const secret = process.env.CF_ACCESS_CLIENT_SECRET
  if (!id || !secret) return {}
  return { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret }
}

async function api(pathname, options = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...accessHeaders(), ...(options.headers || {}) },
  })
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { /* non-JSON error page */ }
  if (!res.ok) {
    // An Access challenge is HTML, not JSON, and its status is 302/403 — so
    // without this it surfaces as an unreadable wall of markup. Say what to do.
    const looksLikeAccess = /<html/i.test(text) && /cloudflareaccess|Access/i.test(text)
    if (looksLikeAccess && !process.env.CF_ACCESS_CLIENT_ID) {
      throw new Error(
        `${API} is behind Cloudflare Access and this script has no service token.\n`
        + '  Create one at Zero Trust → Access controls → Service auth, add it to the admin\n'
        + '  application\'s policy, then:\n'
        + '    export CF_ACCESS_CLIENT_ID=....access\n'
        + '    export CF_ACCESS_CLIENT_SECRET=....',
      )
    }
    if (looksLikeAccess) {
      throw new Error(
        `${API} refused the Access service token (${res.status}).\n`
        + '  The token exists but is not allowed in: add it to the admin application\'s\n'
        + '  policy as a Service Auth rule, then try again.',
      )
    }
    const detail = body?.error?.message || body?.error || text.slice(0, 200)
    throw new Error(`${options.method || 'GET'} ${pathname} → ${res.status}: ${detail}`)
  }
  return body
}

async function loadLive() {
  const body = await api('/api/admin/products')
  if (!body?.products) die(`No catalogue at ${API}. Is the server running?`)
  return body.products
}

// ---------------------------------------------------------------------------
// Shape
//
// A variant's identity is its code AND its label together. Codes alone are not
// unique — the live catalogue has E14-1 three times and SL-2 and ST-841 twice each,
// which is precisely the defect the owner's spreadsheet exists to resolve. Keying on
// the pair means this tool stays correct while that defect is still present, instead
// of silently collapsing two variants into one.
const variantKey = s => `${(s.sku || '').trim()} ${(s.variant_label || '').trim()}`

const PRODUCT_FIELDS = ['name', 'slug', 'description', 'image', 'categories', 'tags', 'visible']
const VARIANT_FIELDS = ['sku', 'variant_label', 'price_pence', 'track_mode', 'quantity', 'in_stock']

const pick = (obj, fields) => Object.fromEntries(fields.map(f => [f, obj[f] ?? null]))

function normaliseProduct(p) {
  return {
    id: p.id,
    ...pick(p, PRODUCT_FIELDS),
    visible: p.visible === 0 || p.visible === false ? 0 : 1,
    skus: (p.skus || []).map(s => ({
      ...pick(s, VARIANT_FIELDS),
      quantity: s.track_mode === 'quantity' ? Number(s.quantity ?? 0) : null,
      in_stock: s.in_stock ? 1 : 0,
      // Carried for addressing the PATCH endpoint, never written to the baseline —
      // see capture(). skus.id is AUTOINCREMENT, so it means nothing in another
      // database; products.id is a stable TEXT key and does travel.
      id: s.id,
    })).sort((a, b) => variantKey(a).localeCompare(variantKey(b))),
  }
}

// ---------------------------------------------------------------------------
// capture

async function capture() {
  const live = (await loadLive()).map(normaliseProduct).sort((a, b) => a.id.localeCompare(b.id))
  const variants = live.reduce((n, p) => n + p.skus.length, 0)
  const doc = {
    version: 1,
    source: API,
    note: 'Catalogue baseline. Edit by hand or regenerate with `catalogue-reset.mjs capture`. Apply with `apply`.',
    products: live.map(p => ({ ...p, skus: p.skus.map(({ id, ...rest }) => rest) })),
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, `${JSON.stringify(doc, null, 2)}\n`)
  console.log(`\n${c.green('✓')} Captured ${live.length} products / ${variants} variants from ${API}`)
  console.log(`  → ${path.relative(root, FILE)}\n`)
}

// ---------------------------------------------------------------------------
// diff

function loadBaseline() {
  if (!fs.existsSync(FILE)) die(`No baseline at ${path.relative(root, FILE)}. Run \`capture\` first.`)
  const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  if (!Array.isArray(doc.products)) die(`${path.relative(root, FILE)} has no products array.`)
  return doc.products.map(normaliseProduct)
}

function diff(baseline, liveRows) {
  const live = new Map(liveRows.map(p => [p.id, p]))
  const plan = { createProducts: [], updateProducts: [], createVariants: [], updateVariants: [], extraProducts: [], extraVariants: [] }

  for (const want of baseline) {
    const have = live.get(want.id)
    if (!have) { plan.createProducts.push(want); continue }

    const changed = PRODUCT_FIELDS.filter(f => String(want[f] ?? '') !== String(have[f] ?? ''))
    if (changed.length) plan.updateProducts.push({ want, have, changed })

    const haveVariants = new Map(have.skus.map(s => [variantKey(s), s]))
    for (const wv of want.skus) {
      const hv = haveVariants.get(variantKey(wv))
      if (!hv) { plan.createVariants.push({ product: want, variant: wv }); continue }
      haveVariants.delete(variantKey(wv))
      const vChanged = VARIANT_FIELDS.filter(f => String(wv[f] ?? '') !== String(hv[f] ?? ''))
      if (vChanged.length) plan.updateVariants.push({ product: want, want: wv, have: hv, changed: vChanged })
    }
    for (const leftover of haveVariants.values()) plan.extraVariants.push({ product: have, variant: leftover })
  }

  const wanted = new Set(baseline.map(p => p.id))
  for (const p of liveRows) if (!wanted.has(p.id)) plan.extraProducts.push(p)
  return plan
}

function report(plan) {
  const total = plan.createProducts.length + plan.updateProducts.length + plan.createVariants.length + plan.updateVariants.length
  console.log(`\n${c.bold('=== Catalogue reset plan ===')}`)
  console.log(`  target              : ${API}`)
  console.log(`  baseline            : ${path.relative(root, FILE)}\n`)
  console.log(`  products to create  : ${plan.createProducts.length}`)
  console.log(`  products to update  : ${plan.updateProducts.length}`)
  console.log(`  variants to create  : ${plan.createVariants.length}`)
  console.log(`  variants to update  : ${plan.updateVariants.length}`)
  console.log(`  not in the baseline : ${plan.extraProducts.length} product(s), ${plan.extraVariants.length} variant(s)`)

  for (const p of plan.createProducts) console.log(`\n  ${c.green('+ product')} ${p.name} (${p.skus.length} variant(s))`)

  for (const { want, changed } of plan.updateProducts) {
    console.log(`\n  ${c.yellow('~ product')} ${want.name}`)
    for (const f of changed) console.log(`      ${f}`)
  }

  if (plan.createVariants.length) {
    console.log(`\n  ${c.green('+ variants')}`)
    for (const { product, variant } of plan.createVariants) {
      console.log(`      ${variant.sku.padEnd(14)} ${gbp(variant.price_pence).padStart(9)}  ${product.name}${variant.variant_label ? ` (${variant.variant_label})` : ''}`)
    }
  }

  if (plan.updateVariants.length) {
    console.log(`\n  ${c.yellow('~ variants')}`)
    for (const { product, want, have, changed } of plan.updateVariants) {
      const detail = changed
        .map(f => (f === 'price_pence' ? `price ${gbp(have[f])} → ${gbp(want[f])}` : `${f} ${have[f]} → ${want[f]}`))
        .join(', ')
      console.log(`      ${want.sku.padEnd(14)} ${product.name}${want.variant_label ? ` (${want.variant_label})` : ''}`)
      console.log(`      ${''.padEnd(14)} ${c.dim(detail)}`)
    }
  }

  if (plan.extraProducts.length || plan.extraVariants.length) {
    console.log(`\n  ${c.dim('Present live but not in the baseline:')}`)
    for (const p of plan.extraProducts) console.log(`      product  ${p.name}`)
    for (const { product, variant } of plan.extraVariants) console.log(`      variant  ${variant.sku} — ${product.name}`)
    console.log(c.dim(`      Left alone. Pass --prune to remove them; anything on a past order is refused by the API.`))
  }

  return total
}

// ---------------------------------------------------------------------------
// apply

async function apply(plan) {
  let ok = 0
  const failures = []
  const attempt = async (label, fn) => {
    try { await fn(); ok++; process.stdout.write('.') }
    catch (err) { failures.push(`${label}: ${err.message}`); process.stdout.write(c.red('x')) }
  }

  console.log(`\n${c.bold('--- Applying ---')}`)

  for (const p of plan.createProducts) {
    await attempt(`create product ${p.name}`, () =>
      api('/api/admin/products', { method: 'POST', body: JSON.stringify({ sourceId: p.id, product: pick(p, PRODUCT_FIELDS), skus: p.skus }) }))
  }

  for (const { want } of plan.updateProducts) {
    await attempt(`update product ${want.name}`, () =>
      api(`/api/admin/products/${encodeURIComponent(want.id)}`, { method: 'PATCH', body: JSON.stringify(pick(want, PRODUCT_FIELDS)) }))
  }

  for (const { product, variant } of plan.createVariants) {
    await attempt(`create variant ${variant.sku}`, () =>
      api(`/api/admin/products/${encodeURIComponent(product.id)}/skus`, { method: 'POST', body: JSON.stringify(variant) }))
  }

  for (const { want, have } of plan.updateVariants) {
    await attempt(`update variant ${want.sku}`, () =>
      api(`/api/admin/skus/${have.id}`, { method: 'PATCH', body: JSON.stringify(want) }))
  }

  if (PRUNE) {
    for (const { variant } of plan.extraVariants) {
      await attempt(`delete variant ${variant.sku}`, () =>
        api(`/api/admin/skus/${variant.id}`, { method: 'DELETE' }))
    }
    for (const p of plan.extraProducts) {
      await attempt(`delete product ${p.name}`, () =>
        api(`/api/admin/products/${encodeURIComponent(p.id)}`, { method: 'DELETE' }))
    }
  }

  console.log(`\n\n${c.green('✓')} ${ok} change(s) applied.`)
  if (failures.length) {
    console.log(`\n${c.red(`✘ ${failures.length} failed:`)}`)
    for (const f of failures) console.log(`  ${f}`)
    process.exitCode = 1
  }
}

// ---------------------------------------------------------------------------
// import-wix
//
// Merge a Wix product export into the baseline. Writes data/catalogue.json and
// nothing else — the database is untouched until someone reads the diff and runs
// `apply`. That separation is the point: an import is a proposal, not a change.

function importWix() {
  if (!CSV) {
    die('Which export? Pass the file:\n'
      + '    node scripts/catalogue-reset.mjs import-wix --csv=~/Downloads/catalog_products.csv\n\n'
      + '  Get it from the Wix dashboard: Products → tick the box at the top left to select\n'
      + '  them all → More Actions → Export. A Wix export holds at most 5,000 rows per file;\n'
      + '  if the shop has more, export in batches and import each in turn.')
  }
  const csvPath = path.resolve(process.cwd(), CSV.replace(/^~(?=$|\/)/, os.homedir()))
  if (!fs.existsSync(csvPath)) die(`No such file: ${csvPath}`)

  const { products: incoming, warnings } = readWixExport(fs.readFileSync(csvPath, 'utf8'))
  if (!incoming.length) {
    die(`No products found in ${path.basename(csvPath)}.\n${warnings.map(w => `  ${w}`).join('\n')}`)
  }

  const baseline = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { version: 1, products: [] }
  const existing = new Map((baseline.products || []).map(p => [p.id, p]))

  const added = []
  const updated = []
  const unchanged = []
  const noImage = []
  const merged = []

  for (const wix of incoming) {
    const prev = existing.get(wix.id)
    if (!prev) {
      // Brand new. Wix's image column names a file on Wix's CDN, which this site
      // does not serve from — so it arrives with no image and is flagged rather
      // than silently launched as a blank card.
      const { wixImageField, ...rest } = wix
      merged.push({ ...rest, image: '' })
      added.push(wix.name)
      if (wixImageField) noImage.push(wix.name)
      continue
    }

    const next = { ...prev }
    const changes = []
    for (const field of WIX_WINS) {
      if (!(field in wix)) continue
      if (prev[field] !== wix[field]) { changes.push(field); next[field] = wix[field] }
    }

    // Variants are matched on code AND label together, exactly as the diff does,
    // because codes alone are not unique in this catalogue.
    const key = v => `${(v.sku || '').trim()} ${(v.variant_label || '').trim()}`
    const prevSkus = new Map((prev.skus || []).map(v => [key(v), v]))
    next.skus = wix.skus.map(v => {
      const before = prevSkus.get(key(v))
      if (!before) { changes.push(`+variant ${v.sku}`); return v }
      const after = { ...before }
      for (const field of WIX_WINS) {
        if (!(field in v)) continue
        if (before[field] !== v[field]) { changes.push(`${v.sku}.${field}`); after[field] = v[field] }
      }
      return after
    })
    for (const [k, v] of prevSkus) {
      if (!wix.skus.some(w => key(w) === k)) changes.push(`-variant ${v.sku} (gone from Wix, kept)`)
    }
    // A variant the export does not mention is KEPT, for the same reason a missing
    // product is: a filtered export looks exactly like a discontinued line, and
    // only one of those two readings is recoverable.
    for (const [k, v] of prevSkus) if (!wix.skus.some(w => key(w) === k)) next.skus.push(v)

    merged.push(next)
    ;(changes.length ? updated : unchanged).push({ name: wix.name, changes })
    existing.delete(wix.id)
  }

  // Anything left in `existing` is in the baseline but not in this export.
  const absent = [...existing.values()]
  for (const p of absent) merged.push(p)

  console.log(`\n${c.bold('Wix export')}  ${path.basename(csvPath)}`)
  console.log(`${c.bold('Baseline')}    ${path.relative(root, FILE)}`)
  console.log(`${c.bold('Wix wins on')} ${WIX_WINS.join(', ')}\n`)

  console.log(`  ${c.green(String(added.length).padStart(4))} new product(s)`)
  for (const n of added) console.log(`       + ${n}`)
  console.log(`  ${c.yellow(String(updated.length).padStart(4))} changed`)
  for (const u of updated) console.log(`       ~ ${u.name}  ${c.dim(u.changes.join(', '))}`)
  console.log(`  ${c.dim(String(unchanged.length).padStart(4))} unchanged`)
  if (absent.length) {
    console.log(`  ${c.yellow(String(absent.length).padStart(4))} in the baseline but NOT in this export — kept, not deleted`)
    for (const p of absent) console.log(`       ? ${p.name}`)
    console.log(`\n  ${c.yellow('!')} If those really are discontinued, remove them in the admin. If the export`)
    console.log('    was filtered, re-export with every product selected and run this again.')
  }
  if (noImage.length) {
    console.log(`\n  ${c.yellow('!')} ${noImage.length} new product(s) have no image — Wix's images live on Wix's own`)
    console.log("    servers and this shop does not serve from there. Upload photographs for them")
    console.log('    in the admin before going live, or they launch as blank cards:')
    for (const n of noImage) console.log(`       ${n}`)
  }
  for (const w of warnings) console.log(`\n  ${c.yellow('!')} ${w}`)

  const doc = {
    ...baseline,
    version: baseline.version || 1,
    source: `wix-export:${path.basename(csvPath)}`,
    note: 'Catalogue baseline. Edit by hand or regenerate with `catalogue-reset.mjs capture`. Apply with `apply`.',
    products: merged.sort((a, b) => String(a.id).localeCompare(String(b.id))),
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, `${JSON.stringify(doc, null, 2)}\n`)

  const variants = merged.reduce((n, p) => n + (p.skus?.length || 0), 0)
  console.log(`\n${c.green('✓')} ${path.relative(root, FILE)} now holds ${merged.length} products / ${variants} variants.`)
  console.log(`\n  ${c.bold('Nothing has been written to any database yet.')} Read the list above, then:`)
  console.log('    node scripts/catalogue-reset.mjs plan  --api=<the site>   # see what would change')
  console.log('    node scripts/catalogue-reset.mjs apply --api=<the site>   # write it\n')
}

// ---------------------------------------------------------------------------

async function main() {
  if (!['capture', 'plan', 'apply', 'import-wix'].includes(COMMAND)) {
    die(`Unknown command "${COMMAND}". Use capture, plan, apply or import-wix.`)
  }
  if (COMMAND === 'import-wix') return importWix()
  if (COMMAND === 'capture') return capture()

  const [baseline, liveRows] = await Promise.all([Promise.resolve(loadBaseline()), loadLive().then(rows => rows.map(normaliseProduct))])
  const plan = diff(baseline, liveRows)
  const total = report(plan)

  if (COMMAND === 'plan') {
    console.log(`\n${total ? `Report only. Re-run with \`apply\` to write these through the admin API.` : c.green('Live catalogue already matches the baseline.')}\n`)
    return
  }
  if (!total && !(PRUNE && (plan.extraProducts.length || plan.extraVariants.length))) {
    console.log(`\n${c.green('Nothing to do — live catalogue already matches the baseline.')}\n`)
    return
  }
  await apply(plan)
}

main().catch(err => die(err.message))
