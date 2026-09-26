// Deliberately accepts only the simple production config used by this project.
// Ambiguous/overridden bindings fail closed instead of guessing a TOML environment.
import fs from 'node:fs'
import path from 'node:path'

// The former proposal account is retired by owner instruction. It must never
// become the production target, even with a different project or database ID.
export const RETIRED_PROPOSAL_ACCOUNT_ID = '844bc687926c910d5ad9d79c40ad1f2f'
export const RETIRED_PROPOSAL_DATABASE_ID = 'e8e40717-628d-481d-9175-e9c473620125'
export const APPROVED_OWNER_ACCOUNT_ID = 'e35d5918c507bc2cf4e920fe38b5e318'

function simpleConfig(file) {
  const sections = [{ type: 'root', values: {} }]
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('[')) {
      const section = line.match(/^\[\[(d1_databases|r2_buckets)\]\](?:\s*#.*)?$/)
      if (!section) throw new Error('Production config has unsupported sections; use explicit top-level bindings.')
      sections.push({ type: section[1], values: {} })
      continue
    }
    const key = line.match(/^(\w+)\s*=/)?.[1]
    if (!key) throw new Error('Cannot parse production config.')
    const values = sections.at(-1).values
    if (Object.hasOwn(values, key)) throw new Error(`Duplicate production config key: ${key}`)
    if (key === 'compatibility_flags') { values[key] = line; continue }
    const match = line.match(/^\w+\s*=\s*"([^"\\]*)"\s*(?:#.*)?$/)
    if (!match) throw new Error(`Production config requires a plain quoted value for ${key}.`)
    values[key] = match[1]
  }
  return sections
}

export function validateProductionTarget(env = process.env, root = process.cwd()) {
  const config = env.PROD_CONFIG === undefined ? 'wrangler.prod.toml' : env.PROD_CONFIG
  if (!config) throw new Error('Production config is required; default/proposal fallback is forbidden.')
  const configPath = path.resolve(root, config)
  if (!fs.existsSync(configPath)) throw new Error(`Missing production config: ${configPath}`)
  const defaultPath = path.join(root, 'wrangler.toml')
  if (fs.realpathSync(configPath) === fs.realpathSync(defaultPath)) throw new Error('Default/proposal config cannot target production.')
  const sections = simpleConfig(configPath)
  const values = sections[0].values
  const databases = sections.filter(s => s.type === 'd1_databases')
  const buckets = sections.filter(s => s.type === 'r2_buckets')
  if (databases.length !== 1 || databases[0].values.binding !== 'DB') throw new Error('Production config must contain exactly one DB binding.')
  if (buckets.length !== 1 || buckets[0].values.binding !== 'IMAGES') throw new Error('Production config must contain exactly one IMAGES binding.')
  const db = databases[0].values
  const bucket = buckets[0].values
  const proposal = simpleConfig(defaultPath)
  const proposalId = proposal.find(s => s.type === 'd1_databases')?.values.database_id
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(db.database_id || '') || db.database_id === proposalId || db.database_id.toLowerCase() === RETIRED_PROPOSAL_DATABASE_ID) throw new Error('Production database ID must be real and different from retired proposal.')
  if (!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID || '')) throw new Error('Explicit production account ID is required.')
  if (env.CLOUDFLARE_ACCOUNT_ID.toLowerCase() === RETIRED_PROPOSAL_ACCOUNT_ID) throw new Error('Retired proposal account is forbidden as a production target.')
  if (env.CLOUDFLARE_ACCOUNT_ID.toLowerCase() !== APPROVED_OWNER_ACCOUNT_ID) throw new Error('Production target must be the verified Salty Lamps owner account.')
  if (values.account_id && values.account_id !== env.CLOUDFLARE_ACCOUNT_ID) throw new Error('Production account ID does not match config.')
  if (!env.CLOUDFLARE_API_TOKEN) throw new Error('Explicit production API token is required; interactive/proposal credentials are forbidden.')
  if (values.name !== (env.PROD_PROJECT || 'salty-lamps') || /proposal/i.test(values.name)) throw new Error('Production project does not match config or is a proposal.')
  if (db.database_name !== (env.PROD_DB_NAME || 'salty-lamps-db')) throw new Error('Production database name does not match config.')
  if (bucket.bucket_name !== (env.PROD_BUCKET || 'salty-lamps-images')) throw new Error('Production image bucket does not match config.')
  if (env.CLOUDFLARE_D1_DATABASE_ID && env.CLOUDFLARE_D1_DATABASE_ID !== db.database_id) throw new Error('Snapshot database override does not match production config.')
  if (env.CLOUDFLARE_D1_TOKEN && env.CLOUDFLARE_D1_TOKEN !== env.CLOUDFLARE_API_TOKEN) throw new Error('Production snapshot must use the same API token as deployment.')
  return { configPath, accountId: env.CLOUDFLARE_ACCOUNT_ID, databaseId: db.database_id, project: values.name, databaseName: db.database_name, bucket: bucket.bucket_name }
}
