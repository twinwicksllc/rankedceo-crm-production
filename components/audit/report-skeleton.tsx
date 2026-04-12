'use client'

// =============================================================================
// Report Skeleton
// Animated loading state shown while audit is running (status = 'pending'|'running')
// Uses pulse animations and progress messaging
// =============================================================================

import { useEffect, useState } from 'react'

interface ReportSkeletonProps {
  targetUrl:      string
  competitorUrls: string[]
  status:         'pending' | 'running'
}

const PROGRESS_STEPS = [
  { pct: 5,  label: 'Queuing audit request…',               icon: '📋' },
  { pct: 15, label: 'Checking Google rankings…',            icon: '🔍' },
  { pct: 30, label: 'Scanning top 100 results…',            icon: '📊' },
  { pct: 45, label: 'Analyzing competitor positions…',      icon: '🎯' },
  { pct: 60, label: 'Running PageSpeed analysis…',          icon: '⚡' },
  { pct: 72, label: 'Computing gap analysis…',              icon: '📉' },
  { pct: 82, label: 'Building ranking leaderboard…',        icon: '🏆' },
  { pct: 90, label: 'Generating your report…',              icon: '📄' },
  { pct: 97, label: 'Almost there — finalizing results…',   icon: '✨' },
]

function Shimmer({ width = '100%', height = 20, borderRadius = 6 }: {
  width?: string | number
  height?: number
  borderRadius?: number
}) {
  return (
    <div style={{
      width,
      height,
      borderRadius,
      background:  'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 100%)',
      backgroundSize: '200% 100%',
      animation:   'shimmer 1.8s infinite ease-in-out',
    }} />
  )
}

function ShimmerCard({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{
      background:   'rgba(255,255,255,0.04)',
      border:       '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding:      '20px',
    }}>
      <Shimmer width="40%" height={14} />
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Shimmer key={i} width={`${90 - i * 10}%`} height={12} />
        ))}
      </div>
    </div>
  )
}

export function ReportSkeleton({ targetUrl, competitorUrls, status }: ReportSkeletonProps) {
  const [stepIdx, setStepIdx] = useState(0)
  const [dots,    setDots]    = useState('')

  // Advance progress step every ~3s
  useEffect(() => {
    const id = setInterval(() => {
      setStepIdx(i => Math.min(i + 1, PROGRESS_STEPS.length - 1))
    }, 3_000)
    return () => clearInterval(id)
  }, [])

  // Animate dots
  useEffect(() => {
    const id = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 500)
    return () => clearInterval(id)
  }, [])

  const currentStep = PROGRESS_STEPS[stepIdx]
  const pct         = currentStep.pct

  const targetDomain = (() => {
    try { return new URL(targetUrl).hostname.replace(/^www\./, '') }
    catch { return targetUrl }
  })()

  return (
    <>
      {/* Shimmer keyframes injected inline */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);    opacity: 0.6; }
          50%  { transform: scale(1.15); opacity: 0.2; }
          100% { transform: scale(1);    opacity: 0.6; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* ── Hero status card ─────────────────────────────────────────────── */}
        <div style={{
          background:   'linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(0,0,0,0.4) 100%)',
          border:       '1px solid rgba(37,99,235,0.3)',
          borderRadius: 16,
          padding:      '32px 24px',
          textAlign:    'center',
          marginBottom: 24,
        }}>
          {/* Spinner */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
            <div style={{
              width:        64,
              height:       64,
              borderRadius: '50%',
              border:       '3px solid rgba(37,99,235,0.2)',
              borderTopColor: '#2563EB',
              animation:    'spin-slow 1s linear infinite',
            }} />
            <div style={{
              position:  'absolute',
              inset:     0,
              display:   'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize:  '1.6rem',
            }}>
              {currentStep.icon}
            </div>
          </div>

          <h2 style={{
            margin:     '0 0 8px',
            fontSize:   '1.35rem',
            fontWeight: 800,
            color:      '#ffffff',
          }}>
            Analyzing <span style={{ color: '#60A5FA' }}>{targetDomain}</span>
          </h2>
          <p style={{
            margin:   '0 0 24px',
            fontSize: '0.88rem',
            color:    'rgba(255,255,255,0.5)',
          }}>
            {currentStep.label}{dots}
          </p>

          {/* Progress bar */}
          <div style={{
            background:   'rgba(255,255,255,0.08)',
            borderRadius: 100,
            height:       8,
            overflow:     'hidden',
            maxWidth:     420,
            margin:       '0 auto 10px',
          }}>
            <div style={{
              height:     '100%',
              borderRadius: 100,
              background:  'linear-gradient(90deg, #2563EB, #60A5FA)',
              width:       `${pct}%`,
              transition:  'width 0.8s ease',
              boxShadow:   '0 0 12px rgba(96,165,250,0.6)',
            }} />
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
            {pct}% complete
          </div>

          {/* Step indicators */}
          <div style={{
            display:        'flex',
            justifyContent: 'center',
            gap:            6,
            marginTop:      20,
            flexWrap:       'wrap',
          }}>
            {PROGRESS_STEPS.map((step, i) => (
              <div
                key={i}
                title={step.label}
                style={{
                  width:        8,
                  height:       8,
                  borderRadius: '50%',
                  background:   i <= stepIdx ? '#2563EB' : 'rgba(255,255,255,0.12)',
                  transition:   'background 0.4s ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* ── URLs being analyzed ───────────────────────────────────────────── */}
        <div style={{
          background:   'rgba(255,255,255,0.04)',
          border:       '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding:      '16px 20px',
          marginBottom: 20,
        }}>
          <div style={{
            fontSize:     '0.72rem',
            color:        'rgba(255,255,255,0.4)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            marginBottom:  10,
          }}>
            Scanning
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <UrlRow url={targetUrl} label="Your Site" color="#EF4444" active />
            {competitorUrls.map((url, i) => (
              <UrlRow
                key={i}
                url={url}
                label={`Competitor ${i + 1}`}
                color="#22C55E"
                active={stepIdx >= 3}
              />
            ))}
          </div>
        </div>

        {/* ── Ghost skeleton cards ──────────────────────────────────────────── */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap:                 16,
          marginBottom:        16,
        }}>
          <ShimmerCard rows={4} />
          <ShimmerCard rows={3} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <ShimmerCard rows={5} />
        </div>
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap:                 16,
        }}>
          <ShimmerCard rows={3} />
          <ShimmerCard rows={3} />
          <ShimmerCard rows={3} />
        </div>

        {/* ── Bottom note ───────────────────────────────────────────────────── */}
        <p style={{
          textAlign: 'center',
          fontSize:  '0.78rem',
          color:     'rgba(255,255,255,0.3)',
          marginTop: 24,
        }}>
          This page refreshes automatically. Full audit typically takes 15–30 seconds.
        </p>
      </div>
    </>
  )
}

function UrlRow({
  url, label, color, active,
}: {
  url:    string
  label:  string
  color:  string
  active: boolean
}) {
  const domain = (() => {
    try { return new URL(url).hostname.replace(/^www\./, '') }
    catch { return url }
  })()

  return (
    <div style={{
      display:     'flex',
      alignItems:  'center',
      gap:         10,
      opacity:     active ? 1 : 0.4,
      transition:  'opacity 0.6s ease',
    }}>
      {/* Pulse dot */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width:        10,
          height:       10,
          borderRadius: '50%',
          background:   active ? color : 'rgba(255,255,255,0.2)',
        }} />
        {active && (
          <div style={{
            position:     'absolute',
            inset:        -3,
            borderRadius: '50%',
            border:       `2px solid ${color}`,
            animation:    'pulse-ring 1.5s infinite',
          }} />
        )}
      </div>

      <div>
        <span style={{
          fontSize:   '0.72rem',
          fontWeight: 600,
          color,
          marginRight: 6,
        }}>
          {label}
        </span>
        <span style={{
          fontSize: '0.78rem',
          color:    'rgba(255,255,255,0.55)',
        }}>
          {domain}
        </span>
      </div>

      {active && (
        <span style={{
          marginLeft:  'auto',
          fontSize:    '0.68rem',
          color:       'rgba(255,255,255,0.35)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          scanning…
        </span>
      )}
    </div>
  )
}