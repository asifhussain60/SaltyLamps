import {
  json,
  apiError,
  readJson,
  auditStmt,
} from '../../../../lib/admin-helpers.mjs'
import {
  orderWeightLines,
  readPostageConfig,
} from '../../../../lib/postage-store.mjs'
import { quotePostage, parseWeight } from '../../../../lib/weights.mjs'
async function state(db, id) {
  const order = await db
    .prepare('SELECT * FROM orders WHERE id=?')
    .bind(id)
    .first()
  if (!order) return null
  const lines = await orderWeightLines(db, id),
    config = await readPostageConfig(db)
  const saved = await db
    .prepare('SELECT * FROM order_postage WHERE order_id=?')
    .bind(id)
    .first()
  return {
    lines,
    config,
    saved,
    calculated_weight_g: quotePostage(lines,config,{country:order.ship_country,postcode:order.ship_postcode}).total_weight_g,
    quote: quotePostage(
      lines,
      config,
      { country: order.ship_country, postcode: order.ship_postcode },
      saved?.actual_weight_g ?? null,
    ),
    basis: lines.every((l) => l.snapshot_order_id)
      ? 'Recorded order weights'
      : 'Current catalogue estimate — historical weights were not recorded',
    country: order.ship_country,
    postcode: order.ship_postcode,
  }
}
export async function onRequestGet({ env, params }) {
  try {
    const s = await state(env.DB, params.id)
    return s ? json(s) : apiError('Order not found.', 404)
  } catch (e) {
    return apiError(`Could not load postage: ${e.message}`, 500)
  }
}
export async function onRequestPut({ env, params, request, data }) {
  const [body, error] = await readJson(request)
  if (error) return error
  let weight, cost, service, notes
  try {
    weight = parseWeight(body.actual_weight_g, 'g') ?? null
    cost = body.actual_cost_pence ?? null
    if (
      cost !== null &&
      (!Number.isSafeInteger(cost) || cost < 0 || cost > 100_000_000)
    )
      throw new Error('Enter a valid postage cost, or leave it blank.')
    service = body.service ?? ''
    notes = body.notes ?? ''
    if (
      typeof service !== 'string' ||
      service.length > 160 ||
      typeof notes !== 'string' ||
      notes.length > 2000
    )
      throw new Error('Service or notes are too long.')
  } catch (e) {
    return apiError(e.message, 400)
  }
  try {
    const s = await state(env.DB, params.id)
    if (!s) return apiError('Order not found.', 404)
    const quote = quotePostage(
      s.lines,
      s.config,
      { country: s.country, postcode: s.postcode },
      weight,
    )
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO order_postage(order_id,actual_weight_g,actual_cost_pence,service,notes,estimate_json) VALUES (?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET actual_weight_g=excluded.actual_weight_g,actual_cost_pence=excluded.actual_cost_pence,service=excluded.service,notes=excluded.notes,updated_at=datetime('now')`,
      ).bind(
        params.id,
        weight,
        cost,
        service,
        notes,
        JSON.stringify({ ...quote, basis: s.basis }),
      ),
      auditStmt(env.DB, data.actorEmail, 'order.postage', 'order', params.id, {
        actual_weight_g: weight,
        actual_cost_pence: cost,
        service,
        notes,
        previous: s.saved || null,
      }),
    ])
    return json({ saved: true })
  } catch (e) {
    return apiError(`Could not save postage: ${e.message}`, 500)
  }
}
