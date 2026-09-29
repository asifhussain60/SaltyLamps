export const normaliseUkPostcode = value => typeof value === 'string'
  ? value.toUpperCase().replace(/\s/g, '')
  : ''

export const isUkPostcode = value => /^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(normaliseUkPostcode(value))

export const formatUkPostcode = value => {
  const postcode = normaliseUkPostcode(value)
  return isUkPostcode(postcode) ? `${postcode.slice(0, -3)} ${postcode.slice(-3)}` : ''
}

export const sanitiseUkPostcodeInput = value => {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trimStart()
    .replace(/^[^A-Z]+/, '')
    .slice(0, 8)
  return isUkPostcode(cleaned) ? cleaned.trimEnd() : cleaned
}
