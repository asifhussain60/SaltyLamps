// Derives correct per-variant retail prices from the 2025 trade price list.
//
// THE PROBLEM. 56 of 77 SKUs carry the same price as every other size of the same
// product: a 12-pack of 4-5kg salt licks is priced identically to a single 1kg one,
// 10kg of culinary salt the same as 1kg. The Wix export evidently carried only each
// product's base price and dropped per-variant pricing. In two cases the shop is
// selling BELOW its own trade cost.
//
// THE MARGIN RULE — derived, not invented. Every product that is already correctly
// priced sits at exactly 2x its trade price, rounded up to the next whole pound and
// then a penny below it:
//
//     RSL-A  trade 15.00 -> 29.99      RSL-M  trade 12.50 -> 24.99
//     RSL-F  trade 15.00 -> 29.99      RSL-BL trade 12.50 -> 24.99
//     RSL-D  trade 15.00 -> 29.99      RSL-P  trade 12.50 -> 24.99
//     RSL-XS trade  6.00 -> 11.99      TCCL   trade  4.00 ->  7.99
//     TC-2   trade  3.00 ->  5.99      RSL-T  trade 12.50 -> 24.99
//
// That is keystone markup (2x cost / 50% gross margin), the standard retail default,
// and it is what this shop already does. Using the business's own demonstrated rule
// is safer than importing a benchmark, and it means correctly-priced items do not
// move at all.
//
// VAT. The trade list is ex-VAT and notes 20% is added where applicable. UK price
// marking rules require consumer-facing prices to include VAT, and the existing
// retail prices are VAT-inclusive at 2x trade, so the keystone already absorbs it.
// Prices produced here are VAT-inclusive, consistent with every price on the site.
//
// MULTIPACKS. The trade list quotes a price per unit within a carton, so a "12pc"
// variant is twelve units and is priced as twelve. NO volume discount is applied —
// inventing a discount curve is the owner's commercial call, not a mechanical one.
//
// USAGE
//   node scripts/reprice-from-trade-list.mjs            # report only, changes nothing
//   node scripts/reprice-from-trade-list.mjs --apply    # PATCH each SKU via the admin API
//
// --apply goes through the admin API rather than SQL so every change lands in the
// audit log with an actor, exactly like a human edit.

const API = process.env.ADMIN_API || 'http://localhost:8788'
const APPLY = process.argv.includes('--apply')

// Salty Lamps Trade Price List, 01 April 2025. Ex-VAT, per unit within a carton.
const TRADE = {
  // Tea light candle holders
  'TC-1': 2.20, 'TC-2': 3.00, TCH: 3.50, TCA: 3.50, TCB: 3.50, TCG: 3.50, TCC: 3.50, TCCL: 4.00,
  // Lamps
  'RSL-XS': 6.00, 'RSL-1': 7.50, 'RSL-2': 12.50, 'RSL-3': 14.00,
  'RSL-B': 12.50, 'RSL-BB': 18.00, 'RSL-E': 12.50, 'RSL-M': 12.50, 'RSL-BL': 12.50,
  'RSL-T': 12.50, 'RSL-F': 15.00, 'RSL-P': 12.50, 'RSL-D': 15.00, 'RSL-A': 15.00,
  'RSL-B1': 12.50, 'RSL-B2': 12.50, 'RSL-B3': 15.00, 'RSL-WB': 18.00,
  // Edible / bath / solay
  'CUL-100': 0.60, 'CUL-500': 1.25, 'CUL-1000': 1.50, 'CUL-5000': 7.00,
  'SOL-500': 1.25, 'SOL-1000': 1.50, 'SOL-5000': 7.00,
  'KN-200': 1.00, 'SMK-250': 2.50, 'PBS-100': 3.50, 'PBS-200': 6.00,
  // Massage / soap / deodorant
  'SB-01': 1.85, 'SH-01': 1.85, 'SD-01': 1.85, 'SB-02': 2.00, 'SB-02L': 2.00,
  'SS-01': 2.20, 'SS-01-02': 2.50, 'SI-01': 6.00,
  // Pantry
  'SPC-8': 10.00, 'SPS-8': 10.00, 'SPR-12': 12.50, 'HSP-1': 8.00,
  'SB-03': 8.00, 'SB-04': 10.00, 'SB-05': 2.50, 'SB-06': 12.00,
  'M&P': 12.00, 'SC-01': 10.00, 'SC-02': 15.00, 'SC-03': 20.00,
  'SG-01': 1.80, 'ST-841': 3.50, 'ST-842': 4.00,
  // Spares
  'E14-1': 0.70, 'E14-2': 0.80, PC: 3.50, 'PC-1': 5.00,
  // Licks
  'SL-1': 2.50, 'SL-2': 3.50, 'SL-3': 5.00,
}

// Extrapolated where the trade list stops short of a size the shop actually sells.
// Kept separate from TRADE so it is obvious which prices are quoted and which are
// inferred, and each one carries its arithmetic.
const EXTRAPOLATED = {
  // CUL-1000 is £1.50/kg and CUL-5000 is £1.40/kg; 10Kg continues at the 5Kg rate.
  // Without this the shop lists 10Kg cheaper than 5Kg, which is worse than an
  // inferred price — but it IS inferred, so it is reported as such.
  'CUL-10': { price: 14.00, note: '2 x the 5Kg rate (£7.00); the list stops at 5Kg' },
}

// The two SKU codes the catalogue uses for two unrelated products each. Resolved by
// hand rather than by heuristic — there are exactly two, and the trade list makes
// the correct owner unambiguous. The listed product keeps the price; the other is
// reported so the owner can give it a code of its own.
const DUPLICATE_CODE_OWNER = {
  // The list defines SL-2 as "Rock Salt Lick, 2-3Kg approx with Rope" — that is the
  // sized variant, not the separate bundle listing that also carries the code.
  'SL-2': 'Himalayan Rock Salt Lick for Equestrian & Cattle',
  // The list defines ST-841 as "Rock Salt Tiles/Block 8x4x1" — a wall tile. The
  // platter product carrying the same code is a mis-assignment.
  'ST-841': 'Himalayan Rock Salt Bricks for Salt Walls',
}

// SKU codes in the catalogue that do not appear on the trade list, with the reason.
// These are reported and left ALONE rather than guessed at — a wrong price applied
// confidently is worse than one flagged for the owner.
const UNMAPPED_REASON = {
  'Deal 1': 'Bundle offer — deliberately priced, no trade line',
  'Deal 2': 'Bundle offer — deliberately priced, no trade line',
  'RSL-Dolphin': 'Not on the trade list; currently £29.99, consistent with the other 4kg shapes',
  PC1: 'Cable — ambiguous: the list has PC (1.5m, £3.50) and PC-1 (2m, £5.00); which this is, is unclear',
  PC2: 'Cable — same ambiguity as PC1',
  'CUL-10': '10Kg culinary salt — the list stops at 5Kg (CUL-5000)',
  'CUL-10C': '10Kg culinary salt, coarse — the list stops at 5Kg',
  'BS-1000': 'Bath salt — no bath-salt line on the trade list',
  'BS-5000': 'Bath salt — no bath-salt line on the trade list',
  'BS-10': 'Bath salt — no bath-salt line on the trade list',
  'ST-881': 'Platter 8x8x1 — closest list entry is SPS-8 (Square 8", £10.00), but the code differs',
}

// Normalises a catalogue SKU code to a trade-list code.
//   'SL-1 (12)'  -> 'SL-1'   pack quantity comes from the variant label, not the code
//   'CUL-1000C'  -> 'CUL-1000'  the C suffix is grind (coarse), same price
const normaliseCode = sku => {
  let code = String(sku).replace(/\s*\(\d+\)\s*$/, '').trim()
  if (/^CUL-\d+C$/.test(code)) code = code.slice(0, -1)
  return code
}

// A variant label like '1-1.5Kg / 12pc' or '25 Watts / 3pc' means N units in the pack.
const packSize = label => {
  const m = String(label || '').match(/(\d+)\s*pc\b/i)
  return m ? Number(m[1]) : 1
}

// Bulb codes are unreliable: E14-1 (15W) is stamped on a 25W variant. The wattage in
// the variant label is unambiguous and the trade list has a line for each, so price
// from the label and report the mismatch rather than trusting a code we can see is
// wrong.
const bulbCodeFromLabel = label => {
  const m = String(label || '').match(/(\d+)\s*Watts?/i)
  if (!m) return null
  return m[1] === '15' ? 'E14-1' : m[1] === '25' ? 'E14-2' : null
}

// Keystone, then the shop's own .99 convention: up to the next whole pound, less 1p.
const retailPence = tradeUnit => Math.ceil(tradeUnit * 2) * 100 - 1

const gbp = pence => `£${(pence / 100).toFixed(2)}`

async function main() {
  const res = await fetch(`${API}/api/admin/products`)
  if (!res.ok) throw new Error(`Could not read the catalogue (${res.status}). Is wrangler pages dev running?`)
  const { products } = await res.json()

  // A code used by two UNRELATED products cannot be priced from the list — the same
  // code would set two different products to the same price. Both known cases are
  // real mis-assignments (SL-2 is on a bulk listing and a single lick; ST-841 is a
  // wall tile also stamped on a platter), so these are flagged, never guessed at.
  const productsPerCode = new Map()
  for (const product of products) {
    for (const sku of product.skus) {
      const code = normaliseCode(sku.sku)
      if (!productsPerCode.has(code)) productsPerCode.set(code, new Set())
      productsPerCode.get(code).add(product.id)
    }
  }

  const changes = []
  const unchanged = []
  const skipped = []
  const held = []
  const inferred = []
  const codeMismatches = []

  for (const product of products) {
    for (const sku of product.skus) {
      let code = normaliseCode(sku.sku)

      if (productsPerCode.get(code)?.size > 1 && DUPLICATE_CODE_OWNER[code] !== product.name) {
        skipped.push({
          product: product.name,
          sku,
          reason: `Code "${code}" belongs to "${DUPLICATE_CODE_OWNER[code] || 'another product'}" on the trade list. `
            + 'This product needs a code of its own before it can be priced automatically.',
        })
        continue
      }

      const fromLabel = bulbCodeFromLabel(sku.variant_label)
      if (fromLabel && fromLabel !== code) {
        codeMismatches.push({ product: product.name, sku, was: code, shouldBe: fromLabel })
        code = fromLabel
      }

      const trade = TRADE[code] ?? EXTRAPOLATED[code]?.price
      if (EXTRAPOLATED[code]) inferred.push({ product: product.name, sku, code, note: EXTRAPOLATED[code].note })
      if (trade == null) {
        skipped.push({ product: product.name, sku, reason: UNMAPPED_REASON[code] || UNMAPPED_REASON[sku.sku] || 'No matching code on the trade list' })
        continue
      }
      const qty = packSize(sku.variant_label)
      const proposed = retailPence(trade * qty)
      const costPence = Math.round(trade * qty * 100)
      const row = { product: product.name, sku, code, trade, qty, from: sku.price_pence, to: proposed }

      if (proposed === sku.price_pence) {
        unchanged.push(row)
        continue
      }

      // The defect being fixed is a variant group that lost its per-size pricing, so
      // every SKU of a multi-variant product is in scope. A SINGLE-SKU product sitting
      // above keystone was never flattened — that is a deliberate price, and
      // overwriting it would replace the owner's judgement with a formula. Selling
      // below cost is always corrected either way.
      //
      // Note this deliberately tests "is a variant group", NOT "do all its variants
      // currently share one price": the latter stops being true after the first pass,
      // so a partially-repriced group would freeze with its remaining members treated
      // as deliberate. Testing group membership keeps the script idempotent.
      const isVariantGroup = product.skus.length > 1
      const belowCost = sku.price_pence < costPence

      if (!isVariantGroup && !belowCost) {
        held.push({ ...row, reason: 'Single price, not a flattened variant group — left as priced.' })
        continue
      }
      changes.push(row)
    }
  }

  const belowCost = changes.filter(r => r.from < Math.round(r.trade * r.qty * 100))

  console.log(`\n=== Repricing against the 2025 trade list (keystone 2x, VAT-inclusive) ===\n`)
  console.log(`  already correct     : ${unchanged.length}`)
  console.log(`  to change           : ${changes.length}`)
  console.log(`  deliberate, kept    : ${held.length}`)
  console.log(`  needs owner input   : ${skipped.length}`)
  if (belowCost.length) {
    console.log(`\n  !! ${belowCost.length} SKU(s) are currently priced BELOW their trade cost:`)
    for (const r of belowCost) {
      console.log(`     ${r.sku.sku.padEnd(12)} ${gbp(r.from)} sells at a loss against £${(r.trade * r.qty).toFixed(2)} cost  ->  ${gbp(r.to)}`)
    }
  }

  const cuts = changes.filter(r => r.to < r.from)
  if (cuts.length) {
    console.log(`\n--- ${cuts.length} price REDUCTION(s) ---`)
    console.log(`  These items were over-priced by the same flattening: the group collapsed`)
    console.log(`  onto its most expensive member. Correct under the rule, but a revenue`)
    console.log(`  decision — say the word and they can be left where they are.`)
    for (const r of cuts) {
      console.log(`  ${gbp(r.from).padStart(8)} -> ${gbp(r.to).padStart(8)}  ${r.product} ${r.sku.variant_label ? `(${r.sku.variant_label})` : ''}`)
    }
  }

  console.log(`\n--- Changes ---`)
  const byProduct = new Map()
  for (const r of changes) {
    if (!byProduct.has(r.product)) byProduct.set(r.product, [])
    byProduct.get(r.product).push(r)
  }
  for (const [name, rows] of byProduct) {
    console.log(`\n  ${name}`)
    for (const r of rows) {
      const label = r.sku.variant_label || '(single)'
      const pack = r.qty > 1 ? ` [${r.qty} units @ £${r.trade.toFixed(2)}]` : ''
      console.log(`    ${label.padEnd(26)} ${gbp(r.from).padStart(8)} -> ${gbp(r.to).padStart(8)}${pack}`)
    }
  }

  if (held.length) {
    console.log(`\n--- Priced above the rule, deliberately — left alone ---`)
    for (const h of held) {
      console.log(`  ${gbp(h.from).padStart(8)} (rule says ${gbp(h.to)})  ${h.product}${h.sku.variant_label ? ` (${h.sku.variant_label})` : ''}`)
    }
  }

  if (inferred.length) {
    console.log(`\n--- Prices INFERRED, not quoted on the trade list ---`)
    for (const i of inferred) {
      console.log(`  ${i.sku.sku.padEnd(12)} ${i.product}${i.sku.variant_label ? ` (${i.sku.variant_label})` : ''}`)
      console.log(`  ${''.padEnd(12)} ${i.note}`)
    }
  }

  if (codeMismatches.length) {
    console.log(`\n--- SKU codes that contradict their own variant label ---`)
    console.log(`  Priced from the label, which is unambiguous. The codes still need fixing.`)
    for (const m of codeMismatches) {
      console.log(`  ${m.sku.variant_label.padEnd(20)} is coded ${m.was}, should be ${m.shouldBe}  (${m.product})`)
    }
  }

  if (skipped.length) {
    console.log(`\n--- Left alone, needs an owner decision ---`)
    for (const s of skipped) {
      console.log(`  ${s.sku.sku.padEnd(14)} ${gbp(s.sku.price_pence).padStart(8)}  ${s.product}`)
      console.log(`  ${''.padEnd(14)} ${''.padStart(8)}  ${s.reason}`)
    }
  }

  if (!APPLY) {
    console.log(`\nReport only. Re-run with --apply to write these through the admin API.\n`)
    return
  }

  console.log(`\n--- Applying ${changes.length} price changes ---`)
  let ok = 0
  for (const r of changes) {
    const body = { ...r.sku, price_pence: r.to }
    const put = await fetch(`${API}/api/admin/skus/${r.sku.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!put.ok) {
      console.log(`  FAILED ${r.sku.sku}: ${put.status} ${await put.text()}`)
    } else {
      ok++
    }
  }
  console.log(`  ${ok}/${changes.length} applied.\n`)
}

await main()
