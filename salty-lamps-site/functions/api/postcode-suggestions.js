export async function onRequestGet({ request, env }) {
  const raw = new URL(request.url).searchParams.get('query') || ''
  const prefix = raw.toUpperCase().replace(/\s/g, '')
  // ONS BT records cannot be offered publicly without a separate LPS licence.
  if (!/^[A-Z0-9]{2,7}$/.test(prefix) || prefix.startsWith('BT')) return json({ suggestions: [] })
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
