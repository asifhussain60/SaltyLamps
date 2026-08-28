// Re-encode the images in public/media so pages load quickly.
//
// WHY THIS EXISTS. The catalogue images came straight off Wix's CDN at full
// resolution with no re-encoding (see infra/known-issues.md §3): 81 MB across
// 127 files, with single product photographs over 4 MB. Image weight is the
// dominant factor in Largest Contentful Paint, which Google uses as a ranking
// signal, and on a phone on mobile data it is the difference between a sale and
// a bounce.
//
// WHAT IT DELIBERATELY DOES NOT DO — change any filename.
//
// Every image path is stored as data: in the D1 `products`/`content` tables, in
// the generated d1/seed.sql, and in the committed content snapshot. Renaming
// `x.png` to `x.webp` would mean a data migration across two databases to save
// a further ~12 MB. WebP is the better format and that migration is worth doing
// one day; it is not worth coupling to a routine compression pass. So each file
// is re-encoded in place, in its existing format, under its existing name, and
// nothing that references it has to know this ran.
//
// The PNGs are the whole problem: 54 of them hold 61 MB because photographs
// were saved as PNG, a format built for flat graphics. Palette quantisation
// gets ~70% back for a mean pixel difference of about 2/255 — measured, not
// assumed, and invisible on the glowing-lamp gradients that would show banding
// first. Re-compressing them losslessly instead makes them BIGGER than the
// originals, so quantisation is the only PNG win available without a rename.
//
// USAGE
//   node scripts/optimise-media.mjs            # re-encode what needs it
//   node scripts/optimise-media.mjs --dry-run  # report only, touch nothing
//
// Safe to re-run. A manifest records what this script produced, so an image is
// never quantised twice — repeated passes on an already-quantised photograph
// would visibly degrade it. Replace a file by hand and the next run picks it up
// again, because its size no longer matches the manifest.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const mediaDir = path.join(root, 'public/media')
const manifestPath = path.join(root, 'scripts/.media-optimised.json')

const dryRun = process.argv.includes('--dry-run')

// Nothing on this site is displayed wider than a full-bleed hero, and the
// storefront is served to phones more than anything else. 1600px covers a
// retina render of the largest card without carrying print-resolution weight.
const MAX_WIDTH = 1600

// Quality settings, chosen from a measured comparison rather than by feel:
//   JPEG 82 + mozjpeg  — ~90% off the Wix originals, no visible artefacts
//   PNG palette @ 80   — ~70% off, mean difference ~2/255
const JPEG = { quality: 82, mozjpeg: true }
const PNG = { quality: 80, compressionLevel: 9, palette: true }

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch {
    return {}
  }
}

function listImages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return listImages(full)
    return /\.(png|jpe?g)$/i.test(entry.name) ? [full] : []
  })
}

const kb = bytes => `${Math.round(bytes / 1024)}KB`

async function run() {
  const manifest = readManifest()
  const files = listImages(mediaDir).sort()

  let before = 0
  let after = 0
  let changed = 0
  let skipped = 0
  const rows = []

  for (const file of files) {
    const rel = path.relative(root, file)
    const size = fs.statSync(file).size
    before += size

    // Already done by a previous run, and untouched since.
    if (manifest[rel] === size) {
      after += size
      skipped += 1
      continue
    }

    const input = fs.readFileSync(file)
    const meta = await sharp(input).metadata()
    const isPng = meta.format === 'png'

    let pipeline = sharp(input)
    if (meta.width > MAX_WIDTH) pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true })
    // JPEG has no alpha channel. Compositing onto white matches how these
    // photographs are displayed anyway; without it sharp renders transparency
    // as black, which would ruin any cut-out product shot.
    if (!isPng) pipeline = pipeline.flatten({ background: '#ffffff' })
    // PNGs are NOT flattened, so genuine transparency survives. Note that the
    // palette quantiser drops an alpha channel it finds to be redundant, which
    // shows up as "transparency lost" if you diff metadata. On this catalogue
    // that happened to three files and was checked pixel by pixel: two had no
    // non-opaque pixel at all, and the third had 1875 pixels at alpha 250-254 —
    // conversion noise on a soft edge, not a cut-out background.
    const output = await pipeline[isPng ? 'png' : 'jpeg'](isPng ? PNG : JPEG).toBuffer()

    // Never make a file bigger. Some images are already well-encoded, and a
    // "compression" pass that inflates them is worse than doing nothing.
    if (output.length >= size) {
      after += size
      skipped += 1
      manifest[rel] = size
      continue
    }

    if (!dryRun) {
      fs.writeFileSync(file, output)
      manifest[rel] = output.length
    }
    after += output.length
    changed += 1
    rows.push({ rel, size, out: output.length })
  }

  rows.sort((a, b) => (b.size - b.out) - (a.size - a.out))
  rows.slice(0, 12).forEach(r => {
    const pct = Math.round((1 - r.out / r.size) * 100)
    console.log(`  ${kb(r.size).padStart(7)} → ${kb(r.out).padStart(7)}  −${String(pct).padStart(2)}%  ${r.rel.replace('public/media/', '')}`)
  })
  if (rows.length > 12) console.log(`  … and ${rows.length - 12} more`)

  if (!dryRun) fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  const saved = before - after
  console.log(`\n${dryRun ? '[dry run] ' : ''}${changed} re-encoded, ${skipped} left alone`)
  console.log(`${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB`
    + `  (saved ${(saved / 1048576).toFixed(1)} MB, ${Math.round((saved / before) * 100)}%)`)
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
