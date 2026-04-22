'use client'

// =============================================================================
// Expiry Countdown
// Shows time remaining before audit expires (30-day window)
// Creates urgency to take action / upgrade
// =============================================================================

import { useEffect, useState } from 'react'

interface ExpiryCountdownProps {
  expiresAt: string   // ISO timestamp
  compact?:  boolean  // inline pill vs full banner
}

interface TimeLeft {
  hours:   number
  minutes: number
  seconds: number
  total:   number  // ms remaining
}

function calcTimeLeft(expiresAt: string): TimeLeft {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0 }

  return {
    hours:   Math.floor(diff / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
    total:   diff,
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function ExpiryCountdown({ expiresAt, compact = false }: ExpiryCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calcTimeLeft(expiresAt))

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(calcTimeLeft(expiresAt)), 1_000)
    return () => clearInterval(id)
  }, [expiresAt])

  const expired  = timeLeft.total <= 0
  const critical = !expired && timeLeft.hours < 24
  const warning  = !expired && !critical && timeLeft.hours < 7 * 24

  const accentColor = expired
    ? '#6B7280'
    : critical
      ? '#EF4444'
      : warning
        ? '#F59E0B'
        : '#22C55E'

  // ── Compact pill (used in sticky header) ─────────────────────────────────
  if (compact) {
    return (
      <div style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          6,
        background:   `${accentColor}15`,
        border:       `1px solid ${accentColor}35`,
        borderRadius: 20,
        padding:      '4px 12px',
        fontSize:     '0.75rem',
        color:        accentColor,
        fontWeight:   600,
      }}>
        <span style={{ fontSize: '0.8rem' }}>
          {expired ? '⏰' : critical ? '🔥' : '⏱️'}
        </span>
        {expired
          ? 'Report Expired'
          : `${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}:${pad(timeLeft.seconds)} remaining`
        }
      </div>
    )
  }

  // ── Full banner ────────────────────────────────────────────────────────────
  return (
    <div style={{
      padding:      '16px 20px',
      borderRadius: 12,
      background:   expired
        ? 'rgba(107,114,128,0.1)'
        : `linear-gradient(135deg, ${accentColor}15 0%, rgba(0,0,0,0.2) 100%)`,
      border:       `1px solid ${accentColor}30`,
    }}>
      {expired ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>⏰</div>
          <div style={{
            fontSize:   '0.9rem',
            fontWeight: 700,
            color:      '#9CA3AF',
            marginBottom: 4,
          }}>
            Report Expired
          </div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
            Run a new audit to get a fresh report
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          {/* Left: label */}
          <div>
            <div style={{
              fontSize:     '0.7rem',
              color:        'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom:  4,
            }}>
              {critical ? '🔥 Report expiring soon' : '⏱️ Report access expires in'}
            </div>
            <div style={{
              fontSize:   '0.8rem',
              color:      'rgba(255,255,255,0.55)',
            }}>
              {critical
                ? 'Save your report now before it disappears'
                : 'This free audit report is available for 30 days'
              }
            </div>
          </div>

          {/* Right: clock */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <TimeUnit value={pad(timeLeft.hours)}   label="HRS"  color={accentColor} />
            <Colon color={accentColor} />
            <TimeUnit value={pad(timeLeft.minutes)} label="MIN"  color={accentColor} />
            <Colon color={accentColor} />
            <TimeUnit value={pad(timeLeft.seconds)} label="SEC"  color={accentColor} />
          </div>
        </div>
      )}

      {/* Urgency message */}
      {!expired && critical && (
        <div style={{
          marginTop:    10,
          padding:      '7px 12px',
          borderRadius: 7,
          background:   'rgba(239,68,68,0.12)',
          border:       '1px solid rgba(239,68,68,0.3)',
          fontSize:     '0.75rem',
          color:        '#FCA5A5',
          textAlign:    'center',
        }}>
          ⚠️ Less than 24 hours left — <strong>download your PDF</strong> or{' '}
          <strong>start your campaign</strong> to preserve these results permanently.
        </div>
      )}
    </div>
  )
}

function TimeUnit({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{
      textAlign:  'center',
      background: `${color}15`,
      border:     `1px solid ${color}30`,
      borderRadius: 8,
      padding:    '6px 10px',
      minWidth:   48,
    }}>
      <div style={{
        fontSize:   '1.4rem',
        fontWeight: 800,
        color,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        textShadow: `0 0 16px ${color}60`,
      }}>
        {value}
      </div>
      <div style={{
        fontSize:     '0.6rem',
        color:        'rgba(255,255,255,0.35)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginTop:    2,
      }}>
        {label}
      </div>
    </div>
  )
}

function Colon({ color }: { color: string }) {
  return (
    <div style={{
      fontSize:   '1.2rem',
      fontWeight: 800,
      color,
      opacity:    0.6,
      marginBottom: 10,
    }}>
      :
    </div>
  )
}