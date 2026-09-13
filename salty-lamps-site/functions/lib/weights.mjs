// Shared numeric rules: grams and pence in storage; display units never change value.
export const MAX_WEIGHT_G = 1_000_000_000
export const WEIGHT_FIELDS = [
  'product_weight_min_g',
  'product_weight_max_g',
  'packed_weight_g',
  'postal_group',
  'weight_public',
]
export const DEFAULT_POSTAGE_CONFIG = Object.freeze({
  unit: 'kg',
  show_cards: false,
  rates: [],
})
export function parseWeight(value, unit = 'kg') {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (
    !['g', 'kg'].includes(unit) ||
    !['number', 'string'].includes(typeof value)
  )
    throw new Error('Enter a positive weight.')
  const s = String(value).trim()
  if (!(unit === 'kg' ? /^\d+(\.\d{1,3})?$/ : /^\d+$/).test(s))
    throw new Error('Use whole grams or up to three decimal places in kg.')
  const grams = Math.round(Number(s) * (unit === 'kg' ? 1000 : 1))
  if (!Number.isSafeInteger(grams) || grams <= 0 || grams > MAX_WEIGHT_G)
    throw new Error(
      'Weight must be greater than zero and no more than 1,000,000 kg.',
    )
  return grams
}
export const weightInput = (g, unit = 'kg') =>
  g == null ? '' : String(g / (unit === 'g' ? 1 : 1000))
export function validateWeights(input = {}, existing = {}) {
  const value = {
    product_weight_min_g: null,
    product_weight_max_g: null,
    packed_weight_g: null,
    postal_group: '',
    weight_public: 1,
    ...Object.fromEntries(
      WEIGHT_FIELDS.filter((k) => existing[k] != null).map((k) => [
        k,
        existing[k],
      ]),
    ),
  }
  for (const k of WEIGHT_FIELDS)
    if (Object.hasOwn(input, k)) {
      const v = input[k]
      if (k.endsWith('_g')) value[k] = parseWeight(v, 'g') ?? null
      else if (k === 'postal_group') {
        if (typeof v !== 'string' || v.trim().length > 80)
          throw new Error('Postal group must be text up to 80 characters.')
        value[k] = v.trim()
      } else {
        if (![true, false, 0, 1].includes(v))
          throw new Error('Customer weight visibility must be on or off.')
        value[k] = v ? 1 : 0
      }
    }
  const lo = value.product_weight_min_g,
    hi = value.product_weight_max_g
  if ((lo == null) !== (hi == null))
    throw new Error(
      'Enter both ends of the product weight range, or leave both blank.',
    )
  if (lo != null && lo > hi)
    throw new Error('The product weight range must run from lower to higher.')
  if (hi != null && value.packed_weight_g != null && value.packed_weight_g < hi)
    throw new Error(
      'Packed weight must cover the maximum product weight, including packaging.',
    )
  return value
}
export function weightLabel(p, quantity = 1) {
  const lo = p?.productWeightMinG,
    hi = p?.productWeightMaxG
  if (lo == null || hi == null) return ''
  const unit = p.weightUnit === 'g' ? 'g' : 'kg',
    divisor = unit === 'g' ? 1 : 1000
  const fmt = (x) =>
    ((x * quantity) / divisor).toLocaleString('en-GB', {
      maximumFractionDigits: 3,
    })
  return `${fmt(lo)}${hi === lo ? '' : `–${fmt(hi)}`} ${unit}`
}
export function groupWeightLabel(group) {
  const variants = group.variants || [group]
  if (!variants.some((p) => weightLabel(p))) return ''
  if (variants.some((p) => !weightLabel(p))) return 'Weight varies by option'
  const first = variants[0],
    lo = Math.min(...variants.map((p) => p.productWeightMinG)),
    hi = Math.max(...variants.map((p) => p.productWeightMaxG))
  return (
    weightLabel({ ...first, productWeightMinG: lo, productWeightMaxG: hi }) +
    (variants.length > 1 ? ' across options' : '')
  )
}
const normalPostcode = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/\s/g, '')
const prefixes = (s) =>
  String(s || '')
    .split(',')
    .map(normalPostcode)
    .filter(Boolean)
export function validatePostageConfig(input) {
  if (
    !input ||
    !['g', 'kg'].includes(input.unit) ||
    typeof input.show_cards !== 'boolean' ||
    !Array.isArray(input.rates) ||
    input.rates.length > 200
  )
    throw new Error(
      'Choose a weight unit and provide up to 200 delivery rates.',
    )
  const ids = new Set()
  const rates = input.rates.map((r) => {
    if (
      !r ||
      typeof r.id !== 'string' ||
      !r.id ||
      r.id.length > 80 ||
      ids.has(r.id)
    )
      throw new Error('Each rate needs a unique identity.')
    ids.add(r.id)
    for (const k of ['group', 'service', 'country', 'postcodes'])
      if (
        typeof r[k] !== 'string' ||
        r[k].length > (k === 'postcodes' ? 500 : 80)
      )
        throw new Error(
          'Complete the group, service and destination for every rate.',
        )
    if (!r.group.trim() || !r.service.trim() || !/^[A-Z]{2}$/.test(r.country))
      throw new Error(
        'Enter a postal group, service and two-letter destination country.',
      )
    if (
      !Number.isSafeInteger(r.min_g) ||
      r.min_g < 0 ||
      !Number.isSafeInteger(r.max_g) ||
      r.max_g <= r.min_g ||
      r.max_g > MAX_WEIGHT_G
    )
      throw new Error(
        'Each weight band must have an upper limit greater than its lower limit.',
      )
    if (
      !Number.isSafeInteger(r.price_pence) ||
      r.price_pence < 0 ||
      r.price_pence > 100_000_000
    )
      throw new Error(
        'Postage must be a non-negative amount with at most two decimal places.',
      )
    if (prefixes(r.postcodes).some((p) => !/^[A-Z0-9-]+$/.test(p)))
      throw new Error('Use comma-separated postcode prefixes.')
    return {
      ...r,
      group: r.group.trim(),
      service: r.service.trim(),
      postcodes: prefixes(r.postcodes).join(','),
    }
  })
  for (let i = 0; i < rates.length; i++)
    for (let j = 0; j < i; j++) {
      const a = rates[i],
        b = rates[j],
        ap = prefixes(a.postcodes),
        bp = prefixes(b.postcodes)
      const areaOverlaps =
        !ap.length ||
        !bp.length ||
        ap.some((x) => bp.some((y) => x.startsWith(y) || y.startsWith(x)))
      if (
        a.group === b.group &&
        a.service === b.service &&
        a.country === b.country &&
        areaOverlaps &&
        a.min_g < b.max_g &&
        b.min_g < a.max_g
      )
        throw new Error(
          'Weight bands overlap for the same service and destination.',
        )
    }
  return { unit: input.unit, show_cards: input.show_cards, rates }
}
export function quotePostage(
  lines,
  config,
  destination = {},
  overrideWeight = null,
) {
  const review = (reason, total = null) => ({
    status: 'needs_review',
    reason,
    total_weight_g: total,
    options: [],
  })
  if (!lines.length) return review('No order items.')
  if (lines.some((l) => !Number.isSafeInteger(l.quantity) || l.quantity < 1))
    return review('Invalid order quantity.')
  if (
    overrideWeight == null &&
    lines.some(
      (l) => !Number.isSafeInteger(l.packed_weight_g) || l.packed_weight_g <= 0,
    )
  )
    return review('One or more items need a packed weight.')
  const total =
    overrideWeight ??
    lines.reduce((s, l) => s + l.quantity * l.packed_weight_g, 0)
  if (!Number.isSafeInteger(total) || total <= 0 || total > MAX_WEIGHT_G)
    return review('Parcel weight is outside the supported range.')
  const groups = new Set(lines.map((l) => l.postal_group))
  if (groups.size !== 1 || !lines[0].postal_group)
    return review(
      'Missing or mixed postal groups need a manual postage check.',
      total,
    )
  const country = String(destination.country || '').toUpperCase(),
    postcode = normalPostcode(destination.postcode)
  const options = config.rates.filter(
    (r) =>
      r.group === lines[0].postal_group &&
      r.country === country &&
      total > r.min_g &&
      total <= r.max_g &&
      (!r.postcodes ||
        (postcode &&
          prefixes(r.postcodes).some((p) => postcode.startsWith(p)))),
  )
  return options.length
    ? { status: 'ready', reason: '', total_weight_g: total, options }
    : review('No delivery rate matches this weight and destination.', total)
}

// Stripe product metadata snapshots are stamped from database values at checkout.
export function weightMetadata(row) {
  const w = validateWeights({}, row)
  return Object.fromEntries(
    WEIGHT_FIELDS.map((k) => [k, w[k] == null ? '' : String(w[k])]),
  )
}
export function weightsFromMetadata(metadata = {}) {
  const input = {}
  for (const k of WEIGHT_FIELDS) {
    const v = metadata[k]
    if (k === 'postal_group') input[k] = v || ''
    else if (k === 'weight_public') input[k] = v === '0' ? 0 : 1
    else input[k] = v == null || v === '' ? null : parseWeight(v, 'g')
  }
  return validateWeights(input)
}
