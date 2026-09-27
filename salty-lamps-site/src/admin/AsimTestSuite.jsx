import React, { useEffect, useRef, useState } from 'react'
import { ASIM_GROUPS } from './asim-checks.mjs'
import { Confirm, Icon } from './Confirm.jsx'
import { storeHref } from './store-url.mjs'
import '../styles/asim-test-suite.css'

const STORAGE_KEY = 'salty-lamps-asim-tests-v1'
const ALL = ASIM_GROUPS.flatMap(group => group.items)
const LABELS = { works: 'Works', problem: 'Problem', blocked: 'Couldn’t test' }
const fresh = () => ({ version: 1, mode: 'quick', device: 'computer', group: 'basket', open: 'basket-twelve', results: {}, notes: {} })
const recordKey = (device, id) => `${device}:${id}`

function sanitise(value) {
  const state = fresh()
  if (!value || value.version !== 1) return state
  if (['quick', 'full'].includes(value.mode)) state.mode = value.mode
  if (['computer', 'phone'].includes(value.device)) state.device = value.device
  if (ASIM_GROUPS.some(group => group.id === value.group)) state.group = value.group
  if (ALL.some(item => item[0] === value.open)) state.open = value.open
  for (const device of ['computer', 'phone']) for (const item of ALL) {
    const key = recordKey(device, item[0])
    if (Object.hasOwn(LABELS, value.results?.[key])) state.results[key] = value.results[key]
    if (typeof value.notes?.[key] === 'string') state.notes[key] = value.notes[key].slice(0, 3000)
  }
  return state
}

function load() {
  try { return sanitise(JSON.parse(localStorage.getItem(STORAGE_KEY))) } catch { return fresh() }
}

function destination(item) {
  const label = item[5]
  const routes = {
    'Home page': ['/', 'Open home page'], Shop: ['/shop', 'Open shop'],
    'Product page': ['/shop', 'Choose a product'], 'Unavailable product': ['/shop', 'Find an unavailable item'],
    'Gallery and information': ['/gallery', 'Open gallery'], 'Delivery settings': ['/admin/settings/delivery', 'Open delivery settings'],
    Contact: ['/#trade', 'Open contact form'], 'Returns form': ['/refund-request', 'Open returns form'],
    Products: ['/admin/products', 'Open products'], Inventory: ['/admin/inventory', 'Open inventory'],
    Reports: ['/admin/reports', 'Open reports'], Emails: ['/admin/emails', 'Open email previews'],
    'Practice order': ['/admin/orders', 'Choose a practice order'],
  }
  return routes[label] || null
}

function needsSetup(item) {
  return /practice|agreed|prepared|designated/i.test(item[2].join(' ') + item[5])
}

function preparation(group) {
  if (group === 'payment') return 'Ask Asif to confirm practice payments and provide the test order or payment instructions. Do not use a real card for an unconfirmed practice payment.'
  if (group === 'support') return 'Agree the test email address and who will receive the message. For a failed-send check, ask Asif to arrange it on the practice site.'
  if (group === 'delivery') return 'Use confirmed packed weights and courier prices. Ask Asif to prepare an item with missing shipping information for that specific check.'
  if (group === 'manage') return 'Ask Asif which practice product or order to use before changing stock, prices or dispatch details. Restore any agreed temporary changes afterwards.'
  return 'Ask Asif to confirm the correct test address and any practice details first.'
}

export default function AsimTestSuite() {
  const [state, setState] = useState(load)
  const [saved, setSaved] = useState(true)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const summaryRef = useRef(null)
  const group = ASIM_GROUPS.find(item => item.id === state.group)
  const visible = items => items.filter(item => state.mode === 'full' || item[4])
  const checks = visible(ALL)
  const result = id => state.results[recordKey(state.device, id)] || ''
  const done = checks.filter(item => result(item[0])).length
  const progress = Math.round(done / checks.length * 100)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setSaved(true) } catch { setSaved(false) }
  }, [state])

  useEffect(() => {
    const onStorage = event => {
      if (event.key !== STORAGE_KEY) return
      try { setState(sanitise(JSON.parse(event.newValue))) } catch { /* Keep this tab's valid record. */ }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const update = values => setState(previous => ({ ...previous, ...values }))
  const chooseGroup = id => update({ group: id, open: visible(ASIM_GROUPS.find(item => item.id === id).items)[0]?.[0] })
  const chooseMode = mode => update({ mode, open: group.items.find(item => mode === 'full' || item[4])?.[0] })
  const mark = (id, value) => setState(previous => {
    const key = recordKey(previous.device, id)
    return { ...previous, results: { ...previous.results, [key]: previous.results[key] === value ? '' : value } }
  })
  const note = (id, value) => setState(previous => ({ ...previous, notes: { ...previous.notes, [recordKey(previous.device, id)]: value } }))

  const nextCheck = () => {
    const index = checks.findIndex(item => item[0] === state.open)
    const next = [...checks.slice(index + 1), ...checks.slice(0, index + 1)].find(item => !result(item[0]))
    if (!next) { setNotice('Every task in this view has a result. Review any problems or checks you could not complete.'); return }
    const nextGroup = ASIM_GROUPS.find(item => item.items.includes(next))
    update({ group: nextGroup.id, open: next[0] })
    requestAnimationFrame(() => document.getElementById(`asim-${next[0]}`)?.focus())
  }

  const summary = ['Asim Test Suite', `Site: ${window.location.origin}`, 'These are Asim’s recorded results, not automatic checks.', ...['computer', 'phone'].flatMap(device => [
    '', device === 'computer' ? 'COMPUTER' : 'PHONE',
    ...ASIM_GROUPS.flatMap(section => ['', section.name, ...section.items.map(item => {
      const key = recordKey(device, item[0])
      return `${LABELS[state.results[key]] || 'Not checked'} — ${item[1]}${state.notes[key] ? `\n  Note: ${state.notes[key]}` : ''}`
    })]),
  ])].join('\n')

  const copySummary = async () => {
    try { await navigator.clipboard.writeText(summary); setNotice('Review summary copied. You can paste it into your message to Asif.') }
    catch { summaryRef.current?.focus(); summaryRef.current?.select(); setNotice('Select and copy the summary below using your usual copy command.') }
  }
  const downloadSummary = () => {
    const url = URL.createObjectURL(new Blob([summary], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'asim-test-results.txt'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const resetDevice = () => {
    setState(previous => ({ ...previous,
      results: Object.fromEntries(Object.entries(previous.results).filter(([key]) => !key.startsWith(`${previous.device}:`))),
      notes: Object.fromEntries(Object.entries(previous.notes).filter(([key]) => !key.startsWith(`${previous.device}:`))),
    }))
    setResetOpen(false)
    setNotice(`Your ${state.device} review is ready to start again.`)
  }

  return <article className="asim-suite">
    <header className="asim-heading">
      <div><p className="asim-eyebrow">Your shop, ready for customers</p><h2>One simple task at a time.</h2><p className="asim-lead">Try a task. Check what happens. Tell us if anything feels wrong.</p></div>
      <button className="admin-btn" type="button" aria-expanded={summaryOpen} aria-controls="asim-summary" onClick={() => setSummaryOpen(open => !open)}>Review summary</button>
    </header>
    <p className="asim-context">You are checking <strong>{window.location.hostname}</strong>. No technical knowledge is needed.</p>
    <div className="asim-toolbar">
      <section className="asim-choice-section" aria-labelledby="asim-choice-title">
        <h3 id="asim-choice-title">Choose how much to check</h3>
        <div className="asim-mode-choices" role="group" aria-label="Choose your checklist">{[
          ['quick', 'Quick essentials', `Start here. ${ALL.filter(item => item[4]).length} important checks covering the main shopping steps and basic shop tasks.`],
          ['full', 'Full walkthrough', `All ${ALL.length} checks. Includes the quick checks, plus a closer look at products, delivery, payments, messages and managing the shop.`],
        ].map(([value, label, description]) => <button type="button" key={value} aria-labelledby={`asim-mode-${value}`} aria-describedby={`asim-mode-help-${value}`} aria-pressed={state.mode === value} onClick={() => chooseMode(value)}><strong id={`asim-mode-${value}`}>{label}</strong><span id={`asim-mode-help-${value}`}>{description}</span></button>)}</div>
        <p className="asim-help">You can switch between these choices at any time. Your answers and notes will stay.</p>
      </section>
      <section className="asim-device-choice" aria-labelledby="asim-device-title"><h3 id="asim-device-title">What are you testing on?</h3><p className="asim-help" id="asim-device-help">Choose the device you are using to try the shop. Computer and phone answers are kept separately.</p><div className="asim-segment" role="group" aria-label="Device being tested" aria-describedby="asim-device-help">{['computer', 'phone'].map(device => <button type="button" key={device} aria-pressed={state.device === device} onClick={() => update({ device })}>{device === 'computer' ? 'Computer' : 'Phone'}</button>)}</div></section>
    </div>
    <details className="asim-instructions"><summary>New to this? Here’s how to use the checklist</summary><ol><li>Read a task below. Use its button, such as “Open shop”, to open the shop in a separate tab at the top of your browser.</li><li>Follow the steps, then come back to this checklist tab. Compare what you saw with “What should happen” and choose an answer.</li><li>Add a note if you want, then choose “Next unchecked task” to move on. You can stop and return later.</li></ol><p>The shop buttons reuse the same tab, so you can keep using the same basket.</p></details>
    <section className="asim-progress-box" aria-label="Your review progress">
      <div className="asim-progress-heading"><strong>Your {state.device} review</strong><span>{done} of {checks.length} checked</span></div>
      <div className="asim-track" role="progressbar" aria-label="Checks recorded" aria-valuenow={done} aria-valuemin={0} aria-valuemax={checks.length}><div style={{ width: `${progress}%` }} /></div>
      <div className="asim-counts"><span>{checks.filter(item => result(item[0]) === 'works').length} working</span><span>{checks.filter(item => result(item[0]) === 'problem').length} problems</span><span>{checks.filter(item => result(item[0]) === 'blocked').length} couldn’t test</span></div>
    </section>
    <div className="asim-workspace">
      <nav className="asim-journeys" aria-label="What to check"><p className="asim-eyebrow">What to check</p>{ASIM_GROUPS.map(section => <button type="button" key={section.id} aria-pressed={state.group === section.id} onClick={() => chooseGroup(section.id)}><span>{section.name}</span><small>{visible(section.items).filter(item => result(item[0])).length}/{visible(section.items).length}</small></button>)}</nav>
      <section aria-labelledby="asim-chapter-title"><h3 id="asim-chapter-title">{group.name}</h3><p className="asim-caption">{group.caption}</p>
        {visible(group.items).map((item, index) => {
          const [id, title, steps, expected] = item
          const current = result(id)
          const link = destination(item)
          return <details className="asim-case" key={id} open={state.open === id}>
            <summary id={`asim-${id}`} onClick={event => { event.preventDefault(); update({ open: state.open === id ? '' : id }) }}>
              <span className={`asim-dot asim-dot--${current || 'new'}`} aria-label={LABELS[current] || 'Not checked'}>{current === 'works' ? <Icon name="check" size={13} /> : current === 'problem' ? '!' : current === 'blocked' ? '–' : index + 1}</span><span>{title}</span><span className="asim-expand" aria-hidden="true">{state.open === id ? '−' : '+'}</span>
            </summary>
            <div className="asim-case-body">
              {needsSetup(item) && <div className="asim-setup"><strong>Needs setup</strong><p>{preparation(group.id)} If it is not ready, choose “Couldn’t test” and add a note.</p></div>}
              <ol>{steps.map(step => <li key={step}>{step}</li>)}</ol>
              <div className="asim-expect"><strong>What should happen</strong><p>{expected}</p></div>
              {link && <p className="asim-shortcut"><a className="admin-btn" href={storeHref(link[0], window.location.hostname, import.meta.env.VITE_STAGING === '1')} target="asim-test-shop">{link[1]} <Icon name="externalLink" size={13} /></a></p>}
              <p className="asim-answer-prompt">How did it go? Choose one answer.</p>
              <div className="asim-results" role="group" aria-label={`Result for ${title}`}>{Object.entries(LABELS).map(([value, label]) => <button type="button" key={value} aria-labelledby={`asim-answer-${id}-${value}`} aria-describedby={`asim-answer-help-${id}-${value}`} aria-pressed={current === value} onClick={() => mark(id, value)}><strong id={`asim-answer-${id}-${value}`}>{label}</strong><span id={`asim-answer-help-${id}-${value}`}>{{ works: 'It did what the instructions said.', problem: 'Something went wrong or was confusing.', blocked: 'I could not try this or need help.' }[value]}</span></button>)}</div>
              <label className="asim-note">{current === 'problem' ? 'What went wrong? (optional)' : current === 'blocked' ? 'What stopped you? (optional)' : 'Add a note (optional)'}<textarea maxLength={3000} rows={2} placeholder="A few words are enough. Please leave out customer or card details." value={state.notes[recordKey(state.device, id)] || ''} onChange={event => note(id, event.target.value)} /></label>
            </div>
          </details>
        })}
        <div className="asim-next"><button className="admin-btn admin-btn--primary" type="button" onClick={nextCheck}>Next unchecked task <span aria-hidden="true">→</span></button></div>
      </section>
    </div>
    {summaryOpen && <section id="asim-summary" className="asim-summary"><h3>Your review summary</h3><p>This lists your computer and phone answers, including any tasks you have not tried. All {ALL.length} checks are included.</p><p>Choose “Copy summary” to paste it into a message to Asif, or “Download summary” to save a text file on your device. Nothing is sent automatically.</p><div className="asim-summary-actions"><button type="button" className="admin-btn" onClick={copySummary}>Copy summary</button><button type="button" className="admin-btn" onClick={downloadSummary}>Download summary</button></div><label className="asim-note">Review summary text<textarea ref={summaryRef} readOnly rows={12} value={summary} /></label></section>}
    <p className="asim-notice" role="status">{notice}</p>
    <footer className="asim-footer"><div><p role="status">{saved ? 'Saved in this browser.' : 'Browser saving is unavailable. Keep this page open and download your summary.'}</p><p>To continue later, open this page on the same device using the same browser, such as Safari or Chrome. Your answers will not appear automatically on another phone or computer. If you test on both, download a summary from each.</p></div><button type="button" className="admin-btn admin-btn--ghost" onClick={() => setResetOpen(true)}>Start this device again</button></footer>
    <Confirm open={resetOpen} title={`Start the ${state.device} review again?`} message={`This clears only the ${state.device} results and notes saved in this browser. Download your summary first if you want to keep them.`} confirmLabel="Clear this device’s results" danger onConfirm={resetDevice} onCancel={() => setResetOpen(false)} />
  </article>
}
