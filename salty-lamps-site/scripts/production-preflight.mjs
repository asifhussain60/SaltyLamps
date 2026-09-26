// Read-only production gate. No table creation, schema adoption or data replay.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { validateProductionTarget } from './production-target.mjs'

export function validateMigrationLedger(rows, root) {
  const migrations = path.join(root, 'd1/migrations')
  const files = fs.readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()
  const records = new Map(rows.map(row => [row.name, row]))
  if (records.size !== rows.length || rows.some(row => !files.includes(row.name))) throw new Error('Migration ledger is ambiguous or belongs to another application version.')
  for (const name of files) {
    const row = records.get(name)
    if (!row || row.status !== 'applied') throw new Error(`Migration requires reviewed reconciliation: ${name}. Run the offline migration planner; do not replay historical migrations.`)
    const expected = createHash('sha256').update(fs.readFileSync(path.join(migrations, name))).digest('hex')
    if (row.sha256 !== expected) throw new Error(`Migration hash mismatch: ${name}. Historical files must not be rewritten.`)
  }
}

export async function preflight(env = process.env, root = path.resolve(import.meta.dirname, '..'), fetcher = fetch) {
  const target = validateProductionTarget(env, root)
  const request = async (resource, options = {}) => {
    const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${target.accountId}/${resource}`, {
      ...options,
      headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    })
    const body = await response.json()
    if (!response.ok || !body.success) throw new Error(`Production access or resource verification failed for ${resource}: ${JSON.stringify(body.errors || [])}`)
    return body.result
  }
  const sets = await request(`d1/database/${target.databaseId}/query`, {
    method: 'POST',
    body: JSON.stringify({ sql: 'SELECT name,sha256,status FROM production_migration_ledger; SELECT COUNT(*) AS n FROM products; PRAGMA foreign_key_check;' }),
  })
  if (!Array.isArray(sets) || sets.length !== 3 || sets.some(set => set.success === false || !Array.isArray(set.results))) throw new Error('Production database preflight returned incomplete results; stopping.')
  validateMigrationLedger(sets[0].results, root)
  const count = sets[1].results[0]?.n
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Production catalog is missing or unreadable. No automatic seed is permitted.')
  if (sets[2].results.length) throw new Error('Production database has foreign-key violations; reconcile before deployment.')
  const project = await request(`pages/projects/${encodeURIComponent(target.project)}`)
  const config = project?.deployment_configs?.production
  if (config?.d1_databases?.DB?.id !== target.databaseId || config?.r2_buckets?.IMAGES?.name !== target.bucket) throw new Error('Production Pages bindings do not match the selected database/bucket; provision and verify them first.')
  const vars = config?.env_vars || {}
  if (vars.ADMIN_OPEN_HOSTS?.value || vars.ADMIN_OPEN_HOSTS?.type === 'secret_text') throw new Error('Production must not have an open-admin hostname bypass.')
  if ([true, 1, '1', 'true'].includes(vars.DEV_ADMIN_BYPASS?.value) || vars.DEV_ADMIN_BYPASS?.type === 'secret_text') throw new Error('Production must not have a development admin bypass.')
  const required = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PUBLISHABLE_KEY', 'RESEND_API_KEY', 'ACCESS_AUD', 'ACCESS_TEAM_DOMAIN']
  const missing = required.filter(name => !Object.hasOwn(vars, name))
  if (missing.length) throw new Error(`Production configuration names missing: ${missing.join(', ')}. Presence does not prove credential validity.`)
  const site = new URL(env.PROD_SITE_URL || 'https://www.saltylamps.co.uk')
  const adminHost = env.PROD_ADMIN_HOST || ''
  if (site.protocol !== 'https:' || site.pathname !== '/' || site.search || site.hash || site.port || site.username || site.password || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/i.test(adminHost) || adminHost.toLowerCase() === site.hostname) throw new Error('Explicit production HTTPS site and separate PROD_ADMIN_HOST are required.')
  const expected = { SITE_URL: site.origin, PUBLIC_HOST: site.hostname, ADMIN_HOSTS: adminHost.toLowerCase() }
  for (const [name, value] of Object.entries(expected)) {
    if (vars[name]?.type !== 'plain_text' || vars[name]?.value !== value) throw new Error(`Production ${name} must be an explicit nonsecret value matching the selected host.`)
  }
  await request(`r2/buckets/${encodeURIComponent(target.bucket)}`)
  return target
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await preflight()
    console.log('Read-only production preflight passed: target, migration hashes, catalog, foreign keys and resource bindings verified. Write permissions and payment/email credentials still require launch rehearsal.')
  } catch (error) {
    console.error(`Production preflight stopped: ${error.message}`)
    process.exitCode = 1
  }
}
