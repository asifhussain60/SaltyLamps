import {
  json,
  apiError,
  readJson,
  auditStmt,
} from '../../lib/admin-helpers.mjs'
import { readPostageConfig } from '../../lib/postage-store.mjs'
import { validatePostageConfig } from '../../lib/weights.mjs'
export async function onRequestGet({ env }) {
  try {
    return json({ config: await readPostageConfig(env.DB) })
  } catch (e) {
    return apiError(`Could not load delivery settings: ${e.message}`, 500)
  }
}
export async function onRequestPut({ env, request, data }) {
  const [body, error] = await readJson(request)
  if (error) return error
  let config
  try {
    config = validatePostageConfig(body.config)
  } catch (e) {
    return apiError(e.message, 400)
  }
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO settings (key,value,value_type) VALUES ('postage_config',?,'json') ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')",
      ).bind(JSON.stringify(config)),
      auditStmt(
        env.DB,
        data.actorEmail,
        'postage.settings',
        'settings',
        'postage_config',
        config,
      ),
    ])
    return json({ config })
  } catch (e) {
    return apiError(`Could not save delivery settings: ${e.message}`, 500)
  }
}
