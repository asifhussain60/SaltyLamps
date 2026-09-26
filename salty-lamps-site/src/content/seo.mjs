const tidy = value => String(value || '').replace(/\s+/g, ' ').trim()

const firstSentence = value => {
  const text = tidy(value)
  if (!text) return ''
  const end = text.search(/[.!?](?:\s|$)/)
  return end >= 0 ? text.slice(0, end + 1) : text
}

const pounds = value => new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
}).format(Number(value || 0))

export function productMetaDescription(product) {
  const productName = tidy(product?.productName || product?.name)
  const option = tidy(product?.variantLabel)
  const namedOption = option ? `${productName}, ${option}` : productName
  const availability = product?.stock ? 'Available to order' : 'Currently out of stock'
  const detail = firstSentence(product?.description)
  return tidy(`Shop ${namedOption} from Salty Lamps for ${pounds(product?.price)}. ${availability}. ${detail}`)
}

export function categoryMetaDescription(category) {
  return tidy(`Shop ${category?.name || 'Himalayan salt products'} at Salty Lamps. ${category?.description || ''}`)
}

export function collectionCategoryMetaDescription(category, collection) {
  const audience = tidy(collection?.shortName || collection?.name || 'this collection')
  return tidy(`Explore ${category?.name || 'Himalayan salt products'} for ${audience} at Salty Lamps. ${category?.description || collection?.description || ''}`)
}
