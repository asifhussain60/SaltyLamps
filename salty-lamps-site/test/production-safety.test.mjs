import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { preflight, validateMigrationLedger } from '../scripts/production-preflight.mjs'
import { APPROVED_OWNER_ACCOUNT_ID, RETIRED_PROPOSAL_ACCOUNT_ID, RETIRED_PROPOSAL_DATABASE_ID, validateProductionTarget } from '../scripts/production-target.mjs'

const root = path.resolve(import.meta.dirname, '..')
const fixture = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salty-production-'))
  const config = path.join(dir, 'production.toml')
  fs.writeFileSync(config, 'name = "owner-shop"\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "owner-db"\ndatabase_id = "11111111-1111-4111-8111-111111111111"\n[[r2_buckets]]\nbinding = "IMAGES"\nbucket_name = "owner-images"\n')
  return { dir, config }
}
const envFor = config => ({ PROD_ADMIN_HOST: 'admin.saltylamps.co.uk', PROD_CONFIG: config, PROD_PROJECT: 'owner-shop', PROD_DB_NAME: 'owner-db', PROD_BUCKET: 'owner-images', CLOUDFLARE_ACCOUNT_ID: APPROVED_OWNER_ACCOUNT_ID, CLOUDFLARE_API_TOKEN: 'test-token' })

test('production target requires explicit account and rejects proposal/default/placeholder config', () => {
  const { dir, config } = fixture()
  try {
    const env = envFor(config)
    assert.equal(validateProductionTarget(env, root).databaseId, '11111111-1111-4111-8111-111111111111')
    assert.throws(() => validateProductionTarget({ ...env, CLOUDFLARE_ACCOUNT_ID: '' }, root), /account/i)
    assert.throws(() => validateProductionTarget({ ...env, CLOUDFLARE_ACCOUNT_ID: RETIRED_PROPOSAL_ACCOUNT_ID }, root), /retired proposal account/i)
    assert.throws(() => validateProductionTarget({ ...env, CLOUDFLARE_ACCOUNT_ID: '1'.repeat(32) }, root), /verified Salty Lamps owner account/i)
    fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace('11111111-1111-4111-8111-111111111111', RETIRED_PROPOSAL_DATABASE_ID))
    assert.throws(() => validateProductionTarget(env, root), /retired proposal/i)
    fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace(RETIRED_PROPOSAL_DATABASE_ID, '11111111-1111-4111-8111-111111111111'))
    assert.throws(() => validateProductionTarget({ ...env, PROD_CONFIG: '' }, root), /config/i)
    assert.throws(() => validateProductionTarget({ ...env, PROD_CONFIG: path.join(root, 'wrangler.toml') }, root), /proposal|default/i)
    fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace('11111111-1111-4111-8111-111111111111', 'REPLACE_WITH_PRODUCTION_DATABASE_ID'))
    assert.throws(() => validateProductionTarget(env, root), /database/i)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('ordinary local snapshot does not contact the retired proposal account', () => {
  const run = spawnSync(process.execPath, ['scripts/fetch-content-snapshot.mjs'], {
    cwd: root,
    env: { ...process.env, CONTENT_SNAPSHOT_PRODUCTION: '0', CONTENT_SNAPSHOT_SOURCE: '' },
    encoding: 'utf8',
  })
  assert.equal(run.status, 0, run.stdout + run.stderr)
  assert.match(run.stdout, /committed snapshot/)
})

test('explicit live snapshots reject the retired account and database before any request', () => {
  for (const forbidden of [
    { CLOUDFLARE_ACCOUNT_ID: RETIRED_PROPOSAL_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID: '11111111-1111-4111-8111-111111111111' },
    { CLOUDFLARE_ACCOUNT_ID: '1'.repeat(32), CLOUDFLARE_D1_DATABASE_ID: RETIRED_PROPOSAL_DATABASE_ID },
  ]) {
    const run = spawnSync(process.execPath, ['scripts/fetch-content-snapshot.mjs'], {
      cwd: root,
      env: { ...process.env, ...forbidden, CLOUDFLARE_D1_TOKEN: 'fixture-token', CONTENT_SNAPSHOT_PRODUCTION: '0', CONTENT_SNAPSHOT_SOURCE: 'live' },
      encoding: 'utf8',
    })
    assert.notEqual(run.status, 0)
    assert.match(run.stderr, /retired proposal.*forbidden/i)
  }
})

test('development cannot query any remote Cloudflare account by default or explicit live source', () => {
  const run = spawnSync(process.execPath, ['scripts/fetch-content-snapshot.mjs'], {
    cwd: root,
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: '1'.repeat(32), CLOUDFLARE_D1_DATABASE_ID: '11111111-1111-4111-8111-111111111111', CLOUDFLARE_D1_TOKEN: 'fixture-token', CONTENT_SNAPSHOT_PRODUCTION: '0', CONTENT_SNAPSHOT_SOURCE: 'live' },
    encoding: 'utf8',
  })
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /reviewed Salty Lamps owner-account production target/i)
})

test('production snapshot never accepts committed or local fallback', () => {
  for (const source of ['committed', 'local']) {
    const run = spawnSync(process.execPath, ['scripts/fetch-content-snapshot.mjs'], { cwd: root, env: { ...process.env, CONTENT_SNAPSHOT_PRODUCTION: '1', CONTENT_SNAPSHOT_SOURCE: source }, encoding: 'utf8' })
    assert.notEqual(run.status, 0, run.stdout)
    assert.match(run.stderr, /production.*live/i)
  }
})

test('production deployment fails before CLI writes if target guard fails', () => {
  const run = spawnSync('bash', ['deploy-production.sh'], { cwd: root, env: { ...process.env, PROD_CONFIG: '', CLOUDFLARE_ACCOUNT_ID: '', CLOUDFLARE_API_TOKEN: '' }, encoding: 'utf8' })
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /config|account/i)
})

test('retired double-click deployment shortcut stops before login or upload', () => {
  const run = spawnSync('bash', ['cloudflare-deploy.command'], { cwd: root, encoding: 'utf8' })
  assert.equal(run.status, 1)
  assert.match(run.stderr, /retired proposal deploy shortcut is disabled/i)
  assert.equal(run.stdout, '')
})

test('offline migration planner covers fresh, partial, rerun and seed refusal', () => {
  const run = spawnSync('python3', ['scripts/plan-production-migrations.py', '--self-test'], { cwd: root, encoding: 'utf8' })
  assert.equal(run.status, 0, run.stdout + run.stderr)
  assert.match(run.stdout, /All migration safety checks passed/)
})

const productionVars = () => Object.fromEntries([
  ...['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PUBLISHABLE_KEY', 'RESEND_API_KEY', 'ACCESS_AUD', 'ACCESS_TEAM_DOMAIN'].map(name => [name, { type: 'secret_text' }]),
  ...Object.entries({ SITE_URL: 'https://www.saltylamps.co.uk', PUBLIC_HOST: 'www.saltylamps.co.uk', ADMIN_HOSTS: 'admin.saltylamps.co.uk' }).map(([name, value]) => [name, { type: 'plain_text', value }]),
])

const currentLedger = () => fs.readdirSync(path.join(root, 'd1/migrations')).filter(name => name.endsWith('.sql')).map(name => ({ name, status: 'applied', sha256: createHash('sha256').update(fs.readFileSync(path.join(root, 'd1/migrations', name))).digest('hex') }))

test('preflight requires every applied migration hash and refuses pending/adopted/changed histories', () => {
  const rows = currentLedger()
  assert.doesNotThrow(() => validateMigrationLedger(rows, root))
  assert.throws(() => validateMigrationLedger(rows.slice(1), root), /reconciliation/)
  assert.throws(() => validateMigrationLedger(rows.map((r, i) => i === 0 ? { ...r, status: 'deferred' } : r), root), /reconciliation/)
  assert.throws(() => validateMigrationLedger(rows.map((r, i) => i === 0 ? { ...r, sha256: 'changed' } : r), root), /hash mismatch/)
})

test('preflight fails closed for query failure, empty catalog and wrong Pages binding', async () => {
  const { dir, config } = fixture()
  try {
    const env = envFor(config)
    let requests = 0
    const failQuery = async () => { requests++; throw new Error('query unavailable') }
    await assert.rejects(preflight(env, root, failQuery), /query unavailable/)
    assert.equal(requests, 1)
    for (const scenario of ['empty', 'binding', 'missing-secret', 'bypass', 'hidden-bypass', 'wrong-host', 'ok']) {
      const mock = async (url, options) => {
        assert.equal(options.headers.authorization, 'Bearer test-token')
        assert.ok(url.includes('/accounts/' + APPROVED_OWNER_ACCOUNT_ID + '/'))
        let result
        if (url.endsWith('/query')) {
          assert.match(JSON.parse(options.body).sql, /^SELECT/)
          result = [{ results: currentLedger() }, { results: [{ n: scenario === 'empty' ? 0 : 1 }] }, { results: [] }]
        } else if (url.includes('/pages/')) result = { deployment_configs: { production: { d1_databases: { DB: { id: scenario === 'binding' ? 'wrong-id' : '11111111-1111-4111-8111-111111111111' } }, r2_buckets: { IMAGES: { name: 'owner-images' } }, env_vars: productionVars() } } }
        else result = { name: 'owner-images' }
        const vars = result?.deployment_configs?.production?.env_vars
        if (vars && scenario === 'missing-secret') delete vars.STRIPE_WEBHOOK_SECRET
        if (vars && scenario === 'bypass') vars.DEV_ADMIN_BYPASS = { type: 'plain_text', value: 'true' }
        if (vars && scenario === 'hidden-bypass') vars.DEV_ADMIN_BYPASS = { type: 'secret_text' }
        if (vars && scenario === 'wrong-host') vars.PUBLIC_HOST.value = 'proposal.pages.dev'
        return { ok: true, json: async () => ({ success: true, result }) }
      }
      if (scenario === 'ok') assert.equal((await preflight(env, root, mock)).project, 'owner-shop')
      else await assert.rejects(preflight(env, root, mock), ({ empty: /catalog/, binding: /bindings/, 'missing-secret': /names missing/, bypass: /bypass/, 'hidden-bypass': /bypass/, 'wrong-host': /PUBLIC_HOST/ })[scenario])
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('failed production live snapshot uses selected production credentials and preserves committed data', () => {
  const { dir, config } = fixture()
  const snapshot = path.join(root, 'src/content/content-snapshot.json')
  const original = fs.readFileSync(snapshot, 'utf8')
  try {
    const mock = path.join(dir, 'mock-fetch.mjs')
    fs.writeFileSync(mock, `import assert from 'node:assert/strict';
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://api.cloudflare.com/client/v4/accounts/${APPROVED_OWNER_ACCOUNT_ID}/d1/database/11111111-1111-4111-8111-111111111111/query');
  assert.equal(options.headers.authorization, 'Bearer test-token');
  console.log('Selected production target confirmed');
  throw new Error('simulated unavailable database');
};`)
    const run = spawnSync(process.execPath, ['--import', mock, 'scripts/fetch-content-snapshot.mjs'], { cwd: root, env: { ...process.env, ...envFor(config), CLOUDFLARE_D1_TOKEN: '', CLOUDFLARE_D1_DATABASE_ID: '', CONTENT_SNAPSHOT_PRODUCTION: '1', CONTENT_SNAPSHOT_SOURCE: 'live' }, encoding: 'utf8' })
    assert.notEqual(run.status, 0)
    assert.match(run.stdout, /Selected production target confirmed/)
    assert.match(run.stderr, /refusing stale\/proposal fallback/)
    assert.equal(fs.readFileSync(snapshot, 'utf8'), original)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
