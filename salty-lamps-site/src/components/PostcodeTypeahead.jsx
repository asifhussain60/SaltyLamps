import React, { useEffect, useId, useRef, useState } from 'react'
import { isUkPostcode, sanitiseUkPostcodeInput } from '../../functions/lib/uk-postcode.mjs'

export default function PostcodeTypeahead({ value, onChange, disabled = false, inputId = 'delivery-postcode', label = 'Delivery postcode', helpText = 'Choose a postcode suggestion or enter it manually.' }) {
  const id = useId()
  const inputRef = useRef(null)
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [status, setStatus] = useState('')
  const selectedRef = useRef(sanitiseUkPostcodeInput(value).trim())
  const query = sanitiseUkPostcodeInput(value).trim()
  const invalid = !!query && !isUkPostcode(query)

  useEffect(() => {
    if (disabled || query === selectedRef.current || !/^[A-Z]/.test(query)) {
      setSuggestions([])
      setOpen(false)
      setStatus('')
      return undefined
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/postcode-suggestions?query=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Postcode suggestions are unavailable.')
        const results = Array.isArray(data.suggestions) ? data.suggestions : []
        setSuggestions(results)
        setOpen(results.length > 0)
        setActive(-1)
        setStatus(results.length ? `${results.length} postcode suggestions available.` : 'No postcode suggestions found.')
      } catch (error) {
        if (!controller.signal.aborted) {
          setSuggestions([])
          setOpen(false)
          setActive(-1)
          setStatus('Postcode suggestions are unavailable. You can keep typing.')
        }
      }
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [disabled, query])

  const choose = postcode => {
    selectedRef.current = postcode
    onChange(postcode)
    setSuggestions([])
    setOpen(false)
    setActive(-1)
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleKeyDown = event => {
    if (!open || !suggestions.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(index => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(index => (index <= 0 ? suggestions.length - 1 : index - 1))
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      choose(suggestions[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  return (
    <div className="postcode-typeahead">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        ref={inputRef}
        type="text"
        role="combobox"
        autoComplete="off"
        inputMode="text"
        maxLength={16}
        placeholder="Start typing your postcode"
        value={value}
        disabled={disabled}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-invalid={invalid}
        aria-describedby={`${id}-help${invalid ? ` ${id}-error` : ''}`}
        aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
        onChange={event => { selectedRef.current = ''; onChange(sanitiseUkPostcodeInput(event.target.value)) }}
        onFocus={() => setOpen(suggestions.length > 0)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <ul id={`${id}-listbox`} className="postcode-typeahead-list" role="listbox">
          {suggestions.map((postcode, index) => (
            <li
              id={`${id}-option-${index}`}
              key={postcode}
              role="option"
              aria-selected={index === active}
              onMouseDown={event => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(postcode)}
            >
              {postcode}
            </li>
          ))}
        </ul>
      )}
      <small id={`${id}-help`}>{helpText}</small>
      {invalid && <small id={`${id}-error`} className="postcode-typeahead-error">Enter a complete UK postcode, for example ST4 3NP.</small>}
      <span className="sr-only" role="status">{status}</span>
    </div>
  )
}
