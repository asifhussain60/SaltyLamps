// Is the shop database's migration log in step with d1/migrations?
//
// functions/api/webhook.js writes columns that only exist once their migration has run, so
// publishing code to a database that lacks one means a paid order is taken and then fails
// to record. deploy-live.sh pipes a read-only look at the database's own log through here
// before it backs anything up or publishes. It only reads: the planner
// (plan-production-migrations.py) is what writes the log.
//
//   wrangler d1 execute DB --remote --json --command "SELECT name, sha256, status FROM production_migration_ledger" | node scripts/migration-ledger.mjs
//
// Exit 0 ready, 1 a migration is missing or edited, 2 the input could not be read as a log
// (fail closed: a wrangler or login error must never look like "all clear").
//
// Unlike production-preflight.mjs, which belongs to the reserved production database and
// wants every file 'applied', this shop database deliberately holds one 'deferred' row
// (010-lighter-catalogue.sql, the media cutover) and that is acceptable here.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(import.meta.url)
const MIGRATIONS = path.resolve(path.dirname(HERE), '../d1/migrations')
const ACCEPTED = ['applied', 'deferred']

// Raw bytes, sha256 hex: exactly what the planner records, so a match means "unedited".
export function migrationFiles(dir = MIGRATIONS) {
  const names = fs.readdirSync(dir).filter(name => name.endsWith('.sql')).sort()
  if (!names.length) throw new Error(`no migration files in ${dir}`)
  return names.map(name => ({ name, sha256: createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex') }))
}

export function ledgerProblems(files, rows) {
  const recorded = new Map(rows.map(row => [row.name, row]))
  const problems = []
  for (const { name, sha256 } of files) {
    const row = recorded.get(name)
    if (!row) problems.push(`not applied to the shop database: ${name}`)
    else if (row.sha256 !== sha256) problems.push(`${name} was edited after it was applied`)
    else if (!ACCEPTED.includes(row.status)) problems.push(`${name} has status ${JSON.stringify(row.status)}, expected applied or deferred`)
  }
  return problems
}

// A newer release may have applied a migration this checkout does not have yet; worth
// saying, but it is not a reason to block publishing older code.
export function ledgerWarnings(files, rows) {
  const known = new Set(files.map(file => file.name))
  return rows.filter(row => !known.has(row.name)).map(row => `the database records ${row.name}, which this checkout does not have`)
}

// wrangler may print banner text before the JSON; the list starts at "[" then "{" (or "]").
export function ledgerRows(text) {
  const start = text.search(/\[\s*[{\]]/)
  if (start < 0) throw new Error('no JSON list in the input')
  const set = JSON.parse(text.slice(start))[0]
  if (!set || set.success === false || !Array.isArray(set.results) || !set.results.every(row => row && typeof row === 'object')) {
    throw new Error('wrangler returned no rows for the migration log')
  }
  return set.results
}

async function main() {
  if (process.stdin.isTTY) {
    console.error('Pipe wrangler d1 execute ... --json into this script; see the comment at the top of it.')
    process.exit(2)
  }
  let input = ''
  for await (const chunk of process.stdin) input += chunk
  let files, rows
  try {
    files = migrationFiles()
    rows = ledgerRows(input)
  } catch (error) {
    console.error(`Could not read the shop database's migration log: ${error.message}`)
    process.exit(2)
  }
  for (const warning of ledgerWarnings(files, rows)) console.log(`Note: ${warning}.`)
  const problems = ledgerProblems(files, rows)
  if (problems.length) {
    for (const problem of problems) console.error(`Migration check: ${problem}.`)
    process.exit(1)
  }
  const deferred = rows.filter(row => row.status === 'deferred' && files.some(file => file.name === row.name)).length
  console.log(`Shop database has all ${files.length} migrations${deferred ? ` (${deferred} deferred)` : ''}.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === HERE) await main()
