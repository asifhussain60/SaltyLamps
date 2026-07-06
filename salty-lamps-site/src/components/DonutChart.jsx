import React from 'react'

// color: 'lo' | 'md' | 'hi'
const COLORS = {
  lo: '#c0614e',
  md: '#c9a047',
  hi: '#5a8a58',
}
const TRACK = '#eee'

export default function DonutChart({ pct, label, color = 'lo', size = 100 }) {
  const stroke = COLORS[color]
  const cx = size / 2
  const cy = size / 2
  const r = (size / 2) * 0.85 * 0.8

  // recalculate for this size
  const circ = 2 * Math.PI * r
  const filled = (pct / 100) * circ

  return (
    <div className="donut-item">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
        {/* track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke={TRACK} strokeWidth={size * 0.1}
        />
        {/* fill */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke={stroke} strokeWidth={size * 0.1}
          strokeDasharray={`${filled} ${circ}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        {/* percentage text */}
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          className="donut-pct" style={{ fontSize: size * 0.16, fontFamily: 'Oswald,sans-serif', fontWeight: 600, fill: '#444' }}>
          {pct}%
        </text>
      </svg>
      <div className="donut-label">{label}</div>
    </div>
  )
}
