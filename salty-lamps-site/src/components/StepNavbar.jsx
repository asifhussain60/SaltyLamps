import React from 'react'

export default function StepNavbar({ views, currentPage, setCurrentPage, onToggleNotes, notesOpen }) {
  return (
    <nav
      className="step-navbar"
      role="navigation"
      aria-label="Proposal sections"
      style={{ position: 'relative', justifyContent: 'center' }}
    >
      {/* Centered tabs */}
      {views.map((view) => (
        <button
          key={view.id}
          className={`step-tab${currentPage === view.id ? ' active' : ''}`}
          onClick={() => { setCurrentPage(view.id); document.querySelector('.content-area')?.scrollTo({ top: 0, behavior: 'smooth' }) }}
          aria-current={currentPage === view.id ? 'step' : undefined}
        >
          {view.label}
        </button>
      ))}

      {/* Notes button — absolutely pinned to right so tabs stay centered */}
      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
        <button
          onClick={onToggleNotes}
          title="Open notes &amp; brainstorm board"
          className={`notes-btn${notesOpen ? ' active' : ''}`}
        >
          <span style={{ fontSize: '1.05rem' }}>✏️</span>
          Notes
        </button>
      </div>
    </nav>
  )
}
