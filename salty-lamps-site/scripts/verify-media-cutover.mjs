// Read-only release gate: deployed files must be the reviewed bytes, with matching option assignments.
import fs from 'node:fs'
import crypto from 'node:crypto'
const manifest = JSON.parse(fs.readFileSync(new URL('../data/media-refresh.json', import.meta.url)))
const assignments = JSON.parse(fs.readFileSync(new URL('../data/media-refresh-assignments.json', import.meta.url)))
const url = process.argv.find(a => a.startsWith('--url='))?.slice(6)
if (!url || !/^https?:\/\//.test(url)) throw new Error('Pass --url=https://destination.example')
const assets = new Map(manifest.assets.map(a => [a.id, a]))
const failures=[]
for (const a of manifest.assets) {
  try {
    const response=await fetch(new URL(a.output,url), {cache:'no-store'})
    const hash=crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')
    if (!response.ok || !response.headers.get('content-type')?.includes('image/webp') || hash!==a.outputSha256) failures.push(`Image differs or missing: ${a.id}`)
  } catch { failures.push(`Image request failed: ${a.id}`) }
}
const response=await fetch(new URL('/api/products',url),{cache:'no-store'})
if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`)
const {products}=await response.json()
let count=0
for(const p of assignments.products) for(const o of p.options) {
  count++
  const rows=products.filter(r=>r.productId===p.productId && r.sku===o.sku && r.variantLabel===o.label)
  if(rows.length!==1 || rows[0].image!==assets.get(o.asset).output || !rows[0].hasOptionImage) failures.push(`Option mapping differs: ${o.sku} / ${o.label}`)
}
console.log(JSON.stringify({destination:url,assets:manifest.assets.length,options:count,failures},null,2))
if(failures.length) process.exitCode=1
