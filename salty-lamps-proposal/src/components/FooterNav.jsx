import React from 'react'

function scrollTop() {
  document.querySelector('.content-area')?.scrollTo({ top: 0, behavior: 'smooth' })
}

export default function FooterNav({ currentPage, setCurrentPage, total }) {
  const isFirst = currentPage === 1
  const isLast  = currentPage === total

  return (
    <footer className="footer-nav">
      <button
        className="btn-back"
        disabled={isFirst}
        onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); scrollTop() }}
        aria-label="Previous section"
      >
        &larr; Back
      </button>
      <span className="step-indicator">Step {currentPage} of {total}</span>
      <button
        className="btn-forward"
        disabled={isLast}
        onClick={() => { setCurrentPage(p => Math.min(total, p + 1)); scrollTop() }}
        aria-label="Next section"
      >
        Next &rarr;
      </button>
    </footer>
  )
}
