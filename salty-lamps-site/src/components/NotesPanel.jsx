import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Rnd } from 'react-rnd'
import { supabase, hasSupabase } from '../lib/supabase.js'

/* ── Post-it colour palette ─────────────────────────────── */
const COLORS = [
  { id: 'yellow', bg: '#fef9c3', border: '#fde047', text: '#713f12' },
  { id: 'pink',   bg: '#fce7f3', border: '#f9a8d4', text: '#831843' },
  { id: 'blue',   bg: '#dbeafe', border: '#93c5fd', text: '#1e3a8a' },
  { id: 'green',  bg: '#dcfce7', border: '#86efac', text: '#14532d' },
  { id: 'orange', bg: '#ffedd5', border: '#fdba74', text: '#7c2d12' },
  { id: 'purple', bg: '#f3e8ff', border: '#c084fc', text: '#581c87' },
]

const LS_TEXT  = 'sl-notes-text'
const LS_BOARD = 'sl-notes-board'
const loadText  = () => localStorage.getItem(LS_TEXT) || ''
const loadBoard = () => { try { return JSON.parse(localStorage.getItem(LS_BOARD)) || [] } catch { return [] } }

/* ── Supabase API ───────────────────────────────────────── */
async function fetchFromSupabase() {
  if (!supabase) return null
  const [textRes, boardRes] = await Promise.all([
    supabase.from('text_notes').select('content').eq('id', 'default').maybeSingle(),
    supabase.from('board_notes').select('*').order('id'),
  ])
  if (textRes.error && textRes.error.code !== 'PGRST116') throw textRes.error
  if (boardRes.error) throw boardRes.error
  return {
    text:  textRes.data?.content ?? null,
    board: boardRes.data ?? [],
  }
}

async function saveTextToSupabase(content) {
  if (!supabase) return
  const { error } = await supabase.from('text_notes').upsert(
    { id: 'default', content, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  )
  if (error) throw error
}

async function saveBoardToSupabase(notes) {
  if (!supabase) return
  // Delete all existing rows then reinsert — simple and correct at this scale
  const { error: delErr } = await supabase.from('board_notes').delete().gte('id', 0)
  if (delErr) throw delErr
  if (notes.length > 0) {
    const { error: insErr } = await supabase.from('board_notes').insert(
      notes.map(n => ({
        id: n.id, x: n.x, y: n.y,
        width: n.width, height: n.height,
        color: n.color, content: n.text, z: n.z || 1,
      }))
    )
    if (insErr) throw insErr
  }
}

/* ── Sync badge ─────────────────────────────────────────── */
function SyncBadge({ status }) {
  if (!hasSupabase) return null
  const map = {
    loading: { label: 'Loading…', color: '#888' },
    idle:    { label: 'Saved',    color: '#27ae60' },
    saving:  { label: 'Saving…',  color: '#e67e22' },
    error:   { label: 'Offline',  color: '#c0392b' },
  }
  const s = map[status] || map.idle
  return (
    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.75rem', color: s.color, display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  )
}

/* ── Single post-it ─────────────────────────────────────── */
function PostIt({ note, onUpdate, onDelete, onBringToFront }) {
  const color = COLORS.find(c => c.id === note.color) || COLORS[0]
  return (
    <Rnd
      position={{ x: note.x, y: note.y }}
      size={{ width: note.width, height: note.height }}
      minWidth={160} minHeight={100}
      onDragStop={(_, d) => onUpdate(note.id, { x: d.x, y: d.y })}
      onResizeStop={(_, __, ref, ___, pos) => onUpdate(note.id, { width: ref.offsetWidth, height: ref.offsetHeight, ...pos })}
      onMouseDown={() => onBringToFront(note.id)}
      style={{ zIndex: note.z || 1 }}
      cancel=".postit-text"
    >
      <div style={{ width: '100%', height: '100%', background: color.bg, border: `2px solid ${color.border}`, borderRadius: 6, display: 'flex', flexDirection: 'column', boxShadow: '2px 4px 12px rgba(0,0,0,0.15)', overflow: 'hidden', cursor: 'grab' }}>
        <div style={{ background: color.border, padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, cursor: 'grab' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {COLORS.map(c => (
              <button key={c.id} onClick={() => onUpdate(note.id, { color: c.id })} style={{ width: 12, height: 12, borderRadius: '50%', background: c.bg, border: note.color === c.id ? `2px solid ${color.text}` : `1px solid ${c.border}`, cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
          <button onClick={() => onDelete(note.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: color.text, opacity: 0.6, fontWeight: 700, padding: '0 2px' }}>×</button>
        </div>
        <textarea
          className="postit-text"
          defaultValue={note.text}
          onBlur={e => onUpdate(note.id, { text: e.target.value })}
          placeholder="Type your idea…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', padding: '8px 10px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', color: color.text, lineHeight: 1.5, cursor: 'text' }}
        />
      </div>
    </Rnd>
  )
}

/* ── Main panel ─────────────────────────────────────────── */
export default function NotesPanel({ open, onClose }) {
  const [tab, setTab]             = useState('board')
  const [textNotes, setTextNotes] = useState(loadText)
  const [board, setBoard]         = useState(loadBoard)
  const [zCounter, setZCounter]   = useState(100)
  const [syncStatus, setSyncStatus] = useState(hasSupabase ? 'loading' : 'idle')
  // initialized = true ONLY after Supabase data has been fetched (or failed).
  // Save effects are no-ops until then — prevents machine 2 from wiping machine 1's data.
  const [initialized, setInitialized] = useState(!hasSupabase)

  const textTimer  = useRef(null)
  const boardTimer = useRef(null)

  /* Load from Supabase on mount — before any save can fire */
  useEffect(() => {
    if (!hasSupabase) return
    fetchFromSupabase()
      .then(data => {
        if (!data) return
        if (data.text !== null) {
          setTextNotes(data.text)
          localStorage.setItem(LS_TEXT, data.text)
        }
        if (data.board.length > 0) {
          const notes = data.board.map(r => ({
            id: r.id, x: r.x, y: r.y,
            width: r.width, height: r.height,
            color: r.color, text: r.content, z: r.z,
          }))
          setBoard(notes)
          localStorage.setItem(LS_BOARD, JSON.stringify(notes))
          const maxZ = Math.max(...notes.map(n => n.z || 1), 100)
          setZCounter(maxZ + 1)
        }
        setSyncStatus('idle')
      })
      .catch(err => {
        console.error('[NotesPanel] Supabase load failed:', err)
        setSyncStatus('error')
      })
      .finally(() => setInitialized(true)) // unlock saves regardless of outcome
  }, []) // mount only — never re-runs

  /* Persist text notes — guarded by initialized */
  useEffect(() => {
    if (!initialized) return
    localStorage.setItem(LS_TEXT, textNotes)
    if (!hasSupabase) return
    clearTimeout(textTimer.current)
    setSyncStatus('saving')
    textTimer.current = setTimeout(() => {
      saveTextToSupabase(textNotes)
        .then(() => setSyncStatus('idle'))
        .catch(err => { console.error('[NotesPanel] text save failed:', err); setSyncStatus('error') })
    }, 1500)
  }, [textNotes, initialized])

  /* Persist board notes — guarded by initialized */
  useEffect(() => {
    if (!initialized) return
    localStorage.setItem(LS_BOARD, JSON.stringify(board))
    if (!hasSupabase) return
    clearTimeout(boardTimer.current)
    setSyncStatus('saving')
    boardTimer.current = setTimeout(() => {
      saveBoardToSupabase(board)
        .then(() => setSyncStatus('idle'))
        .catch(err => { console.error('[NotesPanel] board save failed:', err); setSyncStatus('error') })
    }, 1500)
  }, [board, initialized])

  /* Board helpers */
  const addNote = useCallback((colorId) => {
    const offset = (board.length % 8) * 24
    setBoard(prev => [...prev, { id: Date.now(), x: 24 + offset, y: 24 + offset, width: 200, height: 160, color: colorId, text: '', z: zCounter }])
    setZCounter(z => z + 1)
  }, [board.length, zCounter])

  const updateNote = useCallback((id, changes) =>
    setBoard(prev => prev.map(n => n.id === id ? { ...n, ...changes } : n)), [])

  const deleteNote = useCallback((id) =>
    setBoard(prev => prev.filter(n => n.id !== id)), [])

  const bringToFront = useCallback((id) => {
    setZCounter(z => {
      const next = z + 1
      setBoard(prev => prev.map(n => n.id === id ? { ...n, z: next } : n))
      return next
    })
  }, [])

  const panelWidth = tab === 'board' ? 660 : 400

  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 998 }} />}

      <div style={{ position: 'fixed', top: 0, right: 0, width: panelWidth, maxWidth: '95vw', height: '100vh', background: '#fff', boxShadow: '-4px 0 32px rgba(0,0,0,0.18)', zIndex: 999, display: 'flex', flexDirection: 'column', transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1), width 0.2s ease' }}>

        {/* Header */}
        <div style={{ background: '#b86040', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ id: 'board', icon: '🗂️', label: 'Board' }, { id: 'notes', icon: '📝', label: 'Notes' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '5px 14px', borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'Oswald, sans-serif', fontSize: '0.9rem', letterSpacing: '0.06em', background: tab === t.id ? '#fff' : 'rgba(255,255,255,0.2)', color: tab === t.id ? '#b86040' : '#fff', transition: 'all 0.15s' }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SyncBadge status={syncStatus} />
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '1.25rem', lineHeight: 1, opacity: 0.8, padding: '2px 6px' }}>✕</button>
          </div>
        </div>

        {/* ── BOARD TAB ─────────────────────────────────── */}
        {tab === 'board' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e8d8cc', background: '#fdf8f5', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.8rem', color: '#888', letterSpacing: '0.08em', marginRight: 4 }}>ADD:</span>
              {COLORS.map(c => (
                <button key={c.id} onClick={() => addNote(c.id)} title={`Add ${c.id} note`} style={{ width: 24, height: 24, borderRadius: 4, background: c.bg, border: `2px solid ${c.border}`, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
              ))}
              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', color: '#bbb' }}>{board.length} note{board.length !== 1 ? 's' : ''}</span>
              {board.length > 0 && (
                <button onClick={() => { if (window.confirm('Clear all notes from the board?')) setBoard([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '0.8rem', padding: 0 }}>Clear all</button>
              )}
            </div>

            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {board.length === 0 && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: '#cbb9af' }}>
                  <span style={{ fontSize: '3rem', marginBottom: 12, opacity: 0.7 }}>🗒️</span>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', letterSpacing: '0.1em' }}>BRAINSTORM BOARD</div>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', marginTop: 6, opacity: 0.8 }}>Click a colour above to add your first post-it</div>
                </div>
              )}
              <div style={{ position: 'absolute', inset: 0, overflow: 'auto', background: 'radial-gradient(circle, #d4b8a8 1px, transparent 1px)', backgroundSize: '24px 24px', backgroundPosition: '12px 12px' }}>
                <div style={{ position: 'relative', width: 1200, height: 900, minWidth: '100%', minHeight: '100%' }}>
                  {board.map(note => (
                    <PostIt key={note.id} note={note} onUpdate={updateNote} onDelete={deleteNote} onBringToFront={bringToFront} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── NOTES TAB ─────────────────────────────────── */}
        {tab === 'notes' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px 6px', borderBottom: '1px solid #e8d8cc', background: '#fdf8f5', flexShrink: 0 }}>
              <div style={{ fontSize: '0.8rem', color: '#b86040', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em' }}>
                PROPOSAL NOTES · {hasSupabase ? 'synced to Supabase' : 'saved to this browser'}
              </div>
            </div>
            <textarea
              value={textNotes}
              onChange={e => setTextNotes(e.target.value)}
              placeholder={"Jot down questions, observations, or action items…"}
              style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', padding: '16px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem', color: '#333', lineHeight: 1.7, background: '#fff' }}
            />
            <div style={{ padding: '6px 16px', borderTop: '1px solid #eee', fontSize: '0.8rem', color: '#aaa', display: 'flex', justifyContent: 'space-between', background: '#fafafa', flexShrink: 0 }}>
              <span>{textNotes.length} characters</span>
              <button onClick={() => { if (window.confirm('Clear all notes?')) setTextNotes('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '0.8rem', padding: 0 }}>Clear</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
