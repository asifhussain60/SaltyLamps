import { CartError } from './cart.mjs'

// No client secret is returned until this all-or-nothing admission succeeds.
export async function reserveCheckout(db, session, address, rows) {
  try {
    await db.batch([
      db.prepare('INSERT INTO checkout_reservations(session_id,address_json,expires_at) VALUES(?,?,?)')
        .bind(session.id, JSON.stringify(address), session.expires_at),
      ...rows.map(row => db.prepare('INSERT INTO checkout_reservation_items(session_id,sku_id,quantity) VALUES(?,?,?)')
        .bind(session.id,row.id,row.quantity)),
    ])
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed')) {
      const existing=await db.prepare('SELECT status,address_json FROM checkout_reservations WHERE session_id=?').bind(session.id).first()
      if (existing?.status==='active' && existing.address_json===JSON.stringify(address)) return
    }
    if (String(error.message).includes('checkout_stock_unavailable')) {
      throw new CartError('An item was reserved by another shopper. Please review your basket and try again.',409)
    }
    throw error
  }
}

export async function checkoutAddress(db, sessionId) {
  const row=await db.prepare('SELECT address_json FROM checkout_reservations WHERE session_id=?').bind(sessionId).first()
  return row ? JSON.parse(row.address_json) : null
}

export async function releaseCheckout(db, sessionId) {
  await db.prepare("UPDATE checkout_reservations SET status='released' WHERE session_id=? AND status='active'").bind(sessionId).run()
}

// Time is only a signal to ask Stripe. A completed session may still be processing
// an asynchronous payment; that hold stays until a signed success/failure event.
export async function reconcileExpiredCheckouts(db, stripe) {
  const {results}=await db.prepare("SELECT session_id FROM checkout_reservations WHERE status='active' AND expires_at<=? ORDER BY expires_at LIMIT 20")
    .bind(Math.floor(Date.now()/1000)).all()
  for (const row of results || []) {
    const session=await stripe.checkout.sessions.retrieve(row.session_id)
    if (session.status==='expired' && session.payment_status!=='paid') await releaseCheckout(db,row.session_id)
  }
}

export async function allCheckoutLines(stripe, sessionId) {
  const lines=[]
  let after
  for (;;) {
    const page=await stripe.checkout.sessions.listLineItems(sessionId,{
      limit:100,expand:['data.price.product'],...(after?{starting_after:after}:{}),
    })
    lines.push(...page.data)
    if (!page.has_more) return lines
    const last=page.data.at(-1)?.id
    if (!last || last===after) throw new Error('Payment items could not be fully loaded')
    after=last
  }
}

export function checkoutAttemptId(value) {
  if (value == null) return crypto.randomUUID() // compatibility with older clients
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new CartError('Please refresh checkout and try again.')
  return value
}

export function checkoutFingerprint(address,items) {
  return JSON.stringify({address,items:[...items].sort((a,b)=>a.skuId-b.skuId)})
}

export async function readCheckoutAttempt(db,id) {
  return db.prepare('SELECT * FROM checkout_attempts WHERE id=?').bind(id).first()
}

export function checkoutStateError(message,code) {
  const error=new CartError(message,409)
  error.code=code
  return error
}

export async function resumeCheckoutAttempt(db,stripe,attempt,fingerprint) {
  if (attempt.fingerprint !== fingerprint) throw checkoutStateError('Your checkout details changed. Please review the basket and start payment again.','checkout_attempt_changed')
  // Never recreate an unknown session outside Stripe's idempotency retention.
  if (!attempt.session_id && Math.floor(Date.now()/1000)-attempt.created_at >= 23*60*60) {
    throw checkoutStateError('This checkout expired. Please start payment again.','checkout_expired')
  }
  const session=attempt.session_id
    ? await stripe.checkout.sessions.retrieve(attempt.session_id)
    : await stripe.checkout.sessions.create(JSON.parse(attempt.parameters_json),{idempotencyKey:`checkout:${attempt.id}`})
  if (session.status==='expired') {
    await releaseCheckout(db,session.id)
    throw checkoutStateError('This checkout expired. Please start payment again.','checkout_expired')
  }
  if (session.status==='complete' || session.payment_status==='paid') {
    throw checkoutStateError('Your previous payment is complete or processing. Please check its confirmation before starting another payment.','checkout_in_progress')
  }
  if (!session.client_secret || !session.expires_at) throw new Error('Incomplete payment session')
  await db.prepare('UPDATE checkout_attempts SET session_id=? WHERE id=?').bind(session.id,attempt.id).run()
  try {
    await reserveCheckout(db,session,JSON.parse(attempt.address_json),JSON.parse(attempt.rows_json))
  } catch (error) {
    // No caller receives this secret until admission has succeeded.
    try {await stripe.checkout.sessions.expire(session.id)} catch { /* natural provider expiry remains in force */ }
    throw error
  }
  return session
}

export async function replaceCheckoutAttempt(db,stripe,id) {
  const previous=await readCheckoutAttempt(db,id)
  if (!previous) return
  // Recover an uncertain creation before cancelling it, using the original body
  // and key. The secret is never returned from this replacement path.
  if (!previous.session_id && Math.floor(Date.now()/1000)-previous.created_at>=23*60*60) {
    throw checkoutStateError('Your previous checkout needs confirmation before another payment. Please contact the shop.','checkout_in_progress')
  }
  let session=previous.session_id ? await stripe.checkout.sessions.retrieve(previous.session_id)
    : await stripe.checkout.sessions.create(JSON.parse(previous.parameters_json),{idempotencyKey:`checkout:${previous.id}`})
  if (session.status==='open') session=await stripe.checkout.sessions.expire(session.id)
  if (session.status!=='expired' || session.payment_status==='paid') {
    throw checkoutStateError('Your previous payment is complete or processing. Please check its confirmation before starting another payment.','checkout_in_progress')
  }
  await db.prepare('UPDATE checkout_attempts SET session_id=? WHERE id=?').bind(session.id,previous.id).run()
  await releaseCheckout(db,session.id)
}
