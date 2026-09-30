const PRODUCT_DESCRIPTIONS = new Map([
  ['Angel Shape Himalayan Rock Salt Lamp', 'A hand-finished angel-shaped lamp carved from natural Himalayan rock salt. It gives a warm amber light and includes the compatible cable and bulb fitting shown with the selected option. Natural colour, texture, shape, and weight vary from piece to piece.'],
  ['Fire Basket Himalayan Rock Salt Lamp', 'A metal fire-basket lamp filled with natural Himalayan rock-salt pieces. The internal bulb creates a warm glow through the loose salt chunks. Supplied with a compatible cable and bulb fitting; natural colour and texture vary.'],
  ['Himalayan Rock Salt Candle Holder (Heart Shape)', 'A heart-shaped tealight holder carved from natural Himalayan rock salt. Designed for a standard tealight and suited to shelves, tables, and gift sets. Colour, veining, texture, and dimensions vary slightly because each piece is natural.'],
  ['Himalayan Rock Salt Lick for Equestrian & Cattle', 'A natural Himalayan rock-salt lick for horses and cattle, available in the listed weights and pack sizes. Place it in a suitable lick holder or protected location and provide fresh water. Ask a veterinary professional for advice about an individual animal’s dietary needs.'],
  ['Salty Licks for Horses & Cattle, Himalayan Rock Salt Licks', 'Bulk packs of natural Himalayan rock-salt licks for horses and cattle. Choose the listed weight and quantity for yards, farms, or repeat supply. Use a suitable holder, keep fresh water available, and seek veterinary advice for individual dietary needs.'],
  ['Himalayan Rock Salt Soap Bar / Scrub Bar', 'A solid Himalayan rock-salt scrub bar for external use. Use gently on wet skin, avoid broken or irritated areas, rinse after use, and stop if discomfort occurs. Keep the bar dry between uses and seek professional advice for a skin condition.'],
])

const UNSAFE_REVIEW = /health benefit|air quality|purif|detox|asthma|blood circulation|blood pressure|negative ions?|pneumonia/i

export const PUBLIC_REVIEW_WHERE = `display = 1
  AND lower(quote) NOT LIKE '%health benefit%'
  AND lower(quote) NOT LIKE '%air quality%'
  AND lower(quote) NOT LIKE '%purif%'
  AND lower(quote) NOT LIKE '%detox%'
  AND lower(quote) NOT LIKE '%asthma%'
  AND lower(quote) NOT LIKE '%blood circulation%'
  AND lower(quote) NOT LIKE '%blood pressure%'
  AND lower(quote) NOT LIKE '%negative ion%'
  AND lower(quote) NOT LIKE '%pneumonia%'`

// Wording the shop does not publish (see the 13 September end-user review). Kept in one
// place so the shop, the build-time pages and the admin's warning cannot disagree.
export const hasUnsupportedClaim = text => UNSAFE_REVIEW.test(String(text || ''))

const cleanCopy = text => String(text || '').replaceAll('lenght', 'length').replaceAll('Polyurethene', 'polyurethane').replaceAll('worm glow', 'warm glow')

const sentencesOf = text => cleanCopy(text).split(/(?<=[.!?])\s+/)

// The sentences the shop leaves out of the owner's wording, so the admin can quote them.
export const unsupportedSentences = text => sentencesOf(text).filter(sentence => hasUnsupportedClaim(sentence)).map(sentence => sentence.trim())

// The owner's own wording, minus any sentence that makes an unsupported claim.
export function withoutUnsupportedClaims(text) {
  return sentencesOf(text).filter(sentence => !hasUnsupportedClaim(sentence)).join(' ').trim()
}

// options.useStoredDescription is for the live shop: what the owner saved in the admin
// wins over the fixed reviewed wording below. The build-time pages read the committed
// snapshot, which still carries legacy export text, so they keep the reviewed wording.
export function publicProduct(product, options = {}) {
  const productName = product.productName || product.name || ''
  const tags = new Set(product.tags || [])
  if (/\b(bowl|platter)\b/i.test(productName)) {
    tags.add('serving')
    tags.add('hosting')
  } else if (/shot glass/i.test(productName)) {
    tags.add('barware')
    tags.add('hosting')
  } else if (/culinary salt/i.test(productName)) {
    tags.add('pantry')
  }
  const reviewed = PRODUCT_DESCRIPTIONS.get(productName)
  const stored = options?.useStoredDescription === true ? withoutUnsupportedClaims(product.description) : ''
  return {
    ...product,
    tags: [...tags],
    description: stored || reviewed || cleanCopy(product.description),
  }
}

export function publicCollectionSections(sections, collectionSlug) {
  return (sections || []).map(section => {
    if (collectionSlug === 'home-gifts' && section.id === 'home-gifts:gift-sets-offers') {
      return { ...section, rule: { categories: { any: ['special-deal'], none: ['equestrian-salt-licks'] } } }
    }
    if (collectionSlug === 'kitchen-food' && section.id === 'kitchen-food:pantry-barware') {
      return { ...section, rule: { tags: { any: ['pantry', 'barware'] } } }
    }
    return section
  })
}

export function isPublishableReview(review) {
  return !UNSAFE_REVIEW.test(String(review?.quote || review?.feedback || ''))
}
