import {
  json,
  apiError,
  readJson,
  auditStmt,
} from '../../lib/admin-helpers.mjs'
import { weightStatement } from '../../lib/postage-store.mjs'
export async function onRequestPatch({ env, request, data }) {
  const [body, error] = await readJson(request)
  if (error) return error
  if (
    !Array.isArray(body.lines) ||
    !body.lines.length ||
    body.lines.length > 200
  )
    return apiError('Provide between 1 and 200 weight updates.', 400)
  const stmts = [],
    ids = new Set()
  try {
    for (const line of body.lines) {
      if (
        !Number.isSafeInteger(line.skuId) ||
        line.skuId < 1 ||
        ids.has(line.skuId)
      )
        return apiError('Each option must have one valid identity.', 400)
      ids.add(line.skuId)
      const old = await env.DB.prepare(
        'SELECT s.id,w.* FROM skus s LEFT JOIN sku_weights w ON w.sku_id=s.id WHERE s.id=?',
      )
        .bind(line.skuId)
        .first()
      if (!old) return apiError('Product option not found.', 404)
      stmts.push(weightStatement(env.DB, line.skuId, line, old))
      stmts.push(
        auditStmt(
          env.DB,
          data.actorEmail,
          'sku.weights',
          'sku',
          line.skuId,
          line,
        ),
      )
    }
  } catch (e) {
    return apiError(e.message, 400)
  }
  try {
    await env.DB.batch(stmts)
    return json({ updated: ids.size })
  } catch (e) {
    return apiError(`Could not save weights: ${e.message}`, 500)
  }
}
