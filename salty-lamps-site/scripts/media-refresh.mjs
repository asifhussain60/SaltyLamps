// Reproducible asset intake and mapping. AI generation happens outside this script;
// once reviewed, outputs are hashed and reused. Originals are never overwritten.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(root, 'data/media-refresh.json')
const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex')
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath)) : { version: 1, assets: [] }
const [command, ...args] = process.argv.slice(2)
const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

if (command === 'record') {
  const [id, source, generatedFile, promptFile] = args
  if (!/^[a-z0-9-]+$/.test(id || '') || !source?.startsWith('/media/')) throw new Error('Expected safe asset id and original /media/ reference')
  const sourceFile = path.join(root, 'public', source)
  const output = `/media/light-catalogue/${id}.webp`
  const target = path.join(root, 'public', output)
  const prompt = fs.readFileSync(promptFile, 'utf8')
  const original = fs.readFileSync(sourceFile)
  const generated = fs.readFileSync(generatedFile)
  const existing = manifest.assets.find(a => a.id === id)
  if (existing) {
    if (existing.sourceSha256 !== sha(original) || existing.generatedSha256 !== sha(generated) || existing.prompt !== prompt) throw new Error(`Asset ${id} already recorded with different inputs; use a new versioned id`)
    if (sha(fs.readFileSync(target)) !== existing.outputSha256) throw new Error(`Recorded output changed: ${id}`)
    console.log(`Reused ${id}`)
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    const encoded = await sharp(generated).resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 88 }).toBuffer()
    fs.writeFileSync(target, encoded)
    manifest.assets.push({ id, source, output, sourceSha256: sha(original), generatedSha256: sha(generated), outputSha256: sha(encoded), prompt, status: 'reviewed' })
    save(); console.log(`Recorded ${id}`)
  }
} else if (command === 'verify') {
  for (const a of manifest.assets) {
    if (sha(fs.readFileSync(path.join(root, 'public', a.source))) !== a.sourceSha256) throw new Error(`Source changed: ${a.id}`)
    const bytes = fs.readFileSync(path.join(root, 'public', a.output))
    if (sha(bytes) !== a.outputSha256) throw new Error(`Output changed: ${a.id}`)
    if (!['webp', 'png', 'jpeg'].includes((await sharp(bytes).metadata()).format)) throw new Error(`Invalid image: ${a.id}`)
  }
  console.log(`Verified ${manifest.assets.length} reviewed assets`)
} else {
  throw new Error('Use record <id> <original-path> <generated-file> <prompt-file> or verify')
}
