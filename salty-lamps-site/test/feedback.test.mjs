import test from 'node:test'
import assert from 'node:assert/strict'
import { commerceFixture } from './helpers/commerce-fixture.mjs'
import { onRequestPost } from '../functions/api/support/feedback.js'
import { onRequestGet } from '../functions/api/admin/enquiries.js'
import { validateFeedback } from '../functions/lib/feedback.mjs'

const valid = { name: 'Test visitor', email: 'visitor@example.invalid', topic: 'Something went wrong', page: '/shop', message: 'The basket was hard to find.' }
const request = (body, origin = 'http://localhost') => new Request('http://localhost/api/support/feedback', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })

test('feedback saves a private record, generates a captured email and deduplicates retries', async () => {
  const { db, sql } = commerceFixture()
  const env = { DB: db, MAIL_DRY_RUN: 'true' }
  const response = await onRequestPost({ request: request(valid), env })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.ok(body.reference)
  assert.equal(sql.prepare('SELECT source FROM enquiries').get().source, 'feedback')
  const mail = sql.prepare('SELECT * FROM email_outbox').get()
  assert.equal(mail.template_key, 'admin_feedback')
  assert.equal(mail.status, 'skipped')
  assert.match(mail.subject, /Website feedback from Test visitor/)
  assert.equal(JSON.parse(mail.payload).replyTo, valid.email)
  assert.match(JSON.parse(mail.payload).blocks[1].text, /basket/)
  const retry = await onRequestPost({ request: request(valid), env })
  assert.equal((await retry.json()).reference, body.reference)
  assert.equal(sql.prepare('SELECT count(*) AS n FROM email_outbox').get().n, 1)
  const listing = await onRequestGet({ request: new Request('http://localhost/api/admin/enquiries?source=feedback'), env })
  assert.equal((await listing.json()).total, 1)
  sql.close()
})

test('feedback stays saved when the email provider fails and uses the sender as reply-to', async () => {
  const { db, sql } = commerceFixture()
  sql.exec("UPDATE settings SET value='1' WHERE key='email_enabled'; UPDATE settings SET value='shop@example.invalid' WHERE key IN ('email_from_address','admin_notify_email')")
  const oldFetch = globalThis.fetch
  let sent
  globalThis.fetch = async (_url, options) => { sent = JSON.parse(options.body); throw new Error('Provider unavailable') }
  try {
    const result = await onRequestPost({ request: request({ ...valid, message: '<script>alert(1)</script>' }), env: { DB: db, RESEND_API_KEY: 'test-fixture' } })
    assert.equal(result.status, 200)
    assert.deepEqual(sent.reply_to, [valid.email])
    assert.ok(!sent.html.includes('<script>'))
    assert.equal(sql.prepare('SELECT status FROM email_outbox').get().status, 'failed')
    assert.equal(sql.prepare('SELECT count(*) AS n FROM enquiries').get().n, 1)
  } finally { globalThis.fetch = oldFetch; sql.close() }
})

test('feedback rejects malformed input, query strings and cross-site submissions', async () => {
  for (const body of [null, [], {}, { ...valid, page: '//evil.test' }, { ...valid, page: '/checkout?secret=value' }, { ...valid, message: 'x'.repeat(4001) }, { ...valid, email: 'invalid' }]) {
    assert.equal(validateFeedback(body).ok, false)
    assert.equal((await onRequestPost({ request: request(body), env: {} })).status, 400)
  }
  assert.equal((await onRequestPost({ request: request(valid, 'https://other.test'), env: {} })).status, 403)
  assert.equal((await onRequestPost({ request: request({ ...valid, website: 'spam' }), env: {} })).status, 200)
})

test('feedback limits repeated messages and reports a failed save without success', async () => {
  const { db, sql } = commerceFixture()
  for (let i = 0; i < 5; i++) assert.equal((await onRequestPost({ request: request({ ...valid, message: `Message ${i}` }), env: { DB: db } })).status, 200)
  assert.equal((await onRequestPost({ request: request({ ...valid, message: 'Message six' }), env: { DB: db } })).status, 429)
  sql.close()
  assert.equal((await onRequestPost({ request: request(valid), env: { DB: db } })).status, 503)
})
