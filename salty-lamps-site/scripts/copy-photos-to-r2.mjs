// Copies the photos stored in the test shop's database into the R2 bucket, under the SAME
// keys, so no product image address changes when the shop goes live.
//
// Why it exists: the test shop keeps uploaded photos in temporary database tables that work
// only while the sandbox switches are set. Removing them for launch (deploy-live.sh) makes
// every /api/images address return 503 until the photos are in R2.
//
// SAFETY
//   - Reads the database with two fixed SELECT statements (checked by read-only-sql.mjs).
//     It never writes to, or deletes from, the database.
//   - Writes only to the bucket salty-lamps-images, only keys that start products/, and never
//     deletes or overwrites: an object already in the bucket with identical bytes is skipped,
//     one with different bytes stops the run.
//   - Every photo is rebuilt and checked against the checksum the shop stored at upload, then
//     read back from R2 and checked again after it is written.
//
// USAGE (from salty-lamps-site, logged in with `npx wrangler login` as the owner)
//   node scripts/copy-photos-to-r2.mjs                # dry run: read and verify, write nothing
//   node scripts/copy-photos-to-r2.mjs --write        # copy, then verify each photo in R2
//   node scripts/copy-photos-to-r2.mjs --local-dir D  # rehearse on a disposable local copy in D
//                                                      (combine with --write)
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SQL_CHUNKS, SQL_OBJECTS, assertSafeKey, reassemble, sha256 } from './photo-copy-lib.mjs'
import { assertReadOnlySql, resultSetsFromWrangler } from './read-only-sql.mjs'
import { APPROVED_OWNER_ACCOUNT_ID } from './production-target.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUCKET = 'salty-lamps-images'
const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const localDir = args.includes('--local-dir') ? args[args.indexOf('--local-dir') + 1] : ''
if (args.includes('--local-dir') && !localDir) throw new Error('--local-dir needs a folder.')
if (!localDir && process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID.toLowerCase() !== APPROVED_OWNER_ACCOUNT_ID) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID is not the approved owner account.')
}

const wrangler = path.join(root, 'node_modules/.bin/wrangler')
const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: APPROVED_OWNER_ACCOUNT_ID, WRANGLER_SEND_METRICS: 'false' }
const cwd = localDir || root
const dbTarget = localDir ? ['--local', '--persist-to', path.join(localDir, 'state')] : ['--remote', '-c', 'wrangler.staging.toml']
const r2Target = localDir ? ['--local', '--persist-to', path.join(localDir, 'state')] : ['--remote']

const run = (argv, options = {}) => execFileSync(wrangler, argv, {
  cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024, timeout: 180000, ...options,
})
const clean = text => String(text).replace(/\x1b\[[0-9;]*m/g, '')

function readRows(sql) {
  assertReadOnlySql([sql])
  const out = run(['d1', 'execute', 'DB', ...dbTarget, '--json', '--command', sql])
  const start = out.search(/^\[\s*$/m)
  if (start < 0) throw new Error('wrangler returned no result list.')
  return resultSetsFromWrangler(out.slice(start), 1)[0]
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'salty-photo-copy-'))
fs.chmodSync(tmp, 0o700)
const report = []
try {
  console.log(`Reading photos from ${localDir ? `the local copy in ${localDir}` : 'the test shop database'} (read-only)...`)
  const objects = readRows(SQL_OBJECTS)
  const chunks = readRows(SQL_CHUNKS)
  console.log(`${objects.length} photos, ${chunks.length} data chunks.`)

  const photos = objects.map(object => {
    assertSafeKey(object.key)
    return reassemble(object, chunks)   // throws unless whole and matching its stored checksum
  })
  const totalBytes = photos.reduce((sum, photo) => sum + photo.bytes.length, 0)
  console.log(`All ${photos.length} photos rebuilt and verified against their stored checksums (${(totalBytes / 1048576).toFixed(2)} MB).`)

  for (const photo of photos) {
    const row = { key: photo.key, size: photo.bytes.length, result: '' }
    report.push(row)
    if (!WRITE) { row.result = 'would copy'; continue }

    const source = path.join(tmp, 'source')
    const readback = path.join(tmp, 'readback')
    fs.writeFileSync(source, photo.bytes)
    const target = `${BUCKET}/${photo.key}`

    let exists = false
    try {
      run(['r2', 'object', 'get', target, '--file', readback, ...r2Target])
      exists = true
    } catch (err) {
      if (!/does not exist|not found|10007|NoSuchKey/i.test(clean(err.stderr || err.stdout || err.message))) {
        throw new Error(`${photo.key}: could not check the bucket: ${clean(err.stderr || err.message).split('\n').filter(Boolean).slice(-2).join(' | ')}`)
      }
    }
    if (exists) {
      if (sha256(fs.readFileSync(readback)) !== photo.digest) throw new Error(`${photo.key}: the bucket already holds DIFFERENT bytes under this key; stopping, nothing was overwritten.`)
      row.result = 'already in R2, identical'
      fs.rmSync(readback, { force: true })
      continue
    }

    run(['r2', 'object', 'put', target, '--file', source, '--content-type', photo.contentType, ...r2Target])
    run(['r2', 'object', 'get', target, '--file', readback, ...r2Target])
    if (sha256(fs.readFileSync(readback)) !== photo.digest) throw new Error(`${photo.key}: the copy in R2 does not match the original.`)
    row.result = 'copied and verified'
    fs.rmSync(readback, { force: true })
  }
} catch (err) {
  fs.rmSync(tmp, { recursive: true, force: true })
  const reason = clean(err.stdout && /"text"/.test(err.stdout) ? err.stdout.match(/"text": "([^"]+)"/)?.[1] || '' : '') || clean(err.stderr || '') || err.message
  console.error(`\nSTOPPED: ${reason.split('\n').filter(Boolean).slice(-3).join(' | ')}`)
  console.error(`Photos written before the stop: ${report.filter(row => /copied/.test(row.result)).length}. Nothing was deleted or overwritten; rerunning is safe.`)
  process.exit(1)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}

console.log('')
for (const row of report) console.log(`  ${row.result.padEnd(26)} ${String(row.size).padStart(9)} B  ${row.key}`)
const failed = report.filter(row => !/copied and verified|identical|would copy/.test(row.result))
console.log(`\n${WRITE ? 'Copy finished' : 'Dry run finished (nothing written)'}: ${report.length} photos, ${failed.length} problems.`)
if (failed.length) process.exit(1)
