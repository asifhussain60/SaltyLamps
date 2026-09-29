import React, { useEffect, useRef, useState } from 'react'

export default function AddressLookup({ postcode, onSelect, disabled }) {
  const [result, setResult] = useState({ addresses: [], message: '' })
  const [busy, setBusy] = useState(false)
  const request = useRef(null)
  useEffect(() => {
    request.current?.abort()
    request.current = null
    setBusy(false)
    setResult({ addresses: [], message: '' })
    return () => { request.current?.abort(); request.current = null }
  }, [postcode])
  const lookup = async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setResult({ addresses: [], message: '' })
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(`/api/address-lookup?postcode=${encodeURIComponent(postcode)}`, { signal: controller.signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      if (request.current !== controller || controller.signal.aborted) return
      const addresses = data.addresses || []
      setResult({ addresses, message: !data.available
        ? 'Address search is not connected yet. Enter your address below to continue.'
        : addresses.length ? 'Choose your address below, or enter it manually.' : 'No addresses found. Check the postcode or enter your address below.' })
    } catch {
      if (request.current === controller) setResult({ addresses: [], message: 'Address search is unavailable. Enter your address below to continue.' })
    } finally {
      clearTimeout(timeout)
      if (request.current === controller) setBusy(false)
    }
  }
  return <div className="address-lookup">
    <button type="button" className="button secondary" onClick={lookup} disabled={disabled || busy || !postcode.trim()}>{busy ? 'Finding addresses…' : 'Find my address'}</button>
    {result.message && <p role="status">{result.message}</p>}
    {result.addresses.length > 0 && <>
      <label htmlFor="address-choice">Choose your address</label>
      <select id="address-choice" defaultValue="" disabled={disabled} onChange={event => {
        const address = result.addresses[Number(event.target.value)]
        if (address) onSelect(address)
      }}>
        <option value="" disabled>Select a house or flat</option>
        {result.addresses.map((address, index) => <option key={index} value={index}>{[address.line1, address.line2, address.city].filter(Boolean).join(', ')}</option>)}
      </select>
    </>}
  </div>
}
