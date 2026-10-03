import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LAUNCH_GROUPS, RESULT_LABELS, reviewCounts, reviewText } from '../../functions/lib/launch-review.mjs'
import { dirtyForms } from './navigation.mjs'
import { Icon } from './Confirm.jsx'
import { ownerReviewHref } from './store-url.mjs'
import '../styles/launch-review.css'

const LOCAL_KEY = 'salty-lamps-launch-review-unsaved-v1'
const prettyDate = value => value ? `${new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(value))} EST` : ''
async function requestReview(method = 'GET', body) {
  const res = await fetch('/api/admin/launch-review', { method, credentials: 'include', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  let value
  try { value = await res.json() } catch { throw new Error('Please sign in again, then reload this page. Your unsaved notes remain in this browser.') }
  if (!res.ok) throw new Error(value.error?.message || 'The review could not be saved. Please try again.')
  return value
}
function download(review) {
  const url = URL.createObjectURL(new Blob([reviewText(review)], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = 'asim-salty-lamps-review.txt'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function WelcomeAsim({ compact = false }) {
  if (compact) return <a className="launch-dashboard-link" href="/admin/welcome"><span className="launch-round-icon"><Icon name="check" size={22} /></span><span><strong>Asim, welcome to your new shop.</strong><small>Your welcome page and launch checklist are ready.</small></span><span aria-hidden="true">→</span></a>
  return <article className="launch-page">
    <header className="launch-welcome">
      <div className="launch-welcome-copy"><p className="launch-eyebrow">A new chapter for Salty Lamps</p><span className="launch-pill launch-pill--light"><Icon name="check" size={14} /> Built with care. Ready for your review.</span><h2>Congratulations,<br /><em>Asim.</em></h2><p className="launch-welcome-lead">Your business has a beautiful new home.</p><p>From the glow of your salt lamps to the details behind every order, this shop brings your products and your work together in one place.</p><a className="launch-button launch-button--gold" href="/admin/launch-checklist">Start your launch checklist <span aria-hidden="true">→</span></a><span className="launch-welcome-footnote">Take your time. Your answers and comments are saved as you go.</span></div>
      <div className="launch-welcome-photo"><img src="/media/light-catalogue/natural-small.webp" alt="A Himalayan salt lamp glowing with warm amber light" /><div className="launch-photo-caption"><span>Natural Himalayan rock salt</span><strong>A familiar warmth.<br />A fresh beginning.</strong></div></div>
    </header>
    <section className="launch-introduction"><div><p className="launch-eyebrow">The finishing touch is yours</p><h3>Let’s make sure it feels right.</h3></div><p>We have checked the pages, product information and email delivery. Now we would love you to try the shop as a customer and review it as its owner. Your eye for the little details is what makes this ready for your customers.</p></section>
    <div className="launch-feature-grid">{[
      ['box', 'Your catalogue, together', 'Review the descriptions, pictures, prices, stock and packed weights you have already entered.'],
      ['check', 'One clear step at a time', 'Each check explains what to do and what should happen. Tick a pass, flag a problem or ask for help.'],
      ['send', 'Your feedback reaches us', 'Comments are saved in this protected portal. Submit your review so Asif can see every result and note.'],
    ].map(([icon, title, text], i) => <section className="launch-feature" key={title}><span className="launch-round-icon"><Icon name={icon} size={22} /></span><small>0{i + 1}</small><h3>{title}</h3><p>{text}</p></section>)}</div>
    <aside className="launch-care-note"><Icon name="info" size={22} /><div><strong>A careful final rehearsal</strong><p>The customer site is still restricted while we finish testing. Arrange access and the real payment test with Asif first. Completing this checklist does not open the shop publicly.</p></div></aside>
    <footer className="launch-welcome-close"><h3>Here’s to your next chapter.</h3><p>Thank you for trusting us with Salty Lamps. Let’s get those last details right, together.</p><a className="launch-button" href="/admin/launch-checklist">Begin the checklist <span aria-hidden="true">→</span></a></footer>
  </article>
}

export default function LaunchReview() {
  const [doc, setDoc] = useState(null)
  const latest = useRef(null)
  const inFlight = useRef(false)
  const [reports, setReports] = useState([])
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [device, setDevice] = useState('computer')
  const [groupId, setGroupId] = useState('shop')
  const [view, setView] = useState('checklist')
  const [filter, setFilter] = useState('all')
  const [recoverable, setRecoverable] = useState(null)
  const [reviewNotes, setReviewNotes] = useState({})
  const updateDoc = value => { latest.current = value; setDoc(value) }
  const load = useCallback(async () => {
    setError('')
    try {
      const result = await requestReview()
      latest.current = result.document; setDoc(result.document); setReports(result.reports); setDirty(false)
      try { const cached = JSON.parse(localStorage.getItem(LOCAL_KEY)); if (cached && cached.version === result.document.version && cached.revision === result.document.revision && (JSON.stringify(cached.entries) !== JSON.stringify(result.document.entries) || cached.overall !== result.document.overall)) setRecoverable(cached) } catch { /* Server data remains authoritative. */ }
    } catch (e) { setError(e.message) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!dirty) return
    const token = Symbol(); dirtyForms.add(token)
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => { dirtyForms.delete(token); window.removeEventListener('beforeunload', warn) }
  }, [dirty])
  const edit = values => {
    const next = { ...latest.current, ...values }; updateDoc(next); setDirty(true); setNotice('')
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)) } catch { /* The save warning remains visible. */ }
  }
  const save = useCallback(async (action = 'save', extra = {}) => {
    if (inFlight.current || !latest.current) return
    inFlight.current = true; setBusy(true); setError('')
    const snapshot = latest.current
    try {
      const result = await requestReview('PUT', { action, revision: snapshot.revision, entries: snapshot.entries, overall: snapshot.overall, ...extra })
      const changedWhileSaving = latest.current.entries !== snapshot.entries || latest.current.overall !== snapshot.overall
      const next = changedWhileSaving ? { ...latest.current, revision: result.document.revision, updatedAt: result.document.updatedAt, updatedBy: result.document.updatedBy } : result.document
      latest.current = next; setDoc(next); setDirty(changedWhileSaving)
      try { if (changedWhileSaving) localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); else localStorage.removeItem(LOCAL_KEY) } catch { /* A saved server record is still safe. */ }
      if (result.report) setReports(previous => [result.report, ...previous.filter(r => r.id !== result.report.id)])
      if (action === 'submit') { setView('reviews'); setNotice('Submitted for review. Asif can now see this saved report, including your comments, in this portal.') }
      else if (action === 'review') setNotice('Review response saved. Asim can see it in Submitted reviews.')
    } catch (e) { setError(e.message) }
    finally { inFlight.current = false; setBusy(false) }
  }, [])
  useEffect(() => {
    if (!doc || !dirty || busy || error) return
    const timer = setTimeout(() => save(), 900)
    return () => clearTimeout(timer)
  }, [doc, dirty, busy, error, save])
  if (!doc) return <section className="launch-empty" aria-live="polite"><h2>{error ? 'Let’s reconnect your review.' : 'Opening your checklist…'}</h2><p>{error || 'Loading your saved progress.'}</p>{error && <button className="launch-button" onClick={load}>Try again</button>}</section>
  const counts = reviewCounts(doc.entries)
  const checked = counts.pass + counts.issue + counts.blocked
  const group = LAUNCH_GROUPS.find(g => g.id === groupId)
  const slot = item => `${item.scope === 'shared' ? 'shared' : device}:${item.id}`
  const entry = item => doc.entries[slot(item)] || { result: 'pending', comment: '' }
  const editEntry = (item, values) => edit({ entries: { ...latest.current.entries, [slot(item)]: { ...entry(item), ...values } } })
  const shown = group.items.filter(item => filter === 'all' || (filter === 'attention' ? ['issue', 'blocked'].includes(entry(item).result) : entry(item).result === 'pending'))
  return <article className="launch-page launch-checklist">
    <header className="launch-review-heading"><div><p className="launch-eyebrow">Your final rehearsal</p><h2>Small checks.<br /><em>A confident beginning.</em></h2><p>Follow the steps, tick what works and tell us what needs care.</p></div><a className="launch-text-link" href="/admin/welcome">Asim’s welcome page <span aria-hidden="true">↗</span></a></header>
    <div className="launch-tabs" role="group" aria-label="Review view"><button aria-pressed={view === 'checklist'} onClick={() => setView('checklist')}>Your checklist</button><button aria-pressed={view === 'reviews'} onClick={() => setView('reviews')}>Submitted reviews <span>{reports.filter(r => !r.review).length}</span></button></div>
    <div className="launch-save-line" role="status"><span className={`launch-save-dot ${error ? 'launch-save-dot--error' : ''}`} />{busy ? 'Saving your review…' : dirty ? 'Changes waiting to save' : doc.updatedAt ? `Saved to the portal · ${prettyDate(doc.updatedAt)}` : 'Ready to begin · progress is saved to the portal'}{dirty && <button onClick={() => save()} disabled={busy}>Save now</button>}</div>
    {error && <div className="launch-error" role="alert"><strong>Your latest changes have not been saved.</strong><p>{error}</p><button className="launch-button" onClick={() => save()} disabled={busy}>Retry save</button><button className="launch-button launch-button--outline" onClick={() => download(doc)}>Download my notes</button><button className="launch-button launch-button--outline" onClick={() => { if (window.confirm('Reload the saved review? Download your unsaved notes first; reloading replaces the answers currently on this page.')) load() }}>Reload saved review</button></div>}
    {recoverable && <aside className="launch-care-note"><Icon name="undo" size={22} /><div><strong>Unsaved notes from this browser are available.</strong><p>Restore them to continue, or keep the saved portal version.</p><button className="launch-button" onClick={() => { edit({ entries: recoverable.entries, overall: recoverable.overall }); setRecoverable(null) }}>Restore my notes</button><button className="launch-button launch-button--outline" onClick={() => { setRecoverable(null); localStorage.removeItem(LOCAL_KEY) }}>Keep saved version</button></div></aside>}
    {notice && <p className="launch-notice" role="status">{notice}</p>}
    {view === 'checklist' ? <>
      <section className="launch-progress"><div><span className="launch-eyebrow">Your progress</span><strong>{checked}<small> / {counts.total} results recorded</small></strong><div className="launch-progress-track" role="progressbar" aria-label="Results recorded" aria-valuemin={0} aria-valuemax={counts.total} aria-valuenow={checked}><span style={{ width: `${checked / counts.total * 100}%` }} /></div></div><div className="launch-stat"><strong>{counts.pass}</strong><span>Passed</span></div><div className="launch-stat"><strong>{counts.issue}</strong><span>Problems</span></div><div className="launch-stat"><strong>{counts.blocked}</strong><span>Need help</span></div></section>
      <div className="launch-how"><p><strong>How to use this</strong> Open a task, follow its steps and compare the result. Tick “Passed”, or choose “Problem found” or “Need help”. Add comments whenever useful.</p><p>Shopping checks have separate phone and computer answers. Business, email delivery and payment checks are completed once. Saved answers are shared between your devices and both approved administrators.</p></div>
      <div className="launch-workspace"><nav className="launch-section-nav" aria-label="Checklist sections">{LAUNCH_GROUPS.map((g, i) => {
        const n = g.items.filter(c => doc.entries[`${c.scope === 'shared' ? 'shared' : device}:${c.id}`]?.result && doc.entries[`${c.scope === 'shared' ? 'shared' : device}:${c.id}`].result !== 'pending').length
        return <button key={g.id} aria-pressed={groupId === g.id} onClick={() => setGroupId(g.id)}><span className="launch-section-number">0{i + 1}</span><span>{g.name}<small>{n} of {g.items.length} checked{g.id === 'payment' ? ' · coordinate first' : ''}</small></span><Icon name={g.icon} size={17} /></button>
      })}</nav><section className="launch-tasks"><div className="launch-tasks-head"><div><h3>{group.name}</h3><p>{group.caption}</p></div><div className="launch-device" role="group" aria-label="Device being tested">{['computer', 'phone'].map(d => <button key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{d === 'computer' ? 'Computer' : 'Phone'}</button>)}</div></div>
        <label className="launch-filter">Show <select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All steps</option><option value="pending">Not tested yet</option><option value="attention">Problems & help needed</option></select></label>
        {shown.map((item, i) => { const e = entry(item); return <details className={`launch-task launch-task--${e.result}`} key={`${device}:${item.id}`} open={e.result !== 'pass'}><summary><span className="launch-task-icon">{e.result === 'pass' ? <Icon name="check" size={19} /> : <Icon name={group.icon} size={19} />}</span><span><strong>{item.title}</strong><small>{item.scope === 'shared' ? 'Complete once' : `Testing on ${device}`} · {RESULT_LABELS[e.result]}</small></span><span className="launch-task-caret" aria-hidden="true">+</span></summary><div className="launch-task-body">
          {item.coordinated && <aside className="launch-payment-note"><strong>Arrange this with Asif first.</strong> This uses real money and the real shop. You complete any purchase or refund yourself. If access or the agreed test is not ready, choose “Need help”.</aside>}
          <div className="launch-task-columns"><div><h4>What to do</h4><ol>{item.steps.map(s => <li key={s}>{s}</li>)}</ol></div><div className="launch-expected"><span className="launch-eyebrow">What should happen</span><p>{item.expected}</p></div></div>
          {item.path && <a className="launch-text-link" href={ownerReviewHref(item.path, window.location.hostname)} target="asim-launch-shop" rel="noopener">Open {item.path.startsWith('/admin') ? 'administrator page' : 'shop page'} <Icon name="externalLink" size={14} /></a>}
          <div className="launch-results"><label className="launch-pass"><input type="checkbox" checked={e.result === 'pass'} onChange={event => editEntry(item, { result: event.target.checked ? 'pass' : 'pending' })} />Passed</label>{['issue', 'blocked'].map(status => <button key={status} aria-pressed={e.result === status} onClick={() => editEntry(item, { result: e.result === status ? 'pending' : status })}>{RESULT_LABELS[status]}</button>)}</div>
          <label className="launch-comment">Comment for Asif <span>Optional · no customer, password or card details</span><textarea rows={3} maxLength={1500} placeholder={['issue', 'blocked'].includes(e.result) ? 'What did you try, what happened and which page or product was involved?' : 'Anything you would like us to know?'} value={e.comment} onChange={event => editEntry(item, { comment: event.target.value })} /></label>
        </div></details> })}
        {!shown.length && <p className="launch-empty">No steps in this section match your filter.</p>}
      </section></div>
      <section className="launch-submit"><div><p className="launch-eyebrow">The last word is yours</p><h3>Tell us what needs a little more care.</h3><p>You can submit before every step is finished. Problems and untested checks stay visible for review.</p><label className="launch-comment">Overall comments<textarea rows={3} maxLength={3000} value={doc.overall} placeholder="Your overall impression, questions or anything we should fix before opening…" onChange={e => edit({ overall: e.target.value })} /></label></div><div className="launch-submit-actions"><button className="launch-button" disabled={busy || !!error || checked === 0 && !doc.overall.trim() && !Object.values(doc.entries).some(e => e.comment)} onClick={() => save('submit')}>Submit for review <Icon name="send" size={17} /></button><button className="launch-button launch-button--outline" onClick={() => download(doc)}>Download my results</button><p>Your results and comments will appear in Submitted reviews for Asif and Asim. Nothing is emailed automatically, and submitting does not open the shop.</p></div></section>
    </> : <section className="launch-reports"><div className="launch-tasks-head"><div><h3>Your feedback, ready for review</h3><p>Saved submissions keep the answers and comments as they were when submitted.</p></div><button className="launch-button launch-button--outline" disabled={dirty || busy} onClick={load}>Refresh reports</button></div>{reports.length === 0 ? <div className="launch-empty"><Icon name="inbox" size={32} /><h4>No submissions yet.</h4><p>Record your findings in the checklist, then submit them here.</p></div> : reports.map(r => <details className="launch-report" key={r.id} open={!r.review}><summary><span><strong>{r.review ? 'Reviewed' : 'Awaiting review'}</strong><small>{prettyDate(r.submittedAt)} · {r.submittedBy}</small></span><span>{r.counts.pass} passed · {r.counts.issue} problems · {r.counts.blocked} need help</span></summary><div className="launch-report-body"><p>{r.counts.pending} results not tested at submission. These remain open; a submitted report is not launch approval.</p>{r.document.overall && <blockquote>{r.document.overall}</blockquote>}{LAUNCH_GROUPS.map(g => <section key={g.id}><h4>{g.name}</h4>{g.items.flatMap(c => (c.scope === 'shared' ? ['shared'] : ['computer', 'phone']).map(d => { const e = r.document.entries[`${d}:${c.id}`]; return <div className="launch-report-row" key={`${d}:${c.id}`}><span className={`launch-result-label launch-result-label--${e?.result || 'pending'}`}>{RESULT_LABELS[e?.result || 'pending']}</span><div><strong>{c.title} <small>· {d === 'shared' ? 'once' : d}</small></strong>{e?.comment && <p>{e.comment}</p>}</div></div> }))}</section>)}<button className="launch-button launch-button--outline" onClick={() => download(r.document)}>Download this report</button>{r.review ? <aside className="launch-care-note"><Icon name="check" size={20} /><div><strong>Reviewed by {r.review.reviewedBy} · {prettyDate(r.review.reviewedAt)}</strong><p>{r.review.note || 'Review acknowledged.'}</p></div></aside> : <div className="launch-review-response"><label className="launch-comment">Reviewer’s response<textarea rows={3} maxLength={3000} placeholder="What have we reviewed, what needs fixing and what should Asim test again?" value={reviewNotes[r.id] || ''} onChange={e => setReviewNotes(v => ({ ...v, [r.id]: e.target.value }))} /></label><button className="launch-button" disabled={dirty || busy || !!error} onClick={() => save('review', { reportId: r.id, reviewNote: reviewNotes[r.id] || '' })}>Mark reviewed & save response</button></div>}</div></details>)}</section>}
  </article>
}
