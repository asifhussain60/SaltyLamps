// Shared building blocks for the in-admin documentation pages (Infrastructure,
// Technical Doc). Deliberately self-contained — no dependency on AdminApp internals —
// so the docs stay decoupled from the rest of the portal.
import React from 'react'

// A labelled diagram. `src` is a Vite-imported SVG URL from docs/diagrams/, so the
// exact same file backs both this page and the Markdown mirror in docs/*.md.
export function Figure({ src, alt, caption }) {
  return (
    <figure className="admin-doc__figure">
      <img src={src} alt={alt} width="940" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

// A coloured aside. tone: 'info' | 'warn' | 'ok'.
export function Callout({ tone = 'info', title, children }) {
  return (
    <div className={`admin-doc__callout admin-doc__callout--${tone}`}>
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </div>
  )
}

// An external link. Always opens in a new tab: these pages are worked through
// while the reader is mid-task, and navigating the admin away from a half-done
// checklist loses their place.
export function Ext({ href, children }) {
  return <a href={href} target="_blank" rel="noreferrer">{children}</a>
}

// ---------------------------------------------------------------------------
// Runbook checklist
//
// A migration is worked through over days, across sittings, often with someone
// else doing a step in between. Ticks are therefore persisted to localStorage
// rather than held in component state — closing the tab must not lose the place.
//
// Storage is per browser, not per user account: the progress is a personal
// working note, not shared state, and putting it in D1 would imply a
// coordination guarantee it does not have.
// ---------------------------------------------------------------------------

const ChecklistContext = React.createContext(null)

function readProgress(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : {}
  } catch {
    // Private browsing, a full quota, or a hand-corrupted value. The runbook is
    // still perfectly usable without persistence, so degrade rather than crash.
    return {}
  }
}

export function Checklist({ storageKey, children }) {
  const [done, setDone] = React.useState(() => readProgress(storageKey))

  React.useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(done))
    } catch {
      /* see readProgress */
    }
  }, [storageKey, done])

  // Phases register their item ids on mount so a phase header can show
  // "3 of 7" without its children having to be enumerated twice.
  const value = React.useMemo(() => ({
    done,
    toggle: id => setDone(prev => ({ ...prev, [id]: !prev[id] })),
    reset: () => setDone({}),
    isDone: id => Boolean(done[id]),
  }), [done])

  return <ChecklistContext.Provider value={value}>{children}</ChecklistContext.Provider>
}

// Resets every tick on the page. Destructive to the reader's progress, so it
// confirms first — a stray click after two days of work would be maddening.
export function ChecklistReset({ label = 'Clear all ticks' }) {
  const ctx = React.useContext(ChecklistContext)
  if (!ctx) return null
  return (
    <button
      type="button"
      className="admin-doc__reset"
      onClick={() => {
        if (window.confirm('Clear every tick on this page? This cannot be undone.')) ctx.reset()
      }}
    >
      {label}
    </button>
  )
}

// One tickable step. `id` must be stable across releases — changing it silently
// un-ticks that step for everyone who had already completed it.
export function Check({ id, children }) {
  const ctx = React.useContext(ChecklistContext)
  const checked = ctx ? ctx.isDone(id) : false
  return (
    <li className={`admin-doc__check${checked ? ' is-done' : ''}`}>
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => ctx?.toggle(id)}
        />
        <span>{children}</span>
      </label>
    </li>
  )
}

export function CheckList({ children }) {
  return <ul className="admin-doc__checks">{children}</ul>
}

// A collapsible phase. `ids` lists the Check ids it contains so the header can
// show progress and a tick when the whole phase is finished.
//
// Open by default only when unfinished: on a return visit the reader wants to
// land on where they got to, not scroll past four completed phases.
export function Phase({ number, title, summary, tone = 'safe', ids = [], children }) {
  const ctx = React.useContext(ChecklistContext)
  const total = ids.length
  const complete = ctx ? ids.filter(id => ctx.isDone(id)).length : 0
  const finished = total > 0 && complete === total

  return (
    <details className={`admin-doc__phase admin-doc__phase--${tone}${finished ? ' is-complete' : ''}`} open={!finished}>
      <summary>
        <span className="admin-doc__phase-num">{finished ? '✓' : number}</span>
        <span className="admin-doc__phase-head">
          <strong>{title}</strong>
          {summary && <em>{summary}</em>}
        </span>
        {total > 0 && (
          <span className="admin-doc__phase-count">{complete} of {total}</span>
        )}
      </summary>
      <div className="admin-doc__phase-body">{children}</div>
    </details>
  )
}

// ---------------------------------------------------------------------------
// Copyable terminal block
// ---------------------------------------------------------------------------

// A block of shell to paste into Terminal. `title` says what it does in plain
// words, because the reader is expected NOT to be able to tell from the code.
export function Console({ title, note, children }) {
  const script = String(children).replace(/\n+$/, '')
  const [copied, setCopied] = React.useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script)
    } catch {
      // Clipboard access can be refused (insecure context, permissions). Falling
      // back to selecting the text lets the reader still copy it by hand rather
      // than being told nothing happened.
      window.getSelection()?.selectAllChildren(document.getElementById(`sh-${title}`))
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="admin-doc__console">
      <div className="admin-doc__console-bar">
        <span className="admin-doc__console-dots"><i /><i /><i /></span>
        <span className="admin-doc__console-title">{title}</span>
        <button type="button" onClick={copy} className="admin-doc__console-copy">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre id={`sh-${title}`}><code>{script}</code></pre>
      {note && <p className="admin-doc__console-note">{note}</p>}
    </div>
  )
}
