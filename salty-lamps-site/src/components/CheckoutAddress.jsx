import React from 'react'
import { SPECIAL_INSTRUCTIONS_MAX } from '../../functions/lib/validation.mjs'

export default function CheckoutAddress({ value, onChange, onChangePostcode, disabled }) {
  const set = (field, text) => onChange(current => ({ ...current, [field]: text }))
  const count = (value.instructions || '').length

  return <div className="checkout-address">
    <h2>Email</h2>
    <label htmlFor="checkout-email">Email address</label>
    <input id="checkout-email" type="email" name="checkout-contact-email" autoComplete="off" maxLength={254} value={value.email} onChange={event => set('email', event.target.value)} disabled={disabled} required />
    <h2>Shipping address</h2>
    <label htmlFor="checkout-postcode">Delivery postcode</label>
    <div className="checkout-fixed-postcode">
      <input id="checkout-postcode" value={value.postcode} autoComplete="off" readOnly aria-describedby="checkout-postcode-help" />
      <button id="change-delivery-postcode" type="button" className="text-button" onClick={onChangePostcode} disabled={disabled}>Change postcode</button>
    </div>
    <small id="checkout-postcode-help">This address must use the postcode chosen on your order review. Enter the house or flat and street details below.</small>
    <label htmlFor="checkout-name">Full name</label>
    <input id="checkout-name" name="checkout-recipient" autoComplete="off" maxLength={100} value={value.name} onChange={event => set('name', event.target.value)} disabled={disabled} required />
    <label htmlFor="checkout-country">Country</label>
    <input id="checkout-country" value="United Kingdom" autoComplete="off" readOnly />
    <label htmlFor="checkout-line1">Address line 1</label>
    <input id="checkout-line1" name="checkout-street-one" autoComplete="off" maxLength={150} value={value.line1} onChange={event => set('line1', event.target.value)} disabled={disabled} required />
    <label htmlFor="checkout-line2">Address line 2 <span>(optional)</span></label>
    <input id="checkout-line2" name="checkout-street-two" autoComplete="off" maxLength={150} value={value.line2} onChange={event => set('line2', event.target.value)} disabled={disabled} />
    <label htmlFor="checkout-city">Town or city</label>
    <input id="checkout-city" name="checkout-town" autoComplete="off" maxLength={100} value={value.city} onChange={event => set('city', event.target.value)} disabled={disabled} required />
    <small>Check every address field before payment.</small>
    <h2>Special instructions</h2>
    <label htmlFor="checkout-instructions">Instructions for this order <span>(optional)</span></label>
    <small id="checkout-instructions-help" className="checkout-instructions-help">Delivery notes, gift messages or anything we should know. Please don’t include card or payment details.</small>
    <textarea id="checkout-instructions" name="checkout-order-instructions" autoComplete="off" maxLength={SPECIAL_INSTRUCTIONS_MAX} rows={4} value={value.instructions || ''} onChange={event => set('instructions', event.target.value)} disabled={disabled} aria-describedby="checkout-instructions-help checkout-instructions-count" />
    <small id="checkout-instructions-count" className={'checkout-instructions-count' + (count >= 450 ? ' is-near-limit' : '')}>{count} / {SPECIAL_INSTRUCTIONS_MAX}</small>
  </div>
}
