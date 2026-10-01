import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ledgerProblems, ledgerWarnings, migrationFiles } from '../scripts/migration-ledger.mjs'

const root = path.resolve(import.meta.dirname, '..')
const cli = path.join(root, 'scripts/migration-ledger.mjs')
const hash = n => String(n).padStart(64, '0')
const files = [1, 2, 3, 10].map(n => ({ name: `${String(n).padStart(3, '0')}-x.sql`, sha256: hash(n) }))
const row = (file, status = 'applied', sha256 = file.sha256) => ({ name: file.name, sha256, status })
const ready = () => files.map(f => row(f, f.name.startsWith('010') ? 'deferred' : 'applied'))

test('a database with every migration recorded, one deliberately deferred, is ready', () => {
  assert.deepEqual(ledgerProblems(files, ready()), [])
  assert.deepEqual(ledgerWarnings(files, ready()), [])
})

test('a migration file the database has never recorded is named', () => {
  const problems = ledgerProblems(files, ready().slice(0, 3))
  assert.equal(problems.length, 1)
  assert.match(problems[0], /not applied to the shop database: 010-x\.sql/)
})

test('a migration edited after it was applied is named', () => {
  const rows = ready()
  rows[1].sha256 = hash(999)
  const problems = ledgerProblems(files, rows)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /002-x\.sql was edited after it was applied/)
})

test('only applied and deferred are acceptable statuses', () => {
  for (const status of ['pending', 'failed', '', null]) {
    const rows = ready()
    rows[0].status = status
    const problems = ledgerProblems(files, rows)
    assert.equal(problems.length, 1, String(status))
    assert.match(problems[0], /001-x\.sql has status/)
  }
})

test('a ledger row with no migration file is a warning, never a failure', () => {
  const rows = [...ready(), { name: '099-from-a-newer-release.sql', sha256: hash(99), status: 'applied' }]
  assert.deepEqual(ledgerProblems(files, rows), [])
  assert.match(ledgerWarnings(files, rows).join('\n'), /099-from-a-newer-release\.sql/)
})

test('every problem is reported, not just the first', () => {
  const rows = ready().slice(1)
  rows[0].sha256 = hash(999)
  assert.equal(ledgerProblems(files, rows).length, 2)
})

test('the real migration files are all hashed, byte for byte, as the planner does', () => {
  const found = migrationFiles()
  const sql = fs.readdirSync(path.join(root, 'd1/migrations')).filter(n => n.endsWith('.sql'))
  assert.equal(found.length, sql.length)
  assert.deepEqual(found.map(f => f.name), [...sql].sort())
  assert.equal(found.find(f => f.name === '018-order-special-instructions.sql').sha256, 'c72ab8036660faf93910ffeb07b4ccb34433eebd702638d6e3bb12e734b0d0f2')
})

const wrangler = rows => `⛅️ wrangler 4.95.0\n-------------------\n${JSON.stringify([{ results: rows, success: true, meta: {} }], null, 2)}\n`
const run = input => spawnSync(process.execPath, [cli], { input, encoding: 'utf8' })
const realLedger = () => migrationFiles().map(f => row(f, f.name.startsWith('010') ? 'deferred' : 'applied'))

test('the command line accepts wrangler output with a banner and says the database is ready', () => {
  const out = run(wrangler(realLedger()))
  assert.equal(out.status, 0, out.stdout + out.stderr)
  assert.equal(out.stdout.trim(), `Shop database has all ${migrationFiles().length} migrations (1 deferred).`)
})

test('the command line exits 1 and names the migration the database lacks', () => {
  const out = run(wrangler(realLedger().filter(r => !r.name.startsWith('018'))))
  assert.equal(out.status, 1)
  assert.match(out.stderr, /not applied to the shop database: 018-order-special-instructions\.sql/)
})

test('the command line fails closed on anything it cannot read as a ledger', () => {
  for (const input of ['', 'not json at all', 'Error: no such table: production_migration_ledger', '[ { broken', '[]', JSON.stringify([{ success: false, results: [] }]), JSON.stringify({ error: 'x' })]) {
    const out = run(input)
    assert.equal(out.status, 2, `${input} -> ${out.stdout}${out.stderr}`)
    assert.match(out.stderr, /Could not read/)
  }
})

// The gate only protects paid orders if it runs before anything is backed up or published,
// and the picked interpreter only helps if no bare python3 slips back in beside it.
test('deploy-live.sh checks the shop database migrations before the backup and the deploy', () => {
  const script = fs.readFileSync(path.join(root, 'deploy-live.sh'), 'utf8')
  const gate = script.indexOf('| node scripts/migration-ledger.mjs')
  assert.ok(gate > 0, 'the migration gate is missing')
  assert.ok(gate > script.indexOf('6/8 Account readiness'))
  assert.ok(gate < script.indexOf('7/8 Recovery point'))
  assert.ok(gate < script.indexOf('pages deploy'))
})

test('both deploy scripts pick a Python 3.11+ and never call a bare python3', () => {
  for (const name of ['deploy-live.sh', 'deploy-staging.sh']) {
    const bare = fs.readFileSync(path.join(root, name), 'utf8').split('\n')
      .filter(line => !/^\s*#/.test(line) && !line.includes('for candidate in'))
      .filter(line => /(?<![\w./@-])python3(?![\w.])/.test(line))
    assert.deepEqual(bare, [], `${name} calls python3 directly`)
  }
})
