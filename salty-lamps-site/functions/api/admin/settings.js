// GET /api/admin/settings — every setting, with its spec so the UI can render the
//                           right input and mark the read-only ones.
// PUT /api/admin/settings — bulk upsert of the editable ones.
//
// A whitelist, not a free-form store: SETTING_SPECS in validation.mjs decides what
// exists, what type it is, and whether it can be changed at all. Currency is
// deliberately read-only — checkout, the storefront formatter and the admin
// formatter all hardcode GBP and the Stripe account is GBP, so an editable field
// that changes nothing would be worse than an honest static one.
import { json, apiError, validationError, readJson, auditStmt } from '../../lib/admin-helpers.mjs'
import { validateSettings, SETTING_SPECS, coerceSetting, settingStorageType } from '../../lib/validation.mjs'

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(`SELECT key, value, value_type, updated_at FROM settings`).all()
    const stored = new Map((results || []).map(r => [r.key, r]))

    return json({
      settings: Object.entries(SETTING_SPECS).map(([key, spec]) => ({
        key,
        label: spec.label,
        type: spec.type,
        editable: spec.editable,
        min: spec.min,
        max: spec.max,
        value: coerceSetting(key, stored.get(key)?.value ?? ''),
        updated_at: stored.get(key)?.updated_at || null,
      })),
    })
  } catch (err) {
    return apiError(`Could not load settings: ${err.message}`, 500, { code: 'server_error' })
  }
}

export async function onRequestPut({ request, env, data }) {
  const [body, bodyErr] = await readJson(request)
  if (bodyErr) return bodyErr

  const { ok, errors, value } = validateSettings(body?.settings || {})
  if (!ok) return validationError(errors)

  try {
    const stmts = Object.entries(value).map(([key, v]) =>
      env.DB.prepare(
        `INSERT INTO settings (key, value, value_type) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      ).bind(key, v, settingStorageType(key)),
    )
    stmts.push(auditStmt(env.DB, data.actorEmail, 'settings.update', 'settings', null, value))
    await env.DB.batch(stmts)
    return json({ updated: Object.keys(value) })
  } catch (err) {
    return apiError(`Could not save settings: ${err.message}`, 500, { code: 'server_error' })
  }
}
