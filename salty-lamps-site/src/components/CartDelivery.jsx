import { cartRequestItem } from '../../functions/lib/frame-orientation.mjs'
import { isUkPostcode } from '../../functions/lib/uk-postcode.mjs'
import React, { useEffect, useState } from 'react'

const money = pence => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100)

export default function CartDelivery({ cart, invalid, catalogStatus, onReloadCatalog, active, loading, onCheckout, paymentStep = false, addressStep = false, postcode = '' }) {
  const [estimate, setEstimate] = useState({ status: 'loading' })
  const [revision, setRevision] = useState(0)
  const key = JSON.stringify({ items: cart.map(cartRequestItem), postcode: postcode.trim().toUpperCase() })
  const invalidPostcode = !!postcode.trim() && !isUkPostcode(postcode)
  useEffect(() => {
    if (invalid || invalidPostcode || catalogStatus !== 'ready' || !active) return undefined
    const payload = JSON.parse(key)
    const controller = new AbortController()
    let timeout
    let disposed = false
    setEstimate({ status: 'loading', key })
    const timer = setTimeout(async () => {
      timeout = setTimeout(() => {
        controller.abort()
        if (!disposed) setEstimate({ status: 'error', message: 'The delivery check took too long. Your basket is saved. Please try again.', key })
      }, 12000)
      try {
        const response = await fetch('/api/checkout/delivery', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload), signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'We could not check delivery. Please try again.')
        if (!['ready', 'needs_review'].includes(data.status)
          || (data.status === 'ready' && (!data.options?.length || data.options.some(option => !Number.isSafeInteger(option.pricePence) || option.pricePence < 0))))
          throw new Error('We could not check delivery. Please try again.')
        if (!controller.signal.aborted) setEstimate({ ...data, key })
      } catch (error) {
        if (!controller.signal.aborted) setEstimate({ status: 'error', message: error.message, key })
      } finally { clearTimeout(timeout) }
    }, 250)
    return () => { disposed = true; clearTimeout(timer); clearTimeout(timeout); controller.abort() }
  }, [key, invalid, invalidPostcode, catalogStatus, active, revision])
  const current = !invalid && estimate.key === key ? estimate : { status: 'loading' }
  const ready = !invalidPostcode && catalogStatus === 'ready' && current.status === 'ready' && current.options?.length > 0
  const needsHelp = catalogStatus === 'ready' && !invalid && current.status === 'needs_review'
  const lowest = ready ? Math.min(...current.options.map(option => option.pricePence)) : null
  const subtotal = cart.reduce((sum, item) => sum + Math.round(item.product.price * 100) * item.qty, 0)
  return (
    <>
      <div className="cart-delivery" aria-live="polite" aria-atomic="true">
        {catalogStatus !== 'ready' ? <>
          <p>{catalogStatus === 'error' ? 'We could not refresh product prices and availability. Your basket is saved.' : 'Checking product prices and availability…'}</p>
          {catalogStatus === 'error' && <button className="text-button" type="button" onClick={onReloadCatalog}>Retry product check</button>}
        </> : invalid ? <p>Check the quantities above to calculate delivery.</p> : invalidPostcode ? <p>Enter a complete UK postcode to check delivery.</p> : ready ? <>
          <div className="cart-summary-row"><span>UK delivery{current.options.length > 1 ? ' from' : ''}</span><strong>{lowest === 0 ? 'Free' : money(lowest)}</strong></div>
          <small>{current.options[0].service}{current.options[0].parcelCount > 1 ? ` · ${current.options[0].parcelCount} parcels` : ''}{current.totalWeightG ? ` · ${(current.totalWeightG / 1000).toLocaleString('en-GB', { maximumFractionDigits: 3 })} kg packed` : ''}</small>
          <div className="cart-summary-row cart-total"><span>Estimated total</span><strong>{money(subtotal + lowest)}</strong></div>
        </> : needsHelp ? <p>{postcode.trim() ? 'Delivery is not available for this basket and postcode. Check your postcode or contact us for help before continuing.' : 'Enter your postcode at checkout to check delivery.'}</p> : current.status === 'loading' ? <p>Calculating delivery…</p> : <>
          <p>{current.message}</p>
          <button className="text-button" type="button" onClick={() => setRevision(value => value + 1)}>Retry delivery check</button>
        </>}
      </div>
      <button type="button" className="button primary" onClick={onCheckout} disabled={loading || invalid || catalogStatus !== 'ready' || (addressStep && !!postcode.trim() && !ready)}>
        {loading ? 'Opening secure payment…' : addressStep ? 'Continue to address' : paymentStep ? 'Continue to payment' : 'Checkout'}
      </button>
      <small className="cart-delivery-note">{addressStep ? 'Your postcode will be filled in on the UK address page.' : paymentStep ? 'Enter your delivery address and payment details securely on the next page.' : 'Review your order before entering payment details.'}</small>
    </>
  )
}
