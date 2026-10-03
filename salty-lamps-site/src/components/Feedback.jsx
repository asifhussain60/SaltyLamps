import React, { useRef, useState } from 'react'
import { FEEDBACK_TOPICS } from '../../functions/lib/feedback.mjs'

export default function Feedback() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [reference, setReference] = useState(null)
  const busy = useRef(false)
  const notice = useRef(null)
  const originPage = new URLSearchParams(window.location.search).get('from') || ''
  const page = /^\/(?!\/)[^?#\s\\]*$/.test(originPage) ? originPage.slice(0, 300) : ''

  async function submit(event) {
    event.preventDefault()
    if (busy.current) return
    busy.current = true
    setStatus('sending'); setError('')
    const body = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const response = await fetch('/api/support/feedback', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok) {
        setStatus('error')
        setError(`${Object.values(result?.error?.fields || {}).join(' ') || result?.error?.message || 'We could not save your feedback. Please try again.'} Your message is still in the form.`)
        return
      }
      setReference(result.reference)
      setStatus('saved')
    } catch {
      setStatus('error')
      setError('We could not reach the shop. Check your connection and try again. Your message is still in the form.')
    } finally {
      busy.current = false
      requestAnimationFrame(() => notice.current?.focus())
    }
  }

  return <section className="feedback-page">
    <div className="feedback-intro">
      <p className="eyebrow">We’re listening</p>
      <h1>Share your feedback</h1>
      <p>Tell us what worked, what could be better, or where you got stuck.</p>
      <div className="feedback-note"><strong>A private message to our team</strong><p>Your feedback is saved for Salty Lamps to review. It won’t appear as a public review. We’ll use your email only to follow up on your message.</p></div>
      {import.meta.env.VITE_STAGING === '1' && <p className="feedback-sandbox">Test shop: feedback is saved and its notification is recorded for review. Emails are not sent from this environment.</p>}
    </div>
    {status === 'saved' ? <div className="feedback-card" ref={notice} tabIndex={-1} role="status">
      <p className="eyebrow">Thank you</p><h2>Your feedback is saved.</h2>
      <p>Our team can now review your message.{reference ? ` Your reference is #${reference}.` : ''}</p>
      <a className="button primary" href="/shop">Back to the shop</a>
    </div> : <form className="feedback-card" onSubmit={submit}>
      <label htmlFor="feedback-name">Your name <span>(optional)</span></label>
      <input id="feedback-name" name="name" autoComplete="name" maxLength={120} disabled={status === 'sending'} />
      <label htmlFor="feedback-email">Email address</label>
      <input id="feedback-email" name="email" type="email" autoComplete="email" maxLength={200} required disabled={status === 'sending'} />
      <label htmlFor="feedback-topic">What would you like to share?</label>
      <select id="feedback-topic" name="topic" required defaultValue="" disabled={status === 'sending'}><option value="" disabled>Choose a feedback type</option>{FEEDBACK_TOPICS.map(topic => <option key={topic}>{topic}</option>)}</select>
      <label htmlFor="feedback-page">Page you were viewing <span>(optional)</span></label>
      <input id="feedback-page" name="page" defaultValue={page} maxLength={300} placeholder="/shop" aria-describedby="feedback-page-help" disabled={status === 'sending'} />
      <small id="feedback-page-help">Use a page path such as /shop.</small>
      <label htmlFor="feedback-message">Your feedback</label>
      <textarea id="feedback-message" name="message" rows={6} required maxLength={4000} aria-describedby="feedback-message-help" disabled={status === 'sending'} />
      <small id="feedback-message-help">Up to 4,000 characters. Please don’t include passwords or payment details.</small>
      <div className="feedback-trap" aria-hidden="true"><label htmlFor="feedback-website">Website</label><input id="feedback-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      {error && <p className="feedback-error" role="alert" tabIndex={-1} ref={notice}>{error}</p>}
      <button className="button primary" disabled={status === 'sending'} type="submit">{status === 'sending' ? 'Saving your feedback…' : 'Send feedback'}</button>
      <small>Read our <a href="/privacy-policy">privacy policy</a>.</small>
    </form>}
  </section>
}
