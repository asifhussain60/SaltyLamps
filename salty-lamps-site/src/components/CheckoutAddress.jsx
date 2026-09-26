import React from 'react'
import PostcodeTypeahead from './PostcodeTypeahead.jsx'

export default function CheckoutAddress({ value, onChange, onPostcodeChange, disabled }) {
  const set = (field, text) => onChange(current => ({ ...current, [field]: text }))

  return <div className="checkout-address">
    <h2>Email</h2>
    <label htmlFor="checkout-email">Email address</label>
    <input id="checkout-email" type="email" name="checkout-contact-email" autoComplete="off" maxLength={254} value={value.email} onChange={event => set('email', event.target.value)} disabled={disabled} required />
    <h2>Shipping address</h2>
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
    <PostcodeTypeahead value={value.postcode} onChange={postcode => { set('postcode', postcode); onPostcodeChange(postcode) }} disabled={disabled} inputId="checkout-postcode" label="Postcode" helpText="Choose a postcode suggestion or enter it manually." />
    <small>Check every address field before payment. You can always edit the address manually.</small>
  </div>
}
