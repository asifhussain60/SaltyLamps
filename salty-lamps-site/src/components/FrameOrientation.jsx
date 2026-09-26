import React from 'react'
import { FRAME_ORIENTATIONS } from '../../functions/lib/frame-orientation.mjs'
export default function FrameOrientation({ value, onChange }) {
  return <div className="option-picker" role="group" aria-label="Frame orientation">
    <p className="option-picker-label">Orientation</p>
    <div className="option-choices">{FRAME_ORIENTATIONS.map(choice => <button key={choice} type="button"
      className={value === choice ? 'is-selected' : ''} aria-pressed={value === choice} onClick={() => onChange(choice)}>
      <span>{choice === 'portrait' ? 'Portrait' : 'Landscape'}</span>
    </button>)}</div>
  </div>
}
