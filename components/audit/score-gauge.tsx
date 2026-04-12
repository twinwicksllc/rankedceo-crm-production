'use client'

// =============================================================================
// Score Gauge Component
// Large visual grade display — A/B/C/D/F with color coding
// =============================================================================

interface ScoreGaugeProps {
  score: number       // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  label?: string
  size?: 'sm' | 'md' | 'lg'
  showScore?: boolean
}

const GRADE_CONFIG = {
  A: { color: '#16A34A', bg: 'rgba(22,163,74,0.12)',  ring: '#16A34A', label: 'Excellent' },
  B: { color: '#2563EB', bg: 'rgba(37,99,235,0.12)',  ring: '#2563EB', label: 'Good'      },
  C: { color: '#D97706', bg: 'rgba(217,119,6,0.12)',  ring: '#D97706', label: 'Average'   },
  D: { color: '#EA580C', bg: 'rgba(234,88,12,0.12)',  ring: '#EA580C', label: 'Poor'      },
  F: { color: '#DC2626', bg: 'rgba(220,38,38,0.12)',  ring: '#DC2626', label: 'Critical'  },
}

const SIZE_CONFIG = {
  sm: { outer: 80,  inner: 56,  fontSize: 28, labelSize: '0.65rem' },
  md: { outer: 120, inner: 84,  fontSize: 42, labelSize: '0.75rem' },
  lg: { outer: 160, inner: 112, fontSize: 56, labelSize: '0.85rem' },
}

export function ScoreGauge({ score, grade, label, size = 'md', showScore = true }: ScoreGaugeProps) {
  const cfg  = GRADE_CONFIG[grade]
  const dims = SIZE_CONFIG[size]

  // SVG arc for circular progress
  const radius      = (dims.outer / 2) - 8
  const circumference = 2 * Math.PI * radius
  const progress    = (score / 100) * circumference
  const dashOffset  = circumference - progress

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: dims.outer, height: dims.outer }}>
        {/* SVG ring */}
        <svg
          width={dims.outer}
          height={dims.outer}
          style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
        >
          {/* Background ring */}
          <circle
            cx={dims.outer / 2}
            cy={dims.outer / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={8}
          />
          {/* Progress ring */}
          <circle
            cx={dims.outer / 2}
            cy={dims.outer / 2}
            r={radius}
            fill="none"
            stroke={cfg.ring}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out', filter: `drop-shadow(0 0 6px ${cfg.ring})` }}
          />
        </svg>

        {/* Center content */}
        <div style={{
          position:       'absolute',
          top:            '50%',
          left:           '50%',
          transform:      'translate(-50%, -50%)',
          width:          dims.inner,
          height:         dims.inner,
          borderRadius:   '50%',
          background:     cfg.bg,
          border:         `2px solid ${cfg.ring}30`,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{
            fontSize:   dims.fontSize,
            fontWeight: 900,
            color:      cfg.color,
            lineHeight: 1,
            textShadow: `0 0 20px ${cfg.color}60`,
          }}>
            {grade}
          </span>
          {showScore && (
            <span style={{ fontSize: '0.65rem', color: cfg.color, opacity: 0.8, marginTop: 2 }}>
              {score}/100
            </span>
          )}
        </div>
      </div>

      {/* Label */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize:     dims.labelSize,
          fontWeight:   700,
          color:        cfg.color,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          {cfg.label}
        </div>
        {label && (
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {label}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mini score pill for inline use
// ---------------------------------------------------------------------------
export function ScorePill({
  score,
  grade,
}: {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
}) {
  const cfg = GRADE_CONFIG[grade]
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           6,
      padding:       '3px 10px',
      borderRadius:  20,
      background:    cfg.bg,
      border:        `1px solid ${cfg.ring}40`,
      fontSize:      '0.8rem',
      fontWeight:    700,
      color:         cfg.color,
    }}>
      <span>{grade}</span>
      <span style={{ opacity: 0.7 }}>{score}</span>
    </span>
  )
}