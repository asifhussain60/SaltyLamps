import React from 'react'
import { weightLabel, groupWeightLabel } from '../../functions/lib/weights.mjs'
export function ProductWeight({
  product,
  quantity = 1,
  compact = false,
  group = false,
}) {
  const text = group
    ? groupWeightLabel(product)
    : weightLabel(product, quantity)
  if (!text) return null
  const approximate = product.productWeightMinG !== product.productWeightMaxG
  return compact ? (
    <small className="product-weight-inline">
      {text}
      {quantity > 1 ? ' total product weight' : ''}
    </small>
  ) : (
    <div className="product-weight-detail" aria-live="polite">
      <span>{approximate ? 'Approx. product weight' : 'Product weight'}</span>
      <strong>{text}</strong>
      <p>
        For the selected item or complete pack, excluding packaging.
        {approximate ? ' Natural salt varies within this range.' : ''}
      </p>
    </div>
  )
}
