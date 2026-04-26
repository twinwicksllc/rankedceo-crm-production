'use client'

// =============================================================================
// Ranking Leaderboard Component
// Shows 1st–5th position with red (target) vs green (competitors) theme
// =============================================================================

import { useOnboardingTheme } from '@/app/get-started/theme-context'

interface LeaderboardEntry {
  rank:         number
  url:          string
  domain:       string
  bestPosition: number | null
  isTarget:     boolean
  badge:        string
}

interface RankingLeaderboardProps {
  entries:   LeaderboardEntry[]
  keyword:   string
  location:  string
}

export function RankingLeaderboard({ entries, keyword, location }: RankingLeaderboardProps) {
  const { theme } = useOnboardingTheme()
  const isLight = theme === 'light'

  return (
    <div>
      {/* Header */}
      <div style={{
        marginBottom:  16,
        padding:       '10px 16px',
        background:    isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)',
        borderRadius:  8,
        border:        isLight ? '1px solid rgba(15,23,42,0.14)' : '1px solid rgba(255,255,255,0.08)',
      }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: isLight ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.5)' }}>
          Google search ranking for
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '0.95rem', fontWeight: 700, color: isLight ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)' }}>
          "{keyword}" · {location}
        </p>
      </div>

      {/* Entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map((entry) => (
          <LeaderboardRow key={entry.url} entry={entry} />
        ))}
      </div>

      {/* Legend */}
      <div style={{
        marginTop:  12,
        display:    'flex',
        gap:        16,
        fontSize:   '0.78rem',
        color:      isLight ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.4)',
      }}>
        <span>🔴 Your site</span>
        <span>🟢 Competitors</span>
        <span>— Not in top 100</span>
      </div>
    </div>
  )
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const { theme } = useOnboardingTheme()
  const isLight = theme === 'light'
  const isTarget  = entry.isTarget
  const hasRank   = entry.bestPosition !== null
  const rankColor = isTarget ? '#EF4444' : '#22C55E'
  const rankBg    = isTarget
    ? 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))'
    : 'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(34,197,94,0.03))'
  const borderColor = isTarget ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.2)'

  return (
    <div style={{
      display:       'flex',
      alignItems:    'center',
      gap:           12,
      padding:       '12px 16px',
      borderRadius:  10,
      background:    rankBg,
      border:        `1px solid ${borderColor}`,
      position:      'relative',
      overflow:      'hidden',
    }}>
      {/* Glow effect for target */}
      {isTarget && (
        <div style={{
          position:   'absolute',
          inset:      0,
          background: 'radial-gradient(ellipse at left, rgba(239,68,68,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Rank badge */}
      <div style={{
        minWidth:       36,
        height:         36,
        borderRadius:   8,
        background:     `${rankColor}20`,
        border:         `1px solid ${rankColor}40`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontSize:       '1.1rem',
        flexShrink:     0,
      }}>
        {entry.badge}
      </div>

      {/* Domain + label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        8,
          flexWrap:   'wrap',
        }}>
          <span style={{
            fontSize:     '0.95rem',
            fontWeight:   700,
            color:        isTarget ? (isLight ? '#DC2626' : '#FCA5A5') : (isLight ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)'),
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            maxWidth:     200,
          }}>
            {entry.domain}
          </span>
          {isTarget && (
            <span style={{
              fontSize:    '0.65rem',
              fontWeight:  700,
              padding:     '1px 6px',
              borderRadius: 4,
              background:  'rgba(239,68,68,0.2)',
              color:       '#EF4444',
              border:      '1px solid rgba(239,68,68,0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Your Site
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.78rem', color: isLight ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.35)', marginTop: 2 }}>
          {entry.url.length > 40 ? entry.url.slice(0, 40) + '…' : entry.url}
        </div>
      </div>

      {/* Google position */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {hasRank ? (
          <>
            <div style={{
              fontSize:   '1.5rem',
              fontWeight: 900,
              color:      rankColor,
              lineHeight: 1,
              textShadow: `0 0 12px ${rankColor}60`,
            }}>
              #{entry.bestPosition}
            </div>
            <div style={{ fontSize: '0.72rem', color: isLight ? 'rgba(15,23,42,0.58)' : 'rgba(255,255,255,0.35)' }}>
              Google
            </div>
          </>
        ) : (
          <div style={{
            fontSize:  '0.85rem',
            color:     isLight ? 'rgba(15,23,42,0.52)' : 'rgba(255,255,255,0.25)',
            fontStyle: 'italic',
          }}>
            Not ranked
          </div>
        )}
      </div>
    </div>
  )
}