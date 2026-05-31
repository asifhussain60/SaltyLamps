import React, { useState } from 'react'
import SiteHeader from './components/SiteHeader.jsx'
import StepNavbar from './components/StepNavbar.jsx'
import FooterNav from './components/FooterNav.jsx'
import NotesPanel from './components/NotesPanel.jsx'
import Cover from './components/views/Cover.jsx'
import DiagnosisView from './components/views/DiagnosisView.jsx'
import Competitors from './components/views/Competitors.jsx'
import DesignView from './components/views/DesignView.jsx'
import GrowthView from './components/views/GrowthView.jsx'
import BuildPlan from './components/views/BuildPlan.jsx'
import Pricing from './components/views/Pricing.jsx'

const VIEWS = [
  { id: 1, label: 'Cover' },
  { id: 2, label: 'Diagnosis' },
  { id: 3, label: 'Strategy' },
  { id: 4, label: 'Design' },
  { id: 5, label: 'Growth' },
  { id: 6, label: 'Roadmap' },
  { id: 7, label: 'Pricing' },
]

const VIEW_COMPONENTS = {
  1: Cover,
  2: DiagnosisView,
  3: Competitors,
  4: DesignView,
  5: GrowthView,
  6: BuildPlan,
  7: Pricing,
}

export default function App() {
  const [currentPage, setCurrentPage] = useState(1)
  const [notesOpen, setNotesOpen]     = useState(false)

  const ActiveView = VIEW_COMPONENTS[currentPage]
  const progressPct = ((currentPage - 1) / (VIEWS.length - 1)) * 100

  return (
    <div className="shell">
      <SiteHeader currentPage={currentPage} />
      <StepNavbar
        views={VIEWS}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        onToggleNotes={() => setNotesOpen(o => !o)}
        notesOpen={notesOpen}
      />
      <div className="progress-strip">
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="content-area">
        <ActiveView currentPage={currentPage} setCurrentPage={setCurrentPage} />
      </div>
      <FooterNav
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        total={VIEWS.length}
      />
      <NotesPanel open={notesOpen} onClose={() => setNotesOpen(false)} />
    </div>
  )
}
