// GET /api/admin/emails/outbox?page=1&limit=50&status=failed&order=cs_live_...
//
// The send log. This is the whole answer to "there is no automatic retry": every
// send lands here with a true final status, and a failed one is resent with one
// click from Emails -> Activity.
//
// The `order` filter backs the "Emails for this order" panel on the order page.
// idx_email_outbox_order has existed since d1/migrations/005-email.sql and had no
// reader until now. It matters because sending is switched off until the domain's
// DKIM and SPF records exist: without this, a despatch notice quietly logged as
// 'skipped — sending is switched off' was only discoverable by leaving the order.
import Stripe from 'stripe'
import { resumeOrderNotifications } from '../../webhook.js'
import { json, apiError, readJson, auditStmt } from '../../../lib/admin-helpers.mjs'

const STATUSES = ['sent', 'failed', 'skipped']

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50))
  const status = url.searchParams.get('status')
  const orderId = (url.searchParams.get('order') || '').trim()

  const clauses = []
  const binds = []
  if (STATUSES.includes(status)) {
    clauses.push('status = ?')
    binds.push(status)
  }
  if (orderId) {
    clauses.push('order_id = ?')
    binds.push(orderId)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  try {
    const total = await env.DB
      .prepare(`SELECT COUNT(*) AS n FROM email_outbox ${where}`)
      .bind(...binds)
      .first()

    // payload is deliberately not selected: it is only needed by the resend
    // endpoint, and it carries a full copy of the order including the delivery
    // address. No reason to ship that to the browser to render a list.
    const { results } = await env.DB
      .prepare(
        `SELECT id, template_key, to_address, subject, status, error, order_id, provider_id, created_at
         FROM email_outbox ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, (page - 1) * limit)
      .all()

    const jobs=await env.DB.prepare(`SELECT j.id,j.order_id,j.status,j.error,j.first_attempt_at,COALESCE(r.generation,0) AS generation FROM commerce_email_jobs j LEFT JOIN commerce_email_reconciliations r ON r.job_id=j.id
      WHERE status NOT IN ('sent','skipped') ${orderId?'AND order_id=?':''} ORDER BY j.created_at LIMIT 100`).bind(...(orderId?[orderId]:[])).all()
    const preparing=await env.DB.prepare(`SELECT order_id FROM order_notification_jobs WHERE prepared=0 ${orderId?'AND order_id=?':''} ORDER BY created_at LIMIT 100`).bind(...(orderId?[orderId]:[])).all()
    return json({ rows: results || [], total: total?.n || 0, page, limit,
      deliveryJobs:(jobs.results || []).map(job=>({...job,idempotencyKey:job.generation ? `${job.id}:recovery:${job.generation}` : job.id,instructions:job.status==='review'
        ? 'Check this request key in the email provider before retrying. Confirm delivery or confirm that no email was sent.'
        : 'Retry unfinished delivery. The same provider request key prevents duplicate delivery.'})),
      preparationJobs:(preparing.results || []).map(job=>({...job,status:'preparing',instructions:'Order saved. Retry to prepare its notifications.'})),
    })
  } catch (err) {
    return apiError(`Could not load the email log: ${err.message}`, 500, { code: 'server_error' })
  }
}


export async function onRequestPost({request,env,data}) {
  const [body,error]=await readJson(request)
  if(error)return error
  if(typeof body?.orderId!=='string' || !['retry','confirm_sent','confirm_not_sent'].includes(body.action)) return apiError('Choose an order and a recovery action.',400)
  try {
    if(body.action!=='retry') {
      const job=await env.DB.prepare('SELECT * FROM commerce_email_jobs WHERE id=? AND order_id=?').bind(body.jobId || '',body.orderId).first()
      if(!job || job.status!=='review')return apiError('Only a delivery awaiting provider reconciliation can be confirmed.',409)
      if(body.action==='confirm_sent' && (typeof body.providerId!=='string' || !body.providerId.trim() || body.providerId.length>200))return apiError('Record the provider delivery reference before confirming delivery.',400)
      await env.DB.batch([
        ...(body.action==='confirm_not_sent' ? [
          env.DB.prepare('INSERT INTO commerce_email_reconciliations(job_id,generation) SELECT ?,1 WHERE EXISTS(SELECT 1 FROM commerce_email_jobs WHERE id=? AND status=\'review\') ON CONFLICT(job_id) DO UPDATE SET generation=generation+1').bind(job.id,job.id),
          env.DB.prepare('DELETE FROM commerce_email_envelopes WHERE job_id=? AND EXISTS(SELECT 1 FROM commerce_email_jobs WHERE id=? AND status=\'review\')').bind(job.id,job.id),
        ] : []),
        env.DB.prepare("UPDATE commerce_email_jobs SET status=?,lease_until=0,first_attempt_at=NULL,error=? WHERE id=? AND status='review'")
          .bind(body.action==='confirm_sent'?'sent':'pending',body.action==='confirm_sent'?`Provider delivery verified: ${body.providerId.trim()}`:'Provider confirmed no delivery; owner approved retry.',job.id),
        auditStmt(env.DB,data.actorEmail,'email.reconcile','commerce_email_job',job.id,{action:body.action,providerId:body.providerId || null}),
      ])
      return json({status:body.action==='confirm_sent'?'sent':'pending'})
    }
    const stripe=new Stripe(env.STRIPE_SECRET_KEY,{httpClient:Stripe.createFetchHttpClient(),apiVersion:'2024-06-20'})
    await resumeOrderNotifications(env,body.orderId,new URL(request.url).origin,stripe)
    await auditStmt(env.DB,data.actorEmail,'email.retry','order',body.orderId,{}).run()
    return json({status:'complete'})
  } catch {
    return apiError('Delivery still needs attention. Refresh the queue for its recovery instructions.',409)
  }
}
