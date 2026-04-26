'use client'

// =============================================================================
// Competitor Card
// Per-competitor breakdown: best position, keyword count, PageSpeed comparison
// =============================================================================

import { useOnboardingTheme } from '@/app/get-started/theme-context'

interface CompetitorMetrics {
  url:             string
  domain:          string
  bestPosition:    number | null
  keywordsRanking: number | null
  topKeywords:     string[]
}

interface PageSpeedComparison {
  targetScore:     number
  competitorScore: number | null  // we only run PageSpeed on target
  targetGrade:     string
}

interface CompetitorCardProps {
  competitor:    CompetitorMetrics
  rank:          number
  targetDomain:  string
  targetScore:   number
  targetGrade:   'A' | 'B' | 'C' | 'D' | 'F'
}

const RANK_COLORS = ['#22C55E', '#16A34A', '#15803D', '#86EFAC']

function getPositionColor(pos: number | null): string {
  if (pos === null) return 'rgba(255,255,255,0.3)'
  if (pos <= 3)   return '#22C55E'
  if (pos <= 10)  return '#84CC16'
  if (pos <= 20)  return '#F59E0B'
  if (pos <= 50)  return '#F97316'
  return '#EF4444'
}

function getPositionLabel(pos: number | null): string {
  if (pos === null) return 'Not Ranked'
  if (pos === 1)  return '#1 on Google'
  if (pos <= 3)   return `Top 3 — #${pos}`
  if (pos <= 10)  return `Page 1 — #${pos}`
  if (pos <= 20)  return `Page 2 — #${pos}`
  return `Position #${pos}`
}

export function CompetitorCard({
  competitor,
  rank,
  targetDomain,
  targetScore,
  targetGrade,
}: CompetitorCardProps) {
  const { theme } = useOnboardingTheme()
  const isLight = theme === 'light'
  const posColor    = getPositionColor(competitor.bestPosition)
  const posLabel    = getPositionLabel(competitor.bestPosition)
  const hasKeywordData = competitor.keywordsRanking !== null
  const keywordsRankingValue = competitor.keywordsRanking ?? 0
  const isBeating   = competitor.bestPosition !== null && competitor.bestPosition <= 10
  const rankColor   = RANK_COLORS[rank - 1] ?? '#22C55E'

  // How much better/worse than target?
  const gap = competitor.bestPosition !== null
    ? 50 - competitor.bestPosition  // rough proxy: higher = better ranked
    : null

  return (
    <div style={{
      background:   isLight
        ? 'linear-gradient(135deg, rgba(34,197,94,0.10) 0%, rgba(15,23,42,0.04) 100%)'
        : 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(0,0,0,0.3) 100%)',
      border:       isLight ? '1px solid rgba(34,197,94,0.26)' : '1px solid rgba(34,197,94,0.2)',
      borderRadius: 12,
      padding:      '16px 18px',
      position:     'relative',
      overflow:     'hidden',
    }}>
      {/* Rank badge */}
      <div style={{
        position:     'absolute',
        top:          12,
        right:        14,
        background:   `${rankColor}20`,
        border:       `1px solid ${rankColor}40`,
        borderRadius: 6,
        padding:      '3px 10px',
        fontSize:     '0.72rem',
        fontWeight:   700,
        color:        rankColor,
        letterSpacing: '0.05em',
      }}>
        COMPETITOR {rank}
      </div>

      {/* Domain */}
      <div style={{ marginBottom: 12, paddingRight: 90 }}>
        <div style={{
          fontSize:   '0.95rem',
          fontWeight: 700,
          color:      isLight ? '#0f172a' : '#ffffff',
          marginBottom: 2,
        }}>
          {competitor.domain}
        </div>
        <div style={{
          fontSize: '0.72rem',
          color:    isLight ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.42)',
          wordBreak: 'break-all',
        }}>
          {competitor.url}
        </div>
      </div>

      {/* Metrics row */}
      <div style={{
        display:   'flex',
        gap:       12,
        flexWrap:  'wrap',
        marginBottom: 12,
      }}>
        {/* Best Google position */}
        <MetricBubble
          label="Best Position"
          value={competitor.bestPosition !== null ? `#${competitor.bestPosition}` : '—'}
          sub={posLabel}
          color={posColor}
          glow
          isLight={isLight}
        />

        {/* Keywords ranking */}
        <MetricBubble
          label="Keywords"
          value={hasKeywordData ? String(keywordsRankingValue) : 'N/A'}
          sub={hasKeywordData ? 'ranking' : 'data unavailable'}
          color="#60A5FA"
          isLight={isLight}
        />

        {/* Threat level */}
        <MetricBubble
          label="Threat"
          value={!hasKeywordData ? 'UNKNOWN' : isBeating ? 'HIGH' : 'LOW'}
          sub={!hasKeywordData ? 'not enough SERP data' : isBeating ? 'Beating you' : 'Not a threat'}
          color={!hasKeywordData ? '#94A3B8' : isBeating ? '#EF4444' : '#22C55E'}
          isLight={isLight}
        />
      </div>

      {/* Top keywords chips */}
      {competitor.topKeywords.length > 0 && (
        <div>
          <div style={{
            fontSize:     '0.7rem',
            color:        isLight ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.45)',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Ranking keywords
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {competitor.topKeywords.slice(0, 4).map((kw, i) => (
              <span
                key={i}
                style={{
                  fontSize:     '0.72rem',
                  color:        isLight ? '#166534' : '#22C55E',
                  background:   isLight ? 'rgba(34,197,94,0.14)' : 'rgba(34,197,94,0.1)',
                  border:       isLight ? '1px solid rgba(34,197,94,0.32)' : '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 4,
                  padding:      '2px 8px',
                }}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {!hasKeywordData && (
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          borderRadius: 7,
          background: isLight ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.12)',
          border: isLight ? '1px solid rgba(59,130,246,0.30)' : '1px solid rgba(59,130,246,0.25)',
          fontSize: '0.75rem',
          color: isLight ? 'rgba(15,23,42,0.78)' : '#BFDBFE',
          lineHeight: 1.4,
        }}>
          Competitor keyword count is unavailable for this scan. This usually means no ranked competitor matches were found for the evaluated keyword set.
        </div>
      )}

      {/* Threat banner */}
      {isBeating && (
        <div style={{
          marginTop:    12,
          padding:      '8px 12px',
          borderRadius: 7,
          background:   'rgba(239,68,68,0.1)',
          border:       '1px solid rgba(239,68,68,0.25)',
          fontSize:     '0.75rem',
          color:        '#FCA5A5',
          display:      'flex',
          alignItems:   'center',
          gap:          6,
        }}>
          <span>⚠️</span>
          <span>
            <strong>{competitor.domain}</strong> ranks above {targetDomain} for key local search terms.
            They are actively stealing your leads.
          </span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricBubble({
  label, value, sub, color, glow = false, isLight,
}: {
  label: string
  value: string
  sub:   string
  color: string
  glow?: boolean
  isLight: boolean
}) {
  return (
    <div style={{
      background:   `${color}12`,
      border:       `1px solid ${color}30`,
      borderRadius: 8,
      padding:      '8px 12px',
      minWidth:     80,
      flex:         '1 1 80px',
    }}>
      <div style={{
        fontSize:   '0.68rem',
        color:      isLight ? 'rgba(15,23,42,0.64)' : 'rgba(255,255,255,0.45)',
        marginBottom: 3,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </div>
      <div style={{
        fontSize:    '1.2rem',
        fontWeight:  800,
        color,
        lineHeight:  1,
        textShadow:  glow ? `0 0 12px ${color}80` : 'none',
        marginBottom: 2,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '0.68rem',
        color:    isLight ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.45)',
      }}>
        {sub}
      </div>
    </div>
  )
}