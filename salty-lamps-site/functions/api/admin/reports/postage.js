import {
  json,
  apiError,
  toCsv,
  csvResponse,
} from '../../../lib/admin-helpers.mjs'
export async function onRequestGet({ env, request }) {
  const url = new URL(request.url)
  try {
    if (url.searchParams.get('kind') === 'weights') {
      const { results } = await env.DB.prepare(
        `SELECT s.id AS ref,p.name,s.variant_label,s.sku,w.product_weight_min_g,w.product_weight_max_g,w.packed_weight_g,w.postal_group,w.weight_public FROM skus s JOIN products p ON p.id=s.product_id LEFT JOIN sku_weights w ON w.sku_id=s.id ORDER BY p.name,s.id`,
      ).all()
      return csvResponse(
        toCsv(results || [], [
          { key: 'ref', label: 'Ref' },
          { key: 'name', label: 'Product' },
          { key: 'variant_label', label: 'Size / option' },
          { key: 'sku', label: 'Product code' },
          { key: 'product_weight_min_g', label: 'Product weight from (g)' },
          { key: 'product_weight_max_g', label: 'Product weight to (g)' },
          { key: 'packed_weight_g', label: 'Packed shipping weight (g)' },
          { key: 'postal_group', label: 'Postal group' },
          { key: 'weight_public', label: 'Show product weight' },
        ]),
        'product-weights.csv',
      )
    }
    // No invented zero costs: missing records are counted separately from recorded £0.
    const summary = await env.DB.prepare(
      `SELECT COUNT(*) AS orders,COUNT(op.actual_cost_pence) AS recorded_costs,SUM(op.actual_cost_pence) AS cost_pence,COUNT(op.actual_weight_g) AS recorded_weights,SUM(op.actual_weight_g) AS weight_g FROM orders o LEFT JOIN order_postage op ON op.order_id=o.id WHERE o.status='paid'`,
    ).first()
    const { results } = await env.DB.prepare(
      `SELECT o.id,o.created_at,o.status,op.actual_weight_g,op.actual_cost_pence,op.service,op.notes FROM orders o LEFT JOIN order_postage op ON op.order_id=o.id ORDER BY o.created_at DESC ${url.searchParams.get('format') === 'csv' ? '' : 'LIMIT 50'}`,
    ).all()
    if (url.searchParams.get('format') === 'csv')
      return csvResponse(
        toCsv(results || [], [
          { key: 'id', label: 'Order' },
          { key: 'created_at', label: 'Created' },
          { key: 'status', label: 'Status' },
          { key: 'actual_weight_g', label: 'Actual parcel weight (g)' },
          { key: 'actual_cost_pence', label: 'Actual postage paid (pence)' },
          { key: 'service', label: 'Service' },
          { key: 'notes', label: 'Notes' },
        ]),
        'order-postage.csv',
      )
    return json({ summary, orders: results || [] })
  } catch (e) {
    return apiError(`Could not load postage report: ${e.message}`, 500)
  }
}
