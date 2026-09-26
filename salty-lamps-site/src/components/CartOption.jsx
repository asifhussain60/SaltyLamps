import { needsFrameOrientation } from '../../functions/lib/frame-orientation.mjs'
import React from 'react'
import { weightLabel } from '../../functions/lib/weights.mjs'

const money = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)

export default function CartOption({ item, options, disabled, onChange, onOrientationChange }) {
  const weight = weightLabel(item.product)
  return <div className="cart-option">
    {options.length > 1 ? <label>
      <span>Weight / size / pack</span>
      <select aria-label={`Weight, size or pack for ${item.product.productName || item.product.name}`}
        data-cart-option={item.product.skuId} value={item.product.skuId} disabled={disabled}
        onChange={event => onChange(Number(event.target.value))}>
        {options.map(option => <option key={option.skuId} value={option.skuId} disabled={!option.stock}>
          {option.variantLabel || 'Standard'} — {money(option.price)}{!option.stock ? ' — Out of stock' : ''}
        </option>)}
      </select>
    </label> : item.product.variantLabel ? <p><strong>Selected option:</strong> {item.product.variantLabel}</p> : null}
    {needsFrameOrientation(item.product) && <label>
      <span>Orientation</span>
      <select aria-label={`Orientation for ${item.product.name}`} value={item.orientation || ''} disabled={disabled}
        onChange={event => onOrientationChange(event.target.value)}>
        <option value="" disabled>Choose orientation</option>
        <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
      </select>
    </label>}
    {weight && <p>Product weight: <strong>{weight}</strong> per item or pack{item.qty > 1 ? ` · ${weightLabel(item.product, item.qty)} for ${item.qty}` : ''}. Excludes packaging.</p>}
  </div>
}
