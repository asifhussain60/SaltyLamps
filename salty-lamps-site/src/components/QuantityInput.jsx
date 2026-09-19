import React, { useEffect, useId, useRef, useState } from 'react'
import { MAX_CART_QUANTITY } from '../../functions/lib/cart.mjs'

export default function QuantityInput({ value, max = MAX_CART_QUANTITY, name, onChange, onValidityChange, disabled = false }) {
  const id = useId()
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState('')
  const validityChanged = useRef(onValidityChange)
  validityChanged.current = onValidityChange
  useEffect(() => {
    setDraft(String(value))
    const valid = Number.isSafeInteger(value) && value >= 1 && value <= max
    setError(valid ? '' : `Enter a whole number from 1 to ${max}.`)
    validityChanged.current?.(valid)
  }, [value, max])
  const update = text => {
    setDraft(text)
    const next = Number(text)
    const valid = /^\d+$/.test(text) && Number.isSafeInteger(next) && next >= 1 && next <= max
    const message = valid ? '' : `Enter a whole number from 1 to ${max}.`
    setError(message)
    onValidityChange?.(valid)
    if (valid) onChange(next)
  }
  return (
    <div className="quantity-field">
      <label htmlFor={id}>Quantity<span className="sr-only"> for {name}</span></label>
      <div className="qty">
        <button type="button" aria-label={`Decrease ${name}`} disabled={disabled || value <= 1} onClick={() => update(String(value - 1))}>−</button>
        <input id={id} type="number" inputMode="numeric" min="1" max={max} step="1" value={draft} disabled={disabled}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          onChange={event => update(event.target.value)} />
        <button type="button" aria-label={`Increase ${name}`} disabled={disabled || value >= max} onClick={() => update(String(value + 1))}>+</button>
      </div>
      {error && <small className="quantity-error" id={`${id}-error`} role="alert">{error}</small>}
    </div>
  )
}
