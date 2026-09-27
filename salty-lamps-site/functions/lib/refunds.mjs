import { orderTokens, orderBlocks } from './mailer.mjs'
import { deliverOrderEmails } from './durable-email.mjs'

export async function readOrderWithRefund(db,id) {
  return db.prepare('SELECT o.*,r.status AS refund_status,r.refund_id,r.amount_pence AS refunded_amount_pence FROM orders o LEFT JOIN order_refunds r ON r.order_id=o.id WHERE o.id=?').bind(id).first()
}

export async function requestOrderRefund(env,stripe,order,origin) {
  await env.DB.prepare("INSERT OR IGNORE INTO order_refunds(order_id,status) VALUES(?,'requesting')").bind(order.id).run()
  let row=await env.DB.prepare('SELECT * FROM order_refunds WHERE order_id=?').bind(order.id).first()
  if (['failed','canceled','partial'].includes(row.status)) {
    await env.DB.prepare("UPDATE order_refunds SET status='requesting',refund_id=NULL,attempt=attempt+1,updated_at=datetime('now') WHERE order_id=? AND attempt=? AND status IN ('failed','canceled','partial')")
      .bind(order.id,row.attempt).run()
    row=await env.DB.prepare('SELECT * FROM order_refunds WHERE order_id=?').bind(order.id).first()
  }
  // An interrupted request retries with exactly the same provider idempotency key.
  let refund
  try {
    refund=row.refund_id ? await stripe.refunds.retrieve(row.refund_id) : await stripe.refunds.create(
      {payment_intent:order.payment_intent}, {idempotencyKey:`refund:${order.id}:${row.attempt}`},
    )
  } catch (error) {
    // Definitive provider refusals are visible and may be retried with a new key.
    // Network/5xx outcomes remain requesting so retries reuse the same key.
    if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
      await env.DB.prepare("UPDATE order_refunds SET status='failed',updated_at=datetime('now') WHERE order_id=? AND attempt=? AND status='requesting'").bind(order.id,row.attempt).run()
    }
    throw error
  }
  await env.DB.prepare('UPDATE order_refunds SET refund_id=? WHERE order_id=? AND attempt=?').bind(refund.id,order.id,row.attempt).run()
  await syncRefund(env,refund,origin,stripe)

  return readOrderWithRefund(env.DB,order.id)
}

// Called with a freshly retrieved provider object for webhook reconciliation,
// so a delayed/out-of-order event cannot reverse a newer provider state.
export async function syncRefund(env,refund,origin,stripe) {
  const paymentIntent=typeof refund.payment_intent==='string'?refund.payment_intent:refund.payment_intent?.id
  if (!paymentIntent || !refund.id || !refund.status) throw new Error('Incomplete refund information')
  const order=await env.DB.prepare('SELECT * FROM orders WHERE payment_intent=?').bind(paymentIntent).first()
  if (!order) return
  // Read every provider refund, including older dashboard partials. Sum only
  // succeeded refunds: a pending refund must never masquerade as money returned.
  const refunds=new Map()
  let after
  for (;;) {
    const page=await stripe.refunds.list({payment_intent:paymentIntent,limit:100,...(after?{starting_after:after}:{})})
    if (!Array.isArray(page.data)) throw new Error('Refund total is awaiting provider reconciliation')
    for (const item of page.data) refunds.set(item.id,item)
    if (!page.has_more) break
    const last=page.data.at(-1)?.id
    if (!last || last===after) throw new Error('Refund history could not be fully loaded')
    after=last
  }
  refunds.set(refund.id,refund)
  const refunded=[...refunds.values()].reduce((sum,item)=>sum+(item.status==='succeeded'?item.amount:0),0)
  if (!Number.isSafeInteger(refunded) || refunded<0) throw new Error('Refund total is awaiting provider reconciliation')
  const full=refunded>=order.amount_total_pence
  const statements=[
    ...[...refunds.values()].map(item=>env.DB.prepare(`INSERT INTO order_refund_records(refund_id,order_id,status,amount_pence) VALUES(?,?,?,?)
      ON CONFLICT(refund_id) DO UPDATE SET status=CASE
        WHEN order_refund_records.status IN ('failed','canceled') THEN order_refund_records.status
        WHEN order_refund_records.status='succeeded' AND excluded.status IN ('pending','requires_action') THEN 'succeeded'
        ELSE excluded.status END,amount_pence=excluded.amount_pence,updated_at=datetime('now')`)
      .bind(item.id,order.id,item.status,item.amount)),
    // Derive the balance from the transaction's records, not the largest amount
    // ever seen. Stripe may change a succeeded refund to failed. Failed/canceled
    // refund IDs are terminal, so a concurrent stale response cannot revive one.
    env.DB.prepare(`INSERT INTO order_refunds(order_id,refund_id,status,amount_pence)
      SELECT ?,?,CASE
        WHEN COALESCE(SUM(CASE WHEN status='succeeded' THEN amount_pence ELSE 0 END),0)>=? THEN 'succeeded'
        WHEN SUM(status='requires_action')>0 THEN 'requires_action'
        WHEN SUM(status='pending')>0 THEN 'pending'
        WHEN SUM(CASE WHEN status='succeeded' THEN amount_pence ELSE 0 END)>0 THEN 'partial'
        WHEN SUM(status='failed')>0 THEN 'failed' ELSE 'canceled' END,
        COALESCE(SUM(CASE WHEN status='succeeded' THEN amount_pence ELSE 0 END),0)
      FROM order_refund_records WHERE order_id=?
      ON CONFLICT(order_id) DO UPDATE SET
        status=excluded.status,amount_pence=excluded.amount_pence,
        refund_id=COALESCE(order_refunds.refund_id,excluded.refund_id),updated_at=datetime('now')`)
      .bind(order.id,refund.id,order.amount_total_pence,order.id),
    env.DB.prepare(`UPDATE orders SET status=CASE
      WHEN (SELECT status FROM order_refunds WHERE order_id=orders.id)='succeeded' THEN 'refunded'
      WHEN status='refunded' THEN 'paid' ELSE status END WHERE id=?`).bind(order.id),
    // Do not retry an unsent refund confirmation after the refund has failed.
    // Sent messages remain historical evidence; the administrator sees the
    // failed refund and must reconcile any customer follow-up.
    env.DB.prepare(`UPDATE commerce_email_jobs SET status='skipped',error='Refund no longer completed; confirmation suppressed.'
      WHERE id=? AND status IN ('pending','failed') AND NOT EXISTS
        (SELECT 1 FROM order_refunds WHERE order_id=? AND status='succeeded')`)
      .bind(`refund:${order.id}:confirmation`,order.id),
  ]
  if (full) {
    if (order.customer_email) {
      const {results}=await env.DB.prepare(`SELECT oi.quantity,oi.unit_price_pence, oi.frame_choices_json,s.sku,s.variant_label,p.name FROM order_items oi
        JOIN skus s ON s.id=oi.sku_id JOIN products p ON p.id=s.product_id WHERE oi.order_id=?`).bind(order.id).all()
      const after={...order,status:'refunded'}
      const message={
        templateKey:'order_refunded',to:order.customer_email,orderId:order.id,data:orderTokens(after),blocks:orderBlocks(after,results || []),
      }
      statements.push(env.DB.prepare(`INSERT OR IGNORE INTO commerce_email_jobs(id,order_id,payload)
        SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM order_refunds WHERE order_id=? AND status='succeeded')`)
        .bind(`refund:${order.id}:confirmation`,order.id,JSON.stringify(message),order.id))
      statements.push(env.DB.prepare(`UPDATE commerce_email_jobs SET status='pending',error=NULL
        WHERE id=? AND status='skipped' AND error='Refund no longer completed; confirmation suppressed.'
        AND EXISTS(SELECT 1 FROM order_refunds WHERE order_id=? AND status='succeeded')`)
        .bind(`refund:${order.id}:confirmation`,order.id))
    }
  }
  await env.DB.batch(statements)
  // Payment reconciliation remains committed if mail needs another attempt.
  await deliverOrderEmails(env,order.id,origin)
}
