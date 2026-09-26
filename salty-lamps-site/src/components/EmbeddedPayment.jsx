import React, { useEffect, useRef, useState } from 'react'

export default function EmbeddedPayment({ clientSecret, publishableKey, sessionId }) {
  const container = useRef(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientSecret || !publishableKey || !sessionId) return undefined
    setError('')
    setLoading(true)
    let active = true
    let checkout
    const mount = async () => {
      try {
        const { loadStripe } = await import('@stripe/stripe-js')
        const stripe = await loadStripe(publishableKey)
        if (!active) return
        if (!stripe) throw new Error('Payment service unavailable')
        checkout = await stripe.createEmbeddedCheckoutPage({
          clientSecret,
          onComplete: () => window.location.assign(`/checkout/success?session_id=${encodeURIComponent(sessionId)}`),
        })
        if (!active) { checkout.destroy(); return }
        checkout.mount(container.current)
        setLoading(false)
      } catch {
        if (active) { setLoading(false); setError('The secure payment form could not load. Your basket is saved. Please try again.') }
      }
    }
    mount()
    return () => { active = false; checkout?.destroy() }
  }, [clientSecret, publishableKey, sessionId, attempt])

  return <div className="embedded-payment">
    {loading && <p role="status">Loading secure payment…</p>}
    {error && <div><p className="notice" role="alert">{error}</p><button type="button" className="button primary" onClick={() => setAttempt(value => value + 1)}>Retry payment form</button><a className="text-button" href="/checkout/address" onClick={event => { event.preventDefault(); window.history.pushState({}, '', '/checkout/address'); window.dispatchEvent(new PopStateEvent('popstate')) }}>Return to delivery address</a></div>}
    <div ref={container} aria-label="Secure payment form" />
  </div>
}
