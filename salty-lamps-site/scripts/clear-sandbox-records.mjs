// Clears the sandbox (Stripe test-mode) orders and their leftovers from the shop database
// before launch, and nothing else. The rules live in clear-sandbox-lib.mjs and are tested
// against a real SQLite database; see its header for exactly what goes and what is kept.
//
//   node scripts/clear-sandbox-records.mjs                     # DRY RUN: counts, stock report, deletes nothing
//   node scripts/clear-sandbox-records.mjs --apply             # saves a recovery point, asks you to type the
//                                                              # count, deletes in one all-or-nothing batch,
//                                                              # then recounts
//   --before "2026-10-01 12:00:00"   UTC cutoff for leftovers that have no order (test-send emails,
//                                    attempts with no session). Default: now.
//   --include-enquiries              also remove contact enquiries older than the cutoff (confirm they are tests)
//   --include-save-requests          also remove admin repeat-protection keys (kept by default)
//   --local-dir D                    rehearse on a disposable local copy in D instead of the shop database
//
// Safe to run after launch too: only cs_test_ orders match, so a live order is never touched.
// Run it yourself after `npx wrangler login` as the owner, at the freeze. It is only ever run on
// the real database with the owner's explicit go-ahead in chat at launch.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { PROTECTED_TABLES, STOCK_IMPACT_SQL, assertCutoff, assertDeleteOnly, deleteStatements, summarySql, targets } from './clear-sandbox-lib.mjs'
import { APPROVED_OWNER_ACCOUNT_ID } from './production-target.mjs'
import { assertReadOnlySql, resultSetsFromWrangler } from './read-only-sql.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = name => args.includes(name)
const value = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const APPLY = flag('--apply')
const localDir = value('--local-dir')
if (flag('--local-dir') && !localDir) throw new Error('--local-dir needs a folder.')
const cutoff = assertCutoff(value('--before') || new Date().toISOString().slice(0, 19).replace('T', ' '))
const options = { cutoff, includeEnquiries: flag('--include-enquiries'), includeSaveRequests: flag('--include-save-requests') }
if (!localDir && process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID.toLowerCase() !== APPROVED_OWNER_ACCOUNT_ID) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID is not the approved owner account.')
}

const wrangler = path.join(root, 'node_modules/.bin/wrangler')
const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: APPROVED_OWNER_ACCOUNT_ID, WRANGLER_SEND_METRICS: 'false' }
const cwd = localDir || root
const target = localDir ? ['--local', '--persist-to', path.join(localDir, 'state')] : ['--remote', '-c', 'wrangler.staging.toml']
const clean = text => String(text).replace(/\x1b\[[0-9;]*m/g, '')
const run = argv => execFileSync(wrangler, argv, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024, timeout: 180000 })

function rows(sql) {
  assertReadOnlySql([sql])
  // The first remote call after a pause sometimes fails and an immediate repeat works; reads are
  // harmless to repeat, so they get one retry. Writes and the export never do.
  let out
  try { out = run(['d1', 'execute', 'DB', ...target, '--json', '--command', sql]) } catch {
    execFileSync('sleep', ['3'])
    out = run(['d1', 'execute', 'DB', ...target, '--json', '--command', sql])
  }
  const start = out.search(/^\[\s*$/m)
  if (start < 0) throw new Error('wrangler returned no result list.')
  return resultSetsFromWrangler(out.slice(start), 1)[0]
}

function stop(message) {
  console.error(`\nSTOPPED: ${message}`)
  process.exit(1)
}

try {
  console.log(`Reading ${localDir ? `the local copy in ${localDir}` : 'the shop database'} (read-only). Cutoff for leftovers with no order: ${cutoff} UTC.\n`)
  const before = rows(summarySql(options))[0]
  const deletions = targets(options).map(t => ({ table: t.table, n: before[`del_${t.table}`] }))

  if (before.unknown_orders > 0) stop(`${before.unknown_orders} order(s) are neither cs_test_ nor cs_live_; the rule cannot tell whether they are real. Nothing was changed.`)

  console.log(`Real (live) orders present: ${before.live_orders}  (never touched)`)
  console.log('Would delete:')
  for (const { table, n } of deletions) console.log(`  ${String(n).padStart(6)}  ${table}`)
  const testOrders = deletions.find(d => d.table === 'orders').n
  console.log(`\nKept untouched: ${PROTECTED_TABLES.map(t => `${t} ${before[`keep_${t}`]}`).join(', ')}`)

  const stock = rows(STOCK_IMPACT_SQL)
  console.log('\nStock the test orders consumed, per option (this script never edits stock; confirm opening counts in the administrator):')
  if (!stock.length) console.log('  none')
  for (const row of stock) console.log(`  ${String(row.sku).padEnd(14)} now ${String(row.stock_now ?? '-').padStart(4)}   in paid test orders ${row.in_paid_test_orders}   in refunded/cancelled ${row.in_refunded_test_orders}   ${row.product}`)

  if (!APPLY) {
    console.log('\nDry run: nothing was changed. To delete, re-run with --apply (you will be asked to type the number of test orders).')
    process.exit(0)
  }
  if (deletions.every(d => d.n === 0)) stop('there is nothing to delete.')

  // Recovery point first: a full export plus a Time Travel bookmark, outside the repository.
  const work = path.join(process.env.CLEAR_WORK_DIR || path.join(os.homedir(), 'salty-lamps-private'), `clear-sandbox-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`)
  fs.mkdirSync(work, { recursive: true, mode: 0o700 })
  if (localDir) {
    console.log('\nRehearsal copy: recovery point skipped.')
  } else {
    run(['d1', 'export', 'DB', '--remote', '-c', 'wrangler.staging.toml', '--output', path.join(work, 'before-clear.sql')])
    fs.writeFileSync(path.join(work, 'time-travel-before.json'), run(['d1', 'time-travel', 'info', 'DB', '-c', 'wrangler.staging.toml', '--json']))
    console.log(`\nRecovery point saved in ${work}. To roll back: wrangler d1 time-travel restore DB --bookmark=<value in time-travel-before.json>`)
  }

  const phrase = `delete ${testOrders} test orders`
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const reply = await rl.question(`\nThis permanently deletes the rows listed above from the ${localDir ? 'rehearsal copy' : 'SHOP DATABASE'} in one all-or-nothing batch.\nType "${phrase}" to continue: `)
  rl.close()
  if (reply.trim() !== phrase) stop('declined; nothing was changed.')

  const statements = assertDeleteOnly(deleteStatements(options), options)
  const file = path.join(work, 'clear-sandbox.sql')
  fs.writeFileSync(file, `${statements.join(';\n')};\n`)
  run(['d1', 'execute', 'DB', ...target, '--file', file])

  const after = rows(summarySql(options))[0]
  const leftovers = targets(options).filter(t => after[`del_${t.table}`] !== 0).map(t => `${t.table} ${after[`del_${t.table}`]}`)
  const changedKeep = PROTECTED_TABLES.filter(t => after[`keep_${t}`] !== before[`keep_${t}`])
  console.log('\nAfter:')
  console.log(`  test orders remaining: ${after.del_orders}   live orders: ${after.live_orders}`)
  console.log(`  protected tables unchanged: ${changedKeep.length === 0 ? 'yes' : `NO: ${changedKeep.join(', ')}`}`)
  if (leftovers.length || changedKeep.length) stop(`the recount does not match (${[...leftovers, ...changedKeep].join(', ')}). Use the recovery point in ${work} and investigate.`)
  console.log('\nDone. Next: confirm opening stock for every option in the administrator, using the stock report above.')
} catch (err) {
  const reason = clean((err.stdout && err.stdout.match(/"text": "([^"]+)"/)?.[1]) || err.stderr || err.message).split('\n').filter(Boolean).slice(-3).join(' | ')
  stop(reason)
}
