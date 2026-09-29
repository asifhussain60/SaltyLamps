import { isUkPostcode, normaliseUkPostcode } from '../lib/uk-postcode.mjs'

const SOURCE = 'https://api.postcodes.io/postcodes'

export async function onRequestGet({ request, env, fetcher = fetch }) {
  const raw = new URL(request.url).searchParams.get('query') || ''
  const prefix = raw.toUpperCase().replace(/\s/g, '')
  // Commercial BT data requires a separate NI Land & Property Services licence.
  if (!/^[A-Z][A-Z0-9]{0,6}$/.test(prefix) || prefix.startsWith('BT')) return json({ suggestions: [] })

  // Staging starts with two local examples; query the complete public directory
  // for useful suggestions across Great Britain, retaining D1 as an outage fallback.
  if (env.POSTCODE_SUGGESTIONS_SOURCE !== 'local') {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    try {
      const response = await fetcher(`${SOURCE}/${encodeURIComponent(prefix)}/autocomplete?limit=8`, { signal: controller.signal })
      if (!response.ok) throw new Error('Postcode directory unavailable')
      const data = await response.json()
      if (data.status !== 200 || (data.result !== null && !Array.isArray(data.result))) throw new Error('Invalid postcode response')
      const suggestions = (data.result || []).filter(value => typeof value === 'string'
        && !normaliseUkPostcode(value).startsWith('BT') && isUkPostcode(value)
        && normaliseUkPostcode(value).startsWith(prefix)).slice(0, 8)
      return json({ suggestions })
    } catch {
      // Manual entry remains possible if both sources are unavailable.
    } finally { clearTimeout(timeout) }
  }
  try {
    const rows = await env.DB.prepare(
      'SELECT postcode FROM uk_postcodes WHERE postcode_key >= ? AND postcode_key < ? ORDER BY postcode_key LIMIT 8',
    ).bind(prefix, `${prefix}[`).all()
    return json({ suggestions: rows.results.map(row => row.postcode) })
  } catch {
    return json({ error: 'Postcode suggestions are unavailable.' }, 503)
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
