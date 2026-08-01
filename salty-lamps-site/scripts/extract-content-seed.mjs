// Generates d1/migrations/004-content-layer.sql from the content modules.
//
// WHY GENERATE IT. Roughly a thousand lines of nested literals have to become SQL.
// Transcribing that by hand would introduce typos that nobody would notice until a
// customer read the wrong sentence on a product page. Generating it means the
// database provably starts out holding exactly what the site renders today.
//
// ITS MOST IMPORTANT JOB IS THE PROOF, NOT THE SQL.
//
// Section membership used to be JavaScript predicates. They are becoming JSON rules
// evaluated by functions/lib/section-rules.mjs. "We think those are equivalent" is
// not good enough — a silent mismatch would quietly drop products off a collection
// page, which nobody would spot without counting.
//
// So before writing anything, this script runs EVERY product in the live catalogue
// against EVERY section and band, both ways, and asserts:
//
//     matchesRule(product, section.rule) === section.match(product)
//
// Any disagreement aborts the run and prints the product, the section, and both
// answers. Nothing is written. That converts an assumption into a checked fact.
//
// USAGE
//   node scripts/extract-content-seed.mjs            # verify + write the migration
//   node scripts/extract-content-seed.mjs --check    # verify only, write nothing
//
//   --api=<url>   where to read the catalogue from (default http://localhost:8788)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { pages, shopperPaths } from '../src/content/site-content.mjs'
import {
  collectionSectionConfig, collectionTradeCopy, featuredReviews, listItems,
  medicalClaimPattern, pageCopy, proofReviewIndexByTheme, reassuranceByTheme,
  reviewSignals, sellingContentByTheme, siteDescription, siteTitle, supportImages,
} from '../src/content/marketing-content.mjs'
import { matchesRule } from '../functions/lib/section-rules.mjs'
import reviewCorpus from '../src/data/reviews.json' with { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const OUT = path.join(root, 'd1/migrations/004-content-layer.sql')

const argv = process.argv.slice(2)
const CHECK_ONLY = argv.includes('--check')
const API = (argv.find(a => a.startsWith('--api=')) || '').slice(6) || process.env.ADMIN_API || 'http://localhost:8788'

const c = { red: s => `\x1b[31m${s}\x1b[0m`, green: s => `\x1b[32m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m`, bold: s => `\x1b[1m${s}\x1b[0m` }
const die = msg => { console.error(`\n${c.red('✘')} ${msg}\n`); process.exit(1) }

// ---------------------------------------------------------------------------
// SQL helpers

const q = v => {
  if (v == null) return 'NULL'
  if (typeof v === 'number') return String(v)
  return `'${String(v).replace(/'/g, "''")}'`
}
const j = v => q(JSON.stringify(v))

const lines = []
const w = s => lines.push(s)
const section = title => { w(''); w(`-- ${'-'.repeat(74)}`); w(`-- ${title}`); w(`-- ${'-'.repeat(74)}`) }

// ---------------------------------------------------------------------------
// Catalogue

async function loadProducts() {
  try {
    const res = await fetch(`${API}/api/products`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    if (!body?.products?.length) throw new Error('empty catalogue')
    return body.products
  } catch (err) {
    die(`Could not read the catalogue from ${API} (${err.message}).\n` +
        `  The rule-equivalence proof needs the real products. Start the local server, or pass --api=<url>.`)
  }
}

// ---------------------------------------------------------------------------
// THE PROOF

function proveRules(products) {
  const failures = []
  let comparisons = 0

  for (const [collectionSlug, sections] of Object.entries(collectionSectionConfig)) {
    for (const sec of sections) {
      for (const product of products) {
        const expected = sec.match(product)
        const actual = matchesRule(product, sec.rule)
        comparisons++
        if (expected !== actual) {
          failures.push({ collectionSlug, section: sec.id, band: null, product: product.name, expected, actual, rule: sec.rule })
        }
      }
      for (const [i, band] of (sec.subgroups || []).entries()) {
        for (const product of products) {
          // A band without `match` was the catch-all "rest", which is exactly what an
          // empty rule means — so both sides are `true` for every product.
          const expected = band.match ? band.match(product) : true
          const actual = matchesRule(product, band.rule)
          comparisons++
          if (expected !== actual) {
            failures.push({ collectionSlug, section: sec.id, band: band.label || `band ${i}`, product: product.name, expected, actual, rule: band.rule })
          }
        }
      }
    }
  }

  if (failures.length) {
    console.error(`\n${c.red(`✘ RULE TRANSLATION IS NOT EQUIVALENT — ${failures.length} mismatch(es)`)}\n`)
    for (const f of failures.slice(0, 25)) {
      console.error(`  ${f.collectionSlug} / ${f.section}${f.band ? ` / ${f.band}` : ''}`)
      console.error(`    product : ${f.product}`)
      console.error(`    old predicate says ${f.expected}, new rule says ${f.actual}`)
      console.error(`    rule    : ${JSON.stringify(f.rule)}\n`)
    }
    if (failures.length > 25) console.error(`  …and ${failures.length - 25} more.\n`)
    die('Nothing written. Fix the rules until every product agrees.')
  }

  console.log(`  ${c.green('✓')} rule equivalence proved — ${comparisons} product/section comparisons, 0 mismatches`)
  return comparisons
}

// ---------------------------------------------------------------------------
// Emit

function emitSchema() {
  section('Schema')
  w(`
CREATE TABLE IF NOT EXISTS collections (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL DEFAULT '',
  eyebrow TEXT NOT NULL DEFAULT '',
  heading TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  hero_intro TEXT NOT NULL DEFAULT '[]',    -- JSON: strings and {"hl": "..."} spans
  hero_video TEXT NOT NULL DEFAULT '',
  hero_poster TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'lamp',
  background TEXT NOT NULL DEFAULT '',
  -- Trade panel. Strictly 1:1 with the collection and never queried on its own, so
  -- folded in as columns rather than a second table. Empty strings reproduce the old
  -- "render nothing" behaviour exactly.
  trade_eyebrow TEXT NOT NULL DEFAULT '',
  trade_heading TEXT NOT NULL DEFAULT '',
  trade_body TEXT NOT NULL DEFAULT '',
  trade_cta TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1
);

-- Ordered membership. A join table rather than a comma list because generate-seo.mjs
-- walks it in order to emit /collection/:c/:cat routes, so the order is SEO-relevant.
CREATE TABLE IF NOT EXISTS collection_categories (
  collection_slug TEXT NOT NULL REFERENCES collections(slug),
  category_slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_slug, category_slug)
);

-- ONE self-referencing table for sections and their subgroup bands. A band IS a
-- section with a label, a rule and no chrome, so a single table means one rule
-- evaluator, one validator, one editor and one reorder endpoint.
--
-- The id is TEXT and deterministic ('<collection>:<anchor>' / '…:band<n>') rather
-- than AUTOINCREMENT, so INSERT OR IGNORE makes this migration re-runnable and
-- parent_id references resolve without a lookup.
CREATE TABLE IF NOT EXISTS collection_sections (
  id TEXT PRIMARY KEY,
  collection_slug TEXT NOT NULL REFERENCES collections(slug),
  parent_id TEXT REFERENCES collection_sections(id),   -- NULL = a section; set = a band
  anchor_id TEXT,                                      -- href="#<anchor_id>"; NULL for bands
  title TEXT NOT NULL DEFAULT '',
  descriptor TEXT NOT NULL DEFAULT '',
  card_text TEXT NOT NULL DEFAULT '',
  recommendation TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT '',
  category_slug TEXT NOT NULL DEFAULT '',
  rule TEXT NOT NULL DEFAULT '{}',                     -- JSON, see functions/lib/section-rules.mjs
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_collection_sections_collection ON collection_sections(collection_slug, sort_order);

-- Per-theme selling copy. lede_template holds {name}, interpolated at READ time, so
-- one row serves every product in the theme.
CREATE TABLE IF NOT EXISTS content_themes (
  theme TEXT PRIMARY KEY,
  lede_template TEXT NOT NULL DEFAULT '',
  use_title TEXT NOT NULL DEFAULT '',
  uses TEXT NOT NULL DEFAULT '[]',           -- JSON array
  care_title TEXT NOT NULL DEFAULT '',
  care TEXT NOT NULL DEFAULT '[]',           -- JSON array
  promise TEXT NOT NULL DEFAULT '',
  reassurance TEXT NOT NULL DEFAULT '[]',    -- JSON array
  proof_review_id TEXT                       -- -> reviews(id)
);

-- A real child table, not a JSON column: images need independent add/replace/delete
-- and a per-row alt, mirroring product_images.
CREATE TABLE IF NOT EXISTS theme_images (
  id TEXT PRIMARY KEY,
  theme TEXT NOT NULL REFERENCES content_themes(theme),
  src TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_theme_images_theme ON theme_images(theme, sort_order);

CREATE TABLE IF NOT EXISTS content_pages (
  path TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '[]',           -- JSON array of paragraphs
  -- Defaults to '' which reproduces today's "use the first paragraph" behaviour,
  -- while giving a real SEO override when someone wants one.
  meta_description TEXT NOT NULL DEFAULT ''
);

-- The flat strings: page headings, eyebrows, site title and description. Anything
-- with structure gets a real table; only plain strings live here.
CREATE TABLE IF NOT EXISTS content_snippets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- One table for every ordered card list. They share a shape, so one admin component
-- parameterised by list_key serves all of them.
CREATE TABLE IF NOT EXISTS content_list_items (
  id TEXT PRIMARY KEY,
  list_key TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '',
  -- Used only by the 'review-signals' list, whose rows are a label plus two numbers.
  -- Nullable and ignored by every other list, which keeps one table serving all of
  -- them rather than adding a near-duplicate table for five rows.
  metric_value INTEGER,
  metric_percent INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_content_list_items_key ON content_list_items(list_key, sort_order);

-- The guestbook corpus plus the curated featured quotes.
--
-- display/flagged_reason replace a regex that used to run on every render. A quote
-- making a medical or air-treatment claim counts as a marketing claim under UK ASA
-- guidance once republished, so it is suppressed at WRITE time and the public query
-- filters on WHERE display = 1. Restoring one is then a deliberate, audited act
-- rather than an accident of pattern drift.
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  date_text TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL DEFAULT '',
  proof TEXT NOT NULL DEFAULT '',            -- short label shown with featured quotes
  rating INTEGER,                            -- NULL = unrated; stars render only when set
  featured INTEGER NOT NULL DEFAULT 0,
  featured_order INTEGER NOT NULL DEFAULT 0,
  display INTEGER NOT NULL DEFAULT 1,
  flagged_reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_reviews_display ON reviews(display, featured, featured_order);
`)
}

function emitReviews() {
  section('Reviews — 5 curated featured quotes, then the 195-row guestbook corpus')
  const rows = []

  featuredReviews.forEach((r, i) => {
    rows.push({ id: `featured-${i + 1}`, name: r.name, date_text: r.date, quote: r.quote, proof: r.proof, featured: 1, featured_order: (i + 1) * 10 })
  })

  let suppressed = 0
  reviewCorpus.forEach(r => {
    const quote = r.feedback || ''
    const flagged = medicalClaimPattern.test(quote)
    if (flagged) suppressed++
    rows.push({
      id: r.id, name: r.name || '', date_text: r.date || '', quote, proof: '',
      featured: 0, featured_order: 0,
      display: flagged ? 0 : 1,
      flagged_reason: flagged ? 'Medical or air-treatment claim — suppressed under UK ASA guidance for republished testimonials.' : '',
    })
  })

  for (const r of rows) {
    w(`INSERT OR IGNORE INTO reviews (id, name, date_text, quote, proof, rating, featured, featured_order, display, flagged_reason) VALUES (${[
      q(r.id), q(r.name), q(r.date_text), q(r.quote), q(r.proof), 'NULL',
      r.featured ?? 0, r.featured_order ?? 0, r.display ?? 1, q(r.flagged_reason || ''),
    ].join(', ')});`)
  }
  return { total: rows.length, suppressed }
}

function emitThemes() {
  section('Per-theme selling copy, reassurance bullets and support images')
  const themes = new Set([...Object.keys(sellingContentByTheme), ...Object.keys(reassuranceByTheme), ...Object.keys(supportImages)])

  for (const theme of themes) {
    const s = sellingContentByTheme[theme] || {}
    const proofIndex = proofReviewIndexByTheme[theme]
    const proofId = proofIndex == null ? null : `featured-${proofIndex + 1}`
    w(`INSERT OR IGNORE INTO content_themes (theme, lede_template, use_title, uses, care_title, care, promise, reassurance, proof_review_id) VALUES (${[
      q(theme), q(s.lede || ''), q(s.useTitle || ''), j(s.uses || []), q(s.careTitle || ''), j(s.care || []),
      q(s.promise || ''), j(reassuranceByTheme[theme] || []), q(proofId),
    ].join(', ')});`)
  }

  w('')
  for (const [theme, images] of Object.entries(supportImages)) {
    images.forEach((im, i) => {
      w(`INSERT OR IGNORE INTO theme_images (id, theme, src, alt, sort_order) VALUES (${[
        q(`${theme}-${i + 1}`), q(theme), q(im.src), q(im.alt), (i + 1) * 10,
      ].join(', ')});`)
    })
  }
  return themes.size
}

function emitCollections() {
  section('Collections, their category membership, and their sections')

  shopperPaths.forEach((p, i) => {
    const trade = collectionTradeCopy[p.slug] || {}
    w(`INSERT OR IGNORE INTO collections (slug, name, short_name, eyebrow, heading, description, hero_intro, hero_video, hero_poster, theme, background, trade_eyebrow, trade_heading, trade_body, trade_cta, sort_order, visible) VALUES (${[
      q(p.slug), q(p.name), q(p.shortName || ''), q(p.eyebrow || ''), q(p.heading || ''), q(p.description || ''),
      j(p.heroIntro || []), q(p.heroVideo || ''), q(p.heroPoster || ''), q(p.theme || 'lamp'), q(p.background || ''),
      q(trade.eyebrow || ''), q(trade.heading || ''), q(trade.body || ''), q(trade.cta || ''),
      (i + 1) * 10, 1,
    ].join(', ')});`)
  })

  w('')
  for (const p of shopperPaths) {
    ;(p.categories || []).forEach((cat, i) => {
      w(`INSERT OR IGNORE INTO collection_categories (collection_slug, category_slug, sort_order) VALUES (${q(p.slug)}, ${q(cat)}, ${(i + 1) * 10});`)
    })
  }

  w('')
  let sectionCount = 0
  for (const [slug, sections] of Object.entries(collectionSectionConfig)) {
    sections.forEach((sec, i) => {
      const id = `${slug}:${sec.id}`
      sectionCount++
      w(`INSERT OR IGNORE INTO collection_sections (id, collection_slug, parent_id, anchor_id, title, descriptor, card_text, recommendation, image, theme, category_slug, rule, sort_order) VALUES (${[
        q(id), q(slug), 'NULL', q(sec.id), q(sec.title || ''), q(sec.descriptor || ''), q(sec.cardText || ''),
        q(sec.recommendation || ''), q(sec.image || ''), q(sec.theme || ''), q(sec.categorySlug || ''),
        j(sec.rule || {}), (i + 1) * 10,
      ].join(', ')});`)

      ;(sec.subgroups || []).forEach((band, bi) => {
        sectionCount++
        w(`INSERT OR IGNORE INTO collection_sections (id, collection_slug, parent_id, anchor_id, title, descriptor, card_text, recommendation, image, theme, category_slug, rule, sort_order) VALUES (${[
          q(`${id}:band${bi + 1}`), q(slug), q(id), 'NULL', q(band.label || ''), q(''), q(''), q(''), q(''), q(''), q(''),
          j(band.rule || {}), (bi + 1) * 10,
        ].join(', ')});`)
      })
    })
  }
  return { collections: shopperPaths.length, sections: sectionCount }
}

function emitPagesAndSnippets() {
  section('Policy pages, flat copy snippets, and the ordered card lists')

  for (const [pathname, page] of Object.entries(pages)) {
    w(`INSERT OR IGNORE INTO content_pages (path, title, body, meta_description) VALUES (${[
      q(pathname), q(page.title), j(page.body || []), q(''),
    ].join(', ')});`)
  }

  w('')
  const snippets = {
    'site.title': siteTitle,
    'site.description': siteDescription,
    'shop.eyebrow': pageCopy.shop.eyebrow,
    'shop.title': pageCopy.shop.title,
    'shop.description': pageCopy.shop.description,
    'not_found.eyebrow': pageCopy.notFound.eyebrow,
    'not_found.title': pageCopy.notFound.title,
    'not_found.description': pageCopy.notFound.description,
    'collection.leftover_title': 'More in this range',
    // A factual claim about real customers, so it belongs in editable data rather
    // than a source file. It is still a frozen figure — the reviews table has a
    // `rating` column, and this should be computed from it once ratings are real.
    'reviews.headline_score': '5.0',
  }
  for (const [key, value] of Object.entries(snippets)) {
    w(`INSERT OR IGNORE INTO content_snippets (key, value) VALUES (${q(key)}, ${q(value)});`)
  }

  w('')
  let items = 0
  const allLists = { ...listItems, 'review-signals': reviewSignals }
  for (const [listKey, entries] of Object.entries(allLists)) {
    entries.forEach((entry, i) => {
      items++
      w(`INSERT OR IGNORE INTO content_list_items (id, list_key, label, title, text, href, metric_value, metric_percent, sort_order) VALUES (${[
        q(`${listKey}-${i + 1}`), q(listKey), q(entry.label || ''), q(entry.title || ''), q(entry.text || ''), q(entry.href || ''),
        entry.count == null ? 'NULL' : entry.count, entry.percent == null ? 'NULL' : entry.percent, (i + 1) * 10,
      ].join(', ')});`)
    })
  }
  return { pages: Object.keys(pages).length, snippets: Object.keys(snippets).length, items }
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n${c.bold('=== Extracting the content layer ===')}\n`)

  const products = await loadProducts()
  console.log(`  catalogue: ${products.length} products from ${API}`)
  proveRules(products)

  if (CHECK_ONLY) {
    console.log(`\n${c.green('Check only — nothing written.')}\n`)
    return
  }

  w('-- Migration 004 — the marketing content layer.')
  w('--')
  w('-- GENERATED by scripts/extract-content-seed.mjs. Do not hand-edit: regenerate.')
  w('--')
  w('-- Every INSERT is OR IGNORE and every CREATE is IF NOT EXISTS, because')
  w('-- deploy-production.sh loops over every file in d1/migrations/ on EVERY run.')
  w('-- Re-applying this file is a no-op.')
  w('--')
  w('-- The section rules in collection_sections.rule were proved equivalent to the')
  w('-- original JavaScript predicates against the real catalogue before this file was')
  w('-- written — see the header of the generator.')
  w('--')
  w('--   Local:  wrangler d1 execute salty-lamps-db --local  --file=d1/migrations/004-content-layer.sql')
  w('--   Remote: wrangler d1 execute salty-lamps-db --remote --file=d1/migrations/004-content-layer.sql')

  emitSchema()
  const reviews = emitReviews()
  const themes = emitThemes()
  const collections = emitCollections()
  const rest = emitPagesAndSnippets()

  w('')
  fs.writeFileSync(OUT, `${lines.join('\n')}\n`)

  console.log(`  ${c.green('✓')} wrote ${path.relative(root, OUT)}`)
  console.log(c.dim(`      ${collections.collections} collections, ${collections.sections} sections/bands`))
  console.log(c.dim(`      ${themes} themes with selling copy, reassurance and support images`))
  console.log(c.dim(`      ${reviews.total} reviews (${reviews.suppressed} suppressed as medical claims)`))
  console.log(c.dim(`      ${rest.pages} policy pages, ${rest.snippets} snippets, ${rest.items} list items`))
  console.log()
}

main().catch(err => die(err.stack || err.message))
