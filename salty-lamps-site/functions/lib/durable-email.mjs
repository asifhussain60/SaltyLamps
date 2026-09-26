import { sendTemplated } from './mailer.mjs'

export function emailJobStatement(db, id, orderId, message) {
  return db.prepare('INSERT OR IGNORE INTO commerce_email_jobs(id,order_id,payload) VALUES(?,?,?)')
    .bind(id,orderId,JSON.stringify(message))
}

// Resend retains idempotency keys for 24 hours. A delivery whose outcome remains
// uncertain beyond that window requires operator reconciliation, never a blind
// automatic resend. Finished jobs never send again, even on duplicate webhooks.
export async function deliverOrderEmails(env, orderId, origin) {
  const now=Math.floor(Date.now()/1000)
  const {results}=await env.DB.prepare("SELECT * FROM commerce_email_jobs WHERE order_id=? AND status NOT IN ('sent','skipped') ORDER BY id").bind(orderId).all()
  for (const job of results || []) {
    if (job.status==='review' || (job.first_attempt_at && now-job.first_attempt_at>=23*60*60)) {
      await env.DB.prepare("UPDATE commerce_email_jobs SET status='review',error='Delivery outcome needs provider reconciliation before retry.' WHERE id=?").bind(job.id).run()
      throw new Error('Email delivery requires reconciliation')
    }
    const claim=await env.DB.prepare("UPDATE commerce_email_jobs SET status='sending',lease_until=?,first_attempt_at=COALESCE(first_attempt_at,?) WHERE id=? AND lease_until<=? AND status NOT IN ('sent','skipped','review')")
      .bind(now+60,now,job.id,now).run()
    if (!claim.meta?.changes) throw new Error('Email delivery is already in progress')
    const recovery=await env.DB.prepare('SELECT generation FROM commerce_email_reconciliations WHERE job_id=?').bind(job.id).first()
    const providerKey=recovery?.generation ? `${job.id}:recovery:${recovery.generation}` : job.id
    const message=JSON.parse(job.payload)
    const saved=await env.DB.prepare('SELECT transport_json FROM commerce_email_envelopes WHERE job_id=?').bind(job.id).first()
    const transport=saved ? JSON.parse(saved.transport_json) : null
    const [result]=await sendTemplated(env,[{...message,idempotencyKey:providerKey,durableJobId:job.id,transport,
      persistTransport:async envelope=>env.DB.prepare('INSERT OR IGNORE INTO commerce_email_envelopes(job_id,transport_json) VALUES(?,?)').bind(job.id,JSON.stringify(envelope)).run(),
    }],{origin})
    const status=result?.status || 'failed'
    await env.DB.prepare('UPDATE commerce_email_jobs SET status=?,lease_until=0,error=? WHERE id=?')
      .bind(status,result?.error || null,job.id).run()
    if (status==='failed') throw new Error('Email delivery is awaiting retry')
  }
}
