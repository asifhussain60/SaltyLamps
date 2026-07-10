// PATCH /api/admin/inventory — bulk stock adjustment.
// Body: { lines: [{ skuId, quantity? , in_stock? }] }
// Each line is checked against the SKU's real track_mode: quantity SKUs take a
// count (in_stock is derived), binary SKUs take an in/out flag (quantity stays null).
import { json, apiError, validationError, readJson, auditStmt } from '../../lib/admin-helpers.mjs'
import { validateInventoryLine } from '../../lib/validation.mjs'

export async function onRequestPatch({ request, env, data }) {
  const [body, bodyErr] = await readJson(request)
  if (bodyErr) return bodyErr

  const lines = Array.isArray(body.lines) ? body.lines : []
  if (lines.length === 0) return apiError('No inventory lines provided.', 400, { code: 'validation' })
  if (lines.length > 500) return apiError('Too many lines in one request (max 500).', 413, { code: 'too_many' })

  // Validate shape first.
  const parsed = []
  const fieldErrors = {}
  lines.forEach((line, i) => {
    const res = validateInventoryLine(line)
    if (!res.ok) fieldErrors[`line_${i}`] = Object.values(res.errors).join(' ')
    else parsed.push(res.value)
  })
  if (Object.keys(fieldErrors).length) return validationError(fieldErrors)

  try {
    // Load the real track_mode for every referenced SKU in one query.
    const ids = [...new Set(parsed.map(p => p.skuId))]
    const placeholders = ids.map(() => '?').join(',')
    const skuRows = await env.DB.prepare(`SELECT id, track_mode FROM skus WHERE id IN (${placeholders})`).bind(...ids).all()
    const modeById = new Map((skuRows.results || []).map(r => [r.id, r.track_mode]))

    const stmts = []
    const conflicts = {}
    for (const line of parsed) {
      const mode = modeById.get(line.skuId)
      if (!mode) {
        conflicts[`sku_${line.skuId}`] = 'SKU not found.'
        continue
      }
      if (mode === 'quantity') {
        if (line.quantity == null) {
          conflicts[`sku_${line.skuId}`] = 'This SKU tracks a quantity — provide a count.'
          continue
        }
        stmts.push(
          env.DB.prepare(`UPDATE skus SET quantity = ?, in_stock = ? WHERE id = ?`)
            .bind(line.quantity, line.quantity > 0 ? 1 : 0, line.skuId),
        )
      } else {
        // binary
        if (line.in_stock == null) {
          conflicts[`sku_${line.skuId}`] = 'This SKU is in/out of stock only — provide an in-stock flag.'
          continue
        }
        stmts.push(
          env.DB.prepare(`UPDATE skus SET in_stock = ? WHERE id = ?`).bind(line.in_stock, line.skuId),
        )
      }
    }
    if (Object.keys(conflicts).length) return validationError(conflicts, 'Some lines did not match their stock mode.')

    stmts.push(auditStmt(env.DB, data.actorEmail, 'inventory.adjust', 'inventory', null, { count: stmts.length }))
    await env.DB.batch(stmts)
    return json({ updated: stmts.length - 1 })
  } catch (err) {
    return apiError(`Could not adjust inventory: ${err.message}`, 500, { code: 'server_error' })
  }
}
