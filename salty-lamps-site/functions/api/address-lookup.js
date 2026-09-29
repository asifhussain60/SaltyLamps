const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
})

// Keep the licensed provider credential on the server. Never return invented
// addresses when the provider is absent, unavailable, or has no matching data.
export async function onRequestGet({ request, env }) {
  const key = env.IDEAL_POSTCODES_API_KEY
  if (!key) return json({ available: false, addresses: [] })
  const postcode = (new URL(request.url).searchParams.get('postcode') || '').toUpperCase().replace(/\s/g, '')
  if (!/^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(postcode)) {
    return json({ error: 'Enter a complete UK postcode to find your address.' }, 400)
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7000)
  try {
    const response = await fetch(`https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(postcode)}`, {
      headers: { Authorization: `api_key="${key}"` }, signal: controller.signal,
    })
    const data = await response.json()
    if (response.status === 404 && data.code === 4040) return json({ available: true, addresses: [] })
    if (!response.ok || !Array.isArray(data.result)) throw new Error('Lookup unavailable')
    const addresses = data.result.map(row => ({
      line1: row.line_1, line2: [row.line_2, row.line_3].filter(Boolean).join(', '),
      city: row.post_town, postcode: row.postcode,
    })).filter(row => row.line1 && row.city && row.postcode)
    return json({ available: true, addresses })
  } catch {
    return json({ error: 'Address search is unavailable. Enter your address below to continue.' }, 503)
  } finally { clearTimeout(timeout) }
}
