'use client'

// =============================================================================
// Gap Analysis Component
// Shows missing keywords + ranking gaps with competitor callouts
// =============================================================================

import { useOnboardingTheme } from '@/app/get-started/theme-context'

interface KeywordGap {
  keyword:          string
  competitorDomain: string
  competitorRank:   number
  yourRank:         number | null
  impact:           'critical' | 'warning' | 'info'
  description:      string
}

interface GapAnalysis {
  missingKeywords:  KeywordGap[]
  rankingGaps:      KeywordGap[]
  summary:          string
  opportunityScore: number
}

interface GapAnalysisProps {
  gapAnalysis:    GapAnalysis
  targetDomain:   string
  measuredKeywords?: number
  evaluatedKeywords?: number
}

const IMPACT_CONFIG = {
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', icon: '🚨', label: 'Critical' },
  warning:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', icon: '⚠️', label: 'Warning'  },
  info:     { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)', icon: 'ℹ️', label: 'Info'     },
}

export function GapAnalysis({ gapAnalysis, targetDomain, measuredKeywords = 0, evaluatedKeywords = 0 }: GapAnalysisProps) {
  const { theme } = useOnboardingTheme()
  const isLight = theme === 'light'
  const allGaps = [...gapAnalysis.missingKeywords, ...gapAnalysis.rankingGaps]
  const criticalCount = allGaps.filter(g => g.impact === 'critical').length
  const warningCount  = allGaps.filter(g => g.impact === 'warning').length
  const insufficientRankingData = allGaps.length === 0 && measuredKeywords === 0 && evaluatedKeywords > 0

  return (
    <div>
      {/* Summary bar */}
      <div style={{
        padding:      '14px 16px',
        borderRadius: 10,
        background:   isLight
          ? 'linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.03))'
          : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))',
        border:       isLight ? '1px solid rgba(239,68,68,0.32)' : '1px solid rgba(239,68,68,0.25)',
        marginBottom: 16,
      }}>
        <p style={{
          margin:     0,
          fontSize:   '0.88rem',
          color:      isLight ? 'rgba(15,23,42,0.86)' : 'rgba(255,255,255,0.85)',
          lineHeight: 1.5,
        }}>
          {insufficientRankingData
            ? `${targetDomain} has no ranked keywords (${measuredKeywords}/${evaluatedKeywords}) in this scan, so gap opportunities are currently inconclusive.`
            : gapAnalysis.summary}
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          <StatBadge value={criticalCount} label="Critical Gaps" color="#EF4444" isLight={isLight} />
          <StatBadge value={warningCount}  label="Warnings"      color="#F59E0B" isLight={isLight} />
          <StatBadge value={gapAnalysis.missingKeywords.length} label="Missing Keywords" color="#A78BFA" isLight={isLight} />
          <StatBadge value={gapAnalysis.opportunityScore}       label="Opportunity Score" color="#22C55E" suffix="/100" isLight={isLight} />
        </div>
      </div>

      {/* Missing keywords */}
      {gapAnalysis.missingKeywords.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionHeader
            icon="🎯"
            title="Missing Keywords"
            subtitle={`${targetDomain} doesn't appear in top 100 results for these`}
            color="#EF4444"
            isLight={isLight}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {gapAnalysis.missingKeywords.map((gap, i) => (
              <GapRow key={i} gap={gap} type="missing" isLight={isLight} />
            ))}
          </div>
        </div>
      )}

      {/* Ranking gaps */}
      {gapAnalysis.rankingGaps.length > 0 && (
        <div>
          <SectionHeader
            icon="📉"
            title="Ranking Gaps"
            subtitle="Competitors outranking you for these keywords"
            color="#F59E0B"
            isLight={isLight}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {gapAnalysis.rankingGaps.map((gap, i) => (
              <GapRow key={i} gap={gap} type="gap" isLight={isLight} />
            ))}
          </div>
        </div>
      )}

      {allGaps.length === 0 && (
        <div style={{
          padding:    24,
          textAlign:  'center',
          color:      isLight ? 'rgba(15,23,42,0.58)' : 'rgba(255,255,255,0.48)',
          fontSize:   '0.85rem',
        }}>
          {insufficientRankingData
            ? `Gap analysis needs at least one ranked keyword. Current result: ${measuredKeywords}/${evaluatedKeywords} ranked.`
            : 'No keyword gaps detected for the analyzed keywords.'}
        </div>
      )}
    </div>
  )
}

function GapRow({ gap, type, isLight }: { gap: KeywordGap; type: 'missing' | 'gap'; isLight: boolean }) {
  const cfg = IMPACT_CONFIG[gap.impact]

  return (
    <div style={{
      padding:      '10px 14px',
      borderRadius: 8,
      background:   cfg.bg,
      border:       `1px solid ${cfg.border}`,
      display:      'flex',
      alignItems:   'flex-start',
      gap:          10,
    }}>
      <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
          <span style={{
            fontSize:    '0.8rem',
            fontWeight:  700,
            color:       cfg.color,
            background:  `${cfg.color}15`,
            padding:     '1px 8px',
            borderRadius: 4,
          }}>
            "{gap.keyword}"
          </span>
          {type === 'gap' && gap.yourRank && (
            <span style={{ fontSize: '0.72rem', color: isLight ? 'rgba(15,23,42,0.64)' : 'rgba(255,255,255,0.46)' }}>
              You: #{gap.yourRank} → {gap.competitorDomain}: #{gap.competitorRank}
            </span>
          )}
          {type === 'missing' && (
            <span style={{ fontSize: '0.72rem', color: isLight ? 'rgba(15,23,42,0.64)' : 'rgba(255,255,255,0.46)' }}>
              {gap.competitorDomain} ranks #{gap.competitorRank}
            </span>
          )}
        </div>
        <p style={{
          margin:    0,
          fontSize:  '0.78rem',
          color:     isLight ? 'rgba(15,23,42,0.76)' : 'rgba(255,255,255,0.62)',
          lineHeight: 1.4,
        }}>
          {gap.description}
        </p>
      </div>
    </div>
  )
}

function SectionHeader({
  icon, title, subtitle, color, isLight
}: {
  icon: string; title: string; subtitle: string; color: string; isLight: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span>{icon}</span>
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color }}>{title}</div>
        <div style={{ fontSize: '0.72rem', color: isLight ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.45)' }}>{subtitle}</div>
      </div>
    </div>
  )
}

function StatBadge({
  value, label, color, suffix = '', isLight
}: {
  value: number; label: string; color: string; suffix?: string; isLight: boolean
}) {
  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        6,
      padding:    '4px 10px',
      borderRadius: 6,
      background:  `${color}15`,
      border:      `1px solid ${color}30`,
    }}>
      <span style={{ fontSize: '0.9rem', fontWeight: 800, color }}>{value}{suffix}</span>
      <span style={{ fontSize: '0.7rem', color: isLight ? 'rgba(15,23,42,0.64)' : 'rgba(255,255,255,0.56)' }}>{label}</span>
    </div>
  )
}