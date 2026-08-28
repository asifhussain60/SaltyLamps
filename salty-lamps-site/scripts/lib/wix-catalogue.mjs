// Reading a Wix "Export Products to CSV" file into this shop's shape.
//
// Shared by scripts/catalogue-reset.mjs (`import-wix`, which merges an export into
// data/catalogue.json) and available to anything else that needs to read one. The
// column names and the quirks below were established by scripts/generate-d1-seed.mjs
// against the real export and are kept identical here on purpose: two readings of
// the same file that disagree would be worse than either.
//
// THE SHAPE OF A WIX EXPORT. One row per product, then one row per variant beneath
// it, tied together by `handleId` and distinguished by `fieldType` (Product /
// Variant). A product with no variants has no Variant rows at all and carries its
// own price and stock — which is why the product row is used as its own single
// variant when none follow it.
//
// `handleId` is also this database's `products.id`: the original seed used it
// verbatim, so a product exported from Wix today lands on the same row it already
// occupies. That is what makes an import a merge rather than a duplicate.

// RFC 4180 as Wix actually writes it: quoted fields, doubled quotes inside them,
// CRLF or LF line endings. Lifted from generate-d1-seed.mjs unchanged.
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

// Wix "collection" text -> this site's category taxonomy. Kept in step with
// generate-d1-seed.mjs; a collection with no mapping contributes nothing rather
// than inventing a category slug the site does not build a page for.
const CATEGORY_MAP = {
  'salt lamps': 'salt-lamps',
  'candle holders': 'candle-holders',
  'rock salt pantry items': 'rock-salt-pantry-items',
  'rock salt bricks': 'rock-salt-bricks',
  'equestrian / salt licks': 'equestrian-salt-licks',
  'himalyan salt massage & relaxation products': 'himalayan-salt-massage-relaxation-products',
  'accessories': 'accessories',
  'special deal': 'special-deal',
}

export function mapCategories(rawCollection) {
  const parts = String(rawCollection || '').split(';').map(s => s.trim().toLowerCase()).filter(Boolean)
  const slugs = new Set(['all-products'])
  const unmapped = []
  for (const part of parts) {
    const slug = CATEGORY_MAP[part]
    if (slug) slugs.add(slug)
    else unmapped.push(part)
  }
  return { slugs: [...slugs], unmapped }
}

export function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function stripHtmlAndTruncate(html, maxLen = 200) {
  const text = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLen) return text
  const cut = text.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLen)}…`
}

export function toPence(priceStr) {
  const n = parseFloat(priceStr)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

// Wix's `inventory` column is either a word or a number, and which it is decides
// how the shop tracks that variant. 'InStock'/'OutOfStock' means Wix was not
// counting, so neither does this shop — a manual toggle. A number means a real
// count. Reading a number as a toggle would silently discard the stock figure.
export function readInventory(invRaw) {
  const raw = String(invRaw ?? '').trim()
  if (raw === 'InStock' || raw === 'OutOfStock') {
    return { track_mode: 'binary', quantity: null, in_stock: raw === 'InStock' ? 1 : 0 }
  }
  const n = parseInt(raw, 10)
  const quantity = Number.isFinite(n) ? n : 0
  return { track_mode: 'quantity', quantity, in_stock: quantity > 0 ? 1 : 0 }
}

// A Wix export -> the same product shape data/catalogue.json holds.
//
// Returns { products, warnings }. Warnings are things a person needs to decide
// about — an unmapped collection, a missing price, a duplicate variant key — and
// are never resolved silently, because every one of them is a way for a catalogue
// to go live subtly wrong.
export function readWixExport(csvText) {
  const rows = parseCsv(String(csvText).replace(/^﻿/, ''))
  if (!rows.length) return { products: [], warnings: ['The file is empty.'] }

  const [header, ...body] = rows
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]))
  const required = ['handleId', 'fieldType', 'name']
  const missing = required.filter(f => !(f in idx))
  if (missing.length) {
    return {
      products: [],
      warnings: [`This does not look like a Wix product export — no ${missing.join(', ')} column. `
        + 'Check you exported Products rather than Orders.'],
    }
  }
  const get = (row, field) => (row[idx[field]] ?? '').trim()

  const warnings = []

  // A row with the wrong number of fields means the file is not the file Wix
  // wrote. The usual cause is opening the export in Excel and saving it again,
  // which re-quotes everything to its own taste; the usual symptom, without this
  // check, is a product whose name silently contains the next three rows. Wix's
  // own export is always rectangular, so any deviation is worth stopping for.
  const ragged = body.filter(r => r.length !== header.length)
  if (ragged.length) {
    warnings.push(`${ragged.length} row(s) have ${header.length === 1 ? '' : 'a different number of '}`
      + `columns to the header (expected ${header.length}). This file has been altered since Wix `
      + 'wrote it — most often by opening it in Excel and saving. Re-export from Wix and import '
      + 'that file without opening it.')
  }

  const groups = new Map()
  const order = []
  for (const row of body) {
    const hid = get(row, 'handleId')
    if (!hid) continue
    if (!groups.has(hid)) { groups.set(hid, []); order.push(hid) }
    groups.get(hid).push(row)
  }
  const products = []

  for (const hid of order) {
    const grp = groups.get(hid)
    const productRow = grp.find(r => get(r, 'fieldType') === 'Product')
    const variantRows = grp.filter(r => get(r, 'fieldType') === 'Variant')
    if (!productRow) { warnings.push(`${hid}: variant rows with no product row — skipped.`); continue }

    const name = get(productRow, 'name')
    const { slugs, unmapped } = mapCategories(get(productRow, 'collection'))
    for (const u of unmapped) {
      warnings.push(`${name}: Wix collection "${u}" has no category on this site — the product will `
        + 'appear only under All products.')
    }

    // A product with no Variant rows is its own single variant.
    const skuRows = variantRows.length ? variantRows : [productRow]
    const seen = new Set()
    const skus = []
    for (const r of skuRows) {
      const sku = get(r, 'sku') || `${hid}-default`
      const variant_label = [get(r, 'productOptionDescription1'), get(r, 'productOptionDescription2')]
        .filter(Boolean).join(' / ')
      const priceStr = get(r, 'price') || get(productRow, 'price')
      if (!priceStr) warnings.push(`${name} / ${sku}: no price in the export — imported as £0.00.`)
      const key = `${sku} ${variant_label}`
      if (seen.has(key)) {
        warnings.push(`${name}: two variants share the code "${sku}" and the same options — `
          + 'only the first was kept. Fix this in Wix before relying on the import.')
        continue
      }
      seen.add(key)
      skus.push({ sku, variant_label, price_pence: toPence(priceStr), ...readInventory(get(r, 'inventory')) })
    }

    products.push({
      id: hid,
      name,
      slug: slugify(name),
      description: stripHtmlAndTruncate(get(productRow, 'description')),
      // Wix's image column names files on Wix's own CDN. This shop rehosts its
      // images and stores local paths, so an import must never overwrite one with
      // a Wix filename — see the merge policy in catalogue-reset.mjs. Carried only
      // so a brand-new product is not left with no image at all.
      wixImageField: get(productRow, 'productImageUrl'),
      categories: slugs.join(','),
      tags: '',
      visible: get(productRow, 'visible') === 'true' ? 1 : 0,
      skus,
    })
  }

  return { products, warnings }
}
