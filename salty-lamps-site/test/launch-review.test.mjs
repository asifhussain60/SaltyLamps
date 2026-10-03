import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { webcrypto } from 'node:crypto'
import { onRequestGet, onRequestPut } from '../functions/api/admin/launch-review.js'
import { LAUNCH_CHECKS, REVIEW_SLOTS, REVIEW_KEY, REPORT_PREFIX, validateReviewInput, reviewCounts, reviewText } from '../functions/lib/launch-review.mjs'
globalThis.crypto ??= webcrypto
const sqlite = `import sqlite3,json,sys
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row
out=[]
with c:
 for s in json.load(sys.stdin):
  q=c.execute(s['sql'],s.get('args',[]))
  rows=[dict(r) for r in q.fetchall()] if q.description else []
  out.append({'results':rows,'meta':{'changes':max(q.rowcount,0)}})
print(json.dumps(out))`
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'salty-launch-review-')); t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'review.sqlite')
  const execute = statements => JSON.parse(execFileSync('python3', ['-c', sqlite, file], { input: JSON.stringify(statements), encoding: 'utf8' }))
  execute([{ sql: "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, value_type TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))" }, { sql: "INSERT INTO settings(key,value,value_type) VALUES ('email_enabled','1','bool')" }])
  const db = { prepare(sql) { return { sql, args: [], bind(...args) { this.args = args; return this }, async first() { return execute([this])[0].results[0] || null }, async all() { return execute([this])[0] } } }, async batch(statements) { return execute(statements) } }
  return { db, execute }
}
const body = (revision = 0, action = 'save') => ({ revision, action, entries: { 'computer:home': { result: 'pass', comment: 'Looks good.' }, 'shared:pay': { result: 'blocked', comment: 'Waiting for agreed test.' } }, overall: 'Phone review still to do.' })
const context = (db, input, origin = 'https://admin.saltylamps.co.uk') => ({ env: { DB: db }, data: { actorEmail: 'asifhussain60@gmail.com' }, request: new Request('https://admin.saltylamps.co.uk/api/admin/launch-review', input ? { method: 'PUT', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(input) } : {}) })
test('instructions distinguish device checks and coordinated real-money checks', () => {
  assert.equal(new Set(REVIEW_SLOTS).size, REVIEW_SLOTS.length)
  assert.ok(LAUNCH_CHECKS.filter(c => c.coordinated).every(c => c.scope === 'shared'))
  assert.equal(reviewCounts().pending, REVIEW_SLOTS.length)
  assert.match(reviewText(body()), /Not tested/)
})
test('invalid slot, result and oversized comment never enter the review', () => {
  for (const entries of [{ 'shared:invented': { result: 'pass', comment: '' } }, { 'computer:home': { result: 'passed', comment: '' } }, { 'computer:home': { result: 'pass', comment: 'x'.repeat(1501) } }]) assert.ok(validateReviewInput({ ...body(), entries }).error)
  assert.ok(validateReviewInput({ ...body(0, 'submit'), entries: {}, overall: '' }).error)
})
test('opening a new checklist is read-only and does not expose other settings', async t => {
  const { db, execute } = fixture(t)
  const res = await onRequestGet(context(db)); const data = await res.json()
  assert.equal(res.status, 200); assert.match(res.headers.get('cache-control'), /no-store/)
  assert.equal(data.document.revision, 0); assert.deepEqual(data.reports, [])
  assert.equal(execute([{ sql: 'SELECT count(*) AS n FROM settings' }])[0].results[0].n, 1)
  assert.doesNotMatch(JSON.stringify(data), /email_enabled/)
})
test('answers persist across fresh reads and stale devices cannot overwrite them', async t => {
  const { db } = fixture(t)
  const first = await onRequestPut(context(db, body())); assert.equal(first.status, 200)
  const read = await (await onRequestGet(context(db))).json()
  assert.equal(read.document.entries['computer:home'].comment, 'Looks good.')
  assert.equal(read.document.updatedBy, 'asifhussain60@gmail.com')
  const stale = await onRequestPut(context(db, { ...body(), entries: {} })); assert.equal(stale.status, 409)
  assert.equal((await (await onRequestGet(context(db))).json()).document.entries['computer:home'].result, 'pass')
})
test('submissions retain their snapshot while the draft changes; review response is shared', async t => {
  const { db, execute } = fixture(t)
  const submitted = await (await onRequestPut(context(db, body(0, 'submit')))).json()
  assert.equal(submitted.report.counts.pass, 1); assert.equal(submitted.report.counts.blocked, 1)
  const changed = { ...body(1), entries: { 'computer:home': { result: 'issue', comment: '<script>literal text</script>' } } }
  assert.equal((await onRequestPut(context(db, changed))).status, 200)
  const reports = (await (await onRequestGet(context(db))).json()).reports
  assert.equal(reports[0].document.entries['computer:home'].result, 'pass')
  const response = await onRequestPut(context(db, { ...changed, revision: 2, action: 'review', reportId: submitted.report.id, reviewNote: 'Please test the phone layout next.' }))
  assert.equal(response.status, 200)
  const final = await (await onRequestGet(context(db))).json()
  assert.equal(final.reports[0].review.note, 'Please test the phone layout next.')
  assert.equal(final.document.entries['computer:home'].result, 'issue')
  assert.equal(execute([{ sql: "SELECT value FROM settings WHERE key = 'email_enabled'" }])[0].results[0].value, '1')
})
test('cross-origin writes are denied and rejected submissions leave no report', async t => {
  const { db, execute } = fixture(t)
  assert.equal((await onRequestPut(context(db, body(), 'https://unrelated.example'))).status, 403)
  await onRequestPut(context(db, body()))
  assert.equal((await onRequestPut(context(db, body(0, 'submit')))).status, 409)
  assert.equal(execute([{ sql: 'SELECT count(*) AS n FROM settings WHERE key GLOB ?', args: [REPORT_PREFIX + '*'] }])[0].results[0].n, 0)
  assert.equal(execute([{ sql: 'SELECT count(*) AS n FROM settings WHERE key = ?', args: [REVIEW_KEY] }])[0].results[0].n, 1)
})
