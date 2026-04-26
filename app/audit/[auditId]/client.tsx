'use client'

// =============================================================================
// Audit Report Client Component
// Handles polling, renders full "Boardroom Ready" dashboard
// Red = Your Site | Green = RankedCEO Benchmark / Top Competitors
// =============================================================================

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  buildGetStartedUrl,
  getAuditFunnelProperties,
  getGetStartedBaseUrl,
} from '@/lib/analytics/audit-funnel'
import { trackEvent } from '@/lib/analytics/track-event'
import type { AuditReportData } from '@/lib/waas/types'
import type { WaasAuditRow as WaasAudit } from '@/lib/waas/supabase'
import { ScoreGauge }          from '@/components/audit/score-gauge'
import { RankingLeaderboard }  from '@/components/audit/ranking-leaderboard'
import { GapAnalysis }         from '@/components/audit/gap-analysis'
import { CompetitorCard }      from '@/components/audit/competitor-card'
import { ExpiryCountdown }     from '@/components/audit/expiry-countdown'
import { ReportSkeleton }      from '@/components/audit/report-skeleton'
import { ManualAuditState }    from '@/components/audit/manual-audit-state'
import { BuyNowCta }           from '@/components/audit/buy-now-cta'
import { EmailCaptureForm }    from '@/components/audit/email-capture-form'
import { AdvantagePointHeader } from '@/components/advantagepoint/header'
import { OnboardingThemeProvider, useOnboardingTheme } from '@/app/get-started/theme-context'

// ---------------------------------------------------------------------------
// Types (extended report_data shape from audit-engine.ts)
// ---------------------------------------------------------------------------

interface ExtendedReportData extends AuditReportData {
  leaderboard?:      LeaderboardEntry[]
  gap_analysis?:     GapAnalysis
  grade?:            'A' | 'B' | 'C' | 'D' | 'F'
  page_speed_full?:  PageSpeedFull
  keywords_used?:    string[]
}

interface LeaderboardEntry {
  rank:         number
  url:          string
  domain:       string
  bestPosition: number | null
  isTarget:     boolean
  badge:        string
}

interface GapAnalysis {
  missingKeywords:  KeywordGap[]
  rankingGaps:      KeywordGap[]
  summary:          string
  opportunityScore: number
}

interface KeywordGap {
  keyword:          string
  competitorDomain: string
  competitorRank:   number
  yourRank:         number | null
  impact:           'critical' | 'warning' | 'info'
  description:      string
}

interface PageSpeedFull {
  mobile: {
    lcp:  number
    fid:  number
    cls:  number
    ttfb: number
    categoryScores: {
      performance:   { score: number; grade: string }
      seo:           { score: number; grade: string }
      accessibility: { score: number; grade: string }
      bestPractices: { score: number; grade: string }
    }
    opportunities: Array<{ id: string; title: string; impact: string; savings_ms: number }>
    diagnostics:   Array<{ id: string; title: string; description: string }>
  }
  desktop: {
    lcp:  number
    fid:  number
    cls:  number
    ttfb: number
    categoryScores: {
      performance:   { score: number; grade: string }
      seo:           { score: number; grade: string }
      accessibility: { score: number; grade: string }
      bestPractices: { score: number; grade: string }
    }
    opportunities: Array<{ id: string; title: string; impact: string; savings_ms: number }>
    diagnostics:   Array<{ id: string; title: string; description: string }>
  }
  overallScore: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#22C55E'
    case 'B': return '#3B82F6'
    case 'C': return '#F59E0B'
    case 'D': return '#F97316'
    default:  return '#EF4444'
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22C55E'
  if (score >= 65) return '#84CC16'
  if (score >= 50) return '#F59E0B'
  if (score >= 35) return '#F97316'
  return '#EF4444'
}

const POLL_INTERVAL_MS = 4_000
const POLL_MAX_ATTEMPTS = 45  // ~3 minutes max

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface AuditReportClientProps {
  audit: WaasAudit
}

function AuditReportClientContent({ audit: initialAudit }: AuditReportClientProps) {
  const [audit,    setAudit]    = useState<WaasAudit>(initialAudit)
  const [attempts, setAttempts] = useState(0)
  const dataUnavailableTracked = useRef(false)

  const isRunning  = audit.status === 'pending' || audit.status === 'running'
  const isComplete = audit.status === 'completed'
  const isFailed   = audit.status === 'failed'
  const isExpired  = audit.status === 'expired'
  const isManual   = audit.manual_review === true
  const reportData = audit.report_data as ExtendedReportData | null
  const isDataUnavailable = reportData?.data_unavailable === true

  useEffect(() => {
    if (!isDataUnavailable || dataUnavailableTracked.current !== false) return

    const searchParams = new URLSearchParams(window.location.search)
    trackEvent('audit_data_unavailable_fallback_shown', {
      ...getAuditFunnelProperties(searchParams, audit.id),
      status: audit.status,
      manualReview: audit.manual_review,
      reason: reportData?.data_unavailable_reason ?? 'unknown',
    })

    dataUnavailableTracked.current = true
  }, [isDataUnavailable, audit.id, audit.status, audit.manual_review, reportData?.data_unavailable_reason])

  // ── Polling ──────────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    try {
      const res  = await fetch(`/api/waas/audits/${audit.id}/status`)
      if (!res.ok) return
      const data = await res.json()
      if (data.status) {
        setAudit(prev => ({ ...prev, ...data }))
      }
    } catch {
      // silently retry
    }
  }, [audit.id])

  useEffect(() => {
    if (!isRunning) return
    if (attempts >= POLL_MAX_ATTEMPTS) return

    const id = setTimeout(async () => {
      await poll()
      setAttempts(a => a + 1)
    }, POLL_INTERVAL_MS)

    return () => clearTimeout(id)
  }, [isRunning, attempts, poll])

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isRunning) {
    return (
      <PageShell>
        <ReportSkeleton
          targetUrl={audit.target_url}
          competitorUrls={audit.competitor_urls}
          status={audit.status as 'pending' | 'running'}
        />
      </PageShell>
    )
  }

  if (isDataUnavailable) {
    return (
      <PageShell>
        <ManualAuditState
          targetUrl={audit.target_url}
          auditId={audit.id}
          errorMessage={reportData?.data_unavailable_reason ?? audit.error_message}
          badgeLabel="Concierge Queue Active"
          title="High Traffic: Manual Review Queued"
          subtitle={`We're seeing elevated scan traffic right now, so ${extractDomain(audit.target_url)} has been routed to our concierge audit queue. A strategist is already assigned and your full report will arrive within 1 business day.`}
        />
      </PageShell>
    )
  }

  // ── Manual review / failed ────────────────────────────────────────────────
  if (isFailed || (isComplete && isManual && !audit.report_data)) {
    return (
      <PageShell>
        <ManualAuditState
          targetUrl={audit.target_url}
          auditId={audit.id}
          errorMessage={audit.error_message}
        />
      </PageShell>
    )
  }

  // ── Expired ──────────────────────────────────────────────────────────────
  if (isExpired) {
    return (
      <PageShell>
        <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center', padding: '0 16px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⏰</div>
          <h2 style={{ color: '#9CA3AF', margin: '0 0 12px', fontSize: '1.5rem' }}>
            Report Expired
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>
            This audit report has expired. Run a new audit to get fresh data.
          </p>
          <a
            href="/"
            style={{
              display:        'inline-block',
              padding:        '12px 28px',
              background:     'linear-gradient(135deg, #2563EB, #1D4ED8)',
              color:          '#ffffff',
              textDecoration: 'none',
              borderRadius:   10,
              fontWeight:     700,
            }}
          >
            Run New Audit →
          </a>
        </div>
      </PageShell>
    )
  }

  // ── No report data (edge case) ────────────────────────────────────────────
  if (!audit.report_data) {
    return (
      <PageShell>
        <ManualAuditState
          targetUrl={audit.target_url}
          auditId={audit.id}
          errorMessage="Report data unavailable."
        />
      </PageShell>
    )
  }

  // ── Full report ───────────────────────────────────────────────────────────
  return (
    <PageShell auditId={audit.id} expiresAt={audit.expires_at}>
      <FullReport audit={audit} />
    </PageShell>
  )
}

export function AuditReportClient({ audit }: AuditReportClientProps) {
  return (
    <OnboardingThemeProvider>
      <AuditReportClientContent audit={audit} />
    </OnboardingThemeProvider>
  )
}

// ---------------------------------------------------------------------------
// Full Report (completed audit)
// ---------------------------------------------------------------------------

function FullReport({ audit }: { audit: WaasAudit }) {
  const { theme } = useOnboardingTheme()
  const isLight = theme === 'light'
  const report       = audit.report_data as ExtendedReportData
  const targetDomain = extractDomain(audit.target_url)
  const summary      = report.summary
  const grade        = report.grade ?? 'F'
  const score        = summary?.overall_score ?? 0
  const leaderboard  = report.leaderboard ?? []
  const gapAnalysis  = report.gap_analysis
  const pageSpeed    = report.page_speed_full
  const keywords     = report.keywords_used ?? []
  const competitors  = audit.competitor_urls ?? []

  const primaryKeyword = keywords[0] ?? 'your industry'

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px 60px', color: isLight ? '#0f172a' : '#ffffff' }}>

      {/* ── HERO SECTION ──────────────────────────────────────────────────── */}
      <HeroSection
        targetDomain={targetDomain}
        targetUrl={audit.target_url}
        score={score}
        grade={grade}
        keyword={primaryKeyword}
        completedAt={audit.completed_at}
      />

      {/* ── LEADERBOARD ───────────────────────────────────────────────────── */}
      {leaderboard.length > 0 && (
        <Section title="🏆 Google Ranking Leaderboard" subtitle={`Who dominates "${primaryKeyword}" in your area`}>
          <RankingLeaderboard
            entries={leaderboard}
            keyword={primaryKeyword}
            location={audit.location_detected ?? 'your area'}
          />
        </Section>
      )}

      {/* ── SCORE BREAKDOWN ───────────────────────────────────────────────── */}
      {summary && (
        <Section title="📊 SEO Score Breakdown" subtitle="How your site performs across key ranking factors">
          <ScoreBreakdown summary={summary} grade={grade} />
        </Section>
      )}

      {/* ── KEYWORD PERFORMANCE ───────────────────────────────────────────── */}
      {summary && (summary.top_search_result || summary.bottom_search_result || summary.mean_position !== null) && (
        <Section title="🔎 Keyword Performance" subtitle="Best term, weakest term, and average position across the top 5 keywords">
          <KeywordPerformancePanel summary={summary} />
        </Section>
      )}

      {/* ── PAGE SPEED ────────────────────────────────────────────────────── */}
      {pageSpeed && (
        <Section title="⚡ Page Speed Analysis" subtitle="Speed kills — or converts. Here's where you stand.">
          <PageSpeedSection pageSpeed={pageSpeed} targetDomain={targetDomain} />
        </Section>
      )}

      {/* ── GAP ANALYSIS ──────────────────────────────────────────────────── */}
      {gapAnalysis && (
        <Section title="🎯 Competitor Gap Analysis" subtitle="Keywords your competitors are using to steal your leads">
          <GapAnalysis gapAnalysis={gapAnalysis} targetDomain={targetDomain} />
        </Section>
      )}

      {/* ── COMPETITOR BREAKDOWN ──────────────────────────────────────────── */}
      {competitors.length > 0 && (
        <Section title="🔎 Competitor Deep Dive" subtitle="Individual breakdown of each competitor site">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {competitors.map((url, i) => {
              const domain   = extractDomain(url)
              const lbEntry  = leaderboard.find(e => !e.isTarget && e.domain === domain)
              const compData = report.competitors?.find(c => c.url === url || c.domain === domain)

              return (
                <CompetitorCard
                  key={i}
                  rank={i + 1}
                  competitor={{
                    url,
                    domain,
                    bestPosition:    lbEntry?.bestPosition ?? null,
                    keywordsRanking: compData?.keywords_ranking ?? 0,
                    topKeywords:     compData?.top_keywords ?? (lbEntry?.bestPosition ? [primaryKeyword] : []),
                  }}
                  targetDomain={targetDomain}
                  targetScore={score}
                  targetGrade={grade}
                />
              )
            })}
          </div>
        </Section>
      )}

      {/* ── TECHNICAL ISSUES ──────────────────────────────────────────────── */}
      {report.technical_issues && report.technical_issues.length > 0 && (
        <Section title="🔧 Technical Issues" subtitle="Issues found that impact your search rankings">
          <TechnicalIssues issues={report.technical_issues} />
        </Section>
      )}

      {/* ── OPPORTUNITIES ─────────────────────────────────────────────────── */}
      {report.opportunities && report.opportunities.length > 0 && (
        <Section title="💡 Top Opportunities" subtitle="Highest-impact actions to improve your rankings fast">
          <Opportunities opportunities={report.opportunities} />
        </Section>
      )}

      {/* ── EXPIRY COUNTDOWN ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <ExpiryCountdown expiresAt={audit.expires_at} />
      </div>

      {/* ── BUY NOW CTA ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <BuyNowCta
          auditId={audit.id}
          targetDomain={targetDomain}
          score={score}
          grade={grade}
        />
      </div>

      {/* ── PDF DOWNLOAD ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <EmailCaptureForm
          auditId={audit.id}
          targetDomain={targetDomain}
        />
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <ReportFooter auditId={audit.id} completedAt={audit.completed_at} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hero Section
// ---------------------------------------------------------------------------

function HeroSection({
  targetDomain, targetUrl, score, grade, keyword, completedAt,
}: {
  targetDomain: string
  targetUrl:    string
  score:        number
  grade:        'A' | 'B' | 'C' | 'D' | 'F'
  keyword:      string
  completedAt:  string | null
}) {
  const { theme } = useOnboardingTheme()
  const isLight = theme === 'light'
  const gradeColor = getGradeColor(grade)
  const scoreColor = getScoreColor(score)
  const isUrgent   = score < 50

  return (
    <div style={{
      background:   isLight
        ? 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(14,165,233,0.08) 60%, rgba(16,185,129,0.06) 100%)'
        : 'linear-gradient(135deg, rgba(15,15,25,0.97) 0%, rgba(37,99,235,0.12) 60%, rgba(239,68,68,0.08) 100%)',
      border:       isLight ? '1px solid rgba(51,65,85,0.15)' : '1px solid rgba(255,255,255,0.1)',
      borderRadius: 16,
      padding:      'clamp(20px, 4vw, 36px)',
      marginBottom: 24,
      position:     'relative',
      overflow:     'hidden',
    }}>
      {/* Subtle grid background */}
      <div style={{
        position:   'absolute',
        inset:      0,
        opacity:    isLight ? 0.05 : 0.03,
        backgroundImage: isLight
          ? 'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(15,23,42,0.18) 40px, rgba(15,23,42,0.18) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(15,23,42,0.18) 40px, rgba(15,23,42,0.18) 41px)'
          : 'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.5) 40px, rgba(255,255,255,0.5) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.5) 40px, rgba(255,255,255,0.5) 41px)',
        pointerEvents: 'none',
      }} />

      {/* RankedCEO branding */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'flex-start',
        marginBottom:   24,
        flexWrap:       'wrap',
        gap:            12,
      }}>
        <div style={{
          fontSize:     '0.75rem',
          color:        isLight ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight:   600,
        }}>
          RankedCEO · Surface Audit Report
        </div>
        {completedAt && (
          <div style={{
            fontSize: '0.72rem',
            color:    isLight ? 'rgba(15,23,42,0.4)' : 'rgba(255,255,255,0.3)',
          }}>
            Generated {new Date(completedAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: 'numeric', minute: '2-digit',
            })}
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{
        display:     'flex',
        alignItems:  'flex-start',
        gap:         'clamp(16px, 4vw, 32px)',
        flexWrap:    'wrap',
      }}>
        {/* Score gauge */}
        <div style={{ flexShrink: 0 }}>
          <ScoreGauge score={score} grade={grade} size="lg" />
        </div>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{
            fontSize:     '0.72rem',
            color:        '#60A5FA',
            fontWeight:   700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 8,
          }}>
            SEO Audit Report
          </div>

          <h1 style={{
            margin:     '0 0 8px',
            fontSize:   'clamp(1.3rem, 4vw, 2rem)',
            fontWeight: 800,
            color:      isLight ? '#0f172a' : '#ffffff',
            lineHeight: 1.2,
          }}>
            <span style={{ color: '#EF4444' }}>{targetDomain}</span>
            {' '}vs. Competitors
          </h1>

          <p style={{
            margin:     '0 0 16px',
            fontSize:   '0.9rem',
            color:      'rgba(255,255,255,0.55)',
            lineHeight: 1.5,
          }}>
            Google ranking analysis for{' '}
            <em style={{ color: 'rgba(255,255,255,0.7)' }}>"{keyword}"</em>
            {' '}and related local searches.
          </p>

          {/* Score pill row */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <ScorePill
              label="Overall Score"
              value={`${score}/100`}
              color={scoreColor}
              glow
            />
            <ScorePill
              label="Grade"
              value={grade}
              color={gradeColor}
            />
            {isUrgent && (
              <div style={{
                padding:      '4px 12px',
                background:   'rgba(239,68,68,0.15)',
                color:      isLight ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.55)',
                borderRadius: 20,
                fontSize:     '0.72rem',
                fontWeight:   600,
                display:      'flex',
                alignItems:   'center',
                gap:          5,
              }}>
                <span>⚠️</span>
                <span>Urgent: Action needed</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Target URL */}
      <div style={{
        marginTop:    20,
        padding:      '10px 14px',
        background:   'rgba(239,68,68,0.08)',
        border:       '1px solid rgba(239,68,68,0.2)',
        borderRadius: 8,
        display:      'flex',
        alignItems:   'center',
        gap:          8,
      }}>
        <span style={{
          fontSize:   '0.68rem',
          fontWeight: 700,
          color:      '#EF4444',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          flexShrink: 0,
        }}>
          Target
        </span>
        <span style={{
          fontSize:  '0.82rem',
          color:     'rgba(255,255,255,0.55)',
          wordBreak: 'break-all',
        }}>
          {targetUrl}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score Breakdown
// ---------------------------------------------------------------------------

function ScoreBreakdown({ summary, grade }: {
  summary: NonNullable<AuditReportData['summary']>
  grade:   string
}) {
  const metrics = [
    { label: 'Overall SEO Score',  value: summary.overall_score,       icon: '🏆', weight: 'Primary'   },
    { label: 'Performance',        value: summary.performance_score,    icon: '⚡', weight: '40% weight' },
    { label: 'SEO',                value: summary.seo_score,            icon: '🔍', weight: '30% weight' },
    { label: 'Mobile',             value: summary.mobile_score,         icon: '📱', weight: '20% weight' },
    { label: 'Accessibility',      value: summary.accessibility_score,  icon: '♿', weight: '10% weight' },
  ]

  return (
    <div style={{
      display:             'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap:                 12,
    }}>
      {metrics.map(({ label, value, icon, weight }, i) => {
        const color = getScoreColor(value)
        const isPrimary = i === 0
        return (
          <div
            key={label}
            style={{
              background:   isPrimary
                ? `linear-gradient(135deg, ${color}20, rgba(0,0,0,0.3))`
                : 'rgba(255,255,255,0.04)',
              border:       `1px solid ${isPrimary ? color + '40' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 12,
              padding:      '16px',
              textAlign:    'center',
            }}
          >
            <div style={{ fontSize: '1.4rem', marginBottom: 8 }}>{icon}</div>
            <div style={{
              fontSize:   isPrimary ? '2rem' : '1.6rem',
              fontWeight: 800,
              color,
              lineHeight: 1,
              textShadow: isPrimary ? `0 0 20px ${color}60` : 'none',
              marginBottom: 6,
            }}>
              {value}
            </div>
            <div style={{
              fontSize:   '0.75rem',
              fontWeight: 600,
              color:      'rgba(255,255,255,0.7)',
              marginBottom: 3,
            }}>
              {label}
            </div>
            <div style={{
              fontSize: '0.65rem',
              color:    'rgba(255,255,255,0.3)',
            }}>
              {weight}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatPosition(position: number | null | undefined): string {
  if (position === null || position === undefined) return 'Not ranked'
  return position >= 101 ? 'Not ranked (Top 100)' : `#${position}`
}

function KeywordPerformancePanel({ summary }: {
  summary: NonNullable<AuditReportData['summary']>
}) {
  const { theme } = useOnboardingTheme()
  const isLight = theme === 'light'
  const top = summary.top_search_result
  const bottom = summary.bottom_search_result
  const mean = summary.mean_position
  const evaluated = summary.evaluated_keywords ?? 0
  const measured = summary.measured_keywords ?? 0

  const cards = [
    {
      label: 'Top Search Result',
      color: '#22C55E',
      keyword: top?.keyword ?? 'N/A',
      value: formatPosition(top?.position),
      hint: 'Best ranking keyword',
    },
    {
      label: 'Bottom Result',
      color: '#EF4444',
      keyword: bottom?.keyword ?? 'N/A',
      value: formatPosition(bottom?.position),
      hint: 'Weakest ranking keyword',
    },
    {
      label: 'Mean Position',
      color: '#3B82F6',
      keyword: `${measured}/${evaluated} ranked`,
      value: mean !== null && mean !== undefined ? `#${mean}` : 'N/A',
      hint: 'Average across evaluated terms',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontSize: '0.75rem',
        color: isLight ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.45)',
      }}>
        Evaluated {evaluated} high-intent keywords. Unranked terms are treated as position 101 in the mean.
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
      }}>
        {cards.map(card => (
          <div key={card.label} style={{
            borderRadius: 12,
            padding: '14px 16px',
            background: isLight ? `${card.color}12` : `${card.color}10`,
            border: `1px solid ${card.color}35`,
          }}>
            <div style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: card.color,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}>
              {card.label}
            </div>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              lineHeight: 1,
              color: card.color,
              marginBottom: 6,
            }}>
              {card.value}
            </div>
            <div style={{
              fontSize: '0.78rem',
              color: isLight ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.75)',
              marginBottom: 5,
            }}>
              {card.keyword}
            </div>
            <div style={{
              fontSize: '0.68rem',
              color: isLight ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.45)',
            }}>
              {card.hint}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Speed Section
// ---------------------------------------------------------------------------

function PageSpeedSection({ pageSpeed, targetDomain }: {
  pageSpeed:    PageSpeedFull
  targetDomain: string
}) {
  const mobile  = pageSpeed.mobile
  const desktop = pageSpeed.desktop

  return (
    <div>
      {/* Mobile vs Desktop tabs */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: '1fr 1fr',
        gap:                 12,
        marginBottom:        20,
      }}>
        <SpeedPanel label="📱 Mobile" metrics={mobile} accentColor="#F97316" />
        <SpeedPanel label="🖥️ Desktop" metrics={desktop} accentColor="#3B82F6" />
      </div>

      {/* Core Web Vitals */}
      <div style={{
        background:   'rgba(255,255,255,0.03)',
        border:       '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding:      '16px 18px',
        marginBottom: 16,
      }}>
        <div style={{
          fontSize:     '0.72rem',
          color:        'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: 14,
        }}>
          Core Web Vitals — Mobile
        </div>
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap:                 10,
        }}>
          <VitalMetric label="LCP"  value={formatMs(mobile.lcp)}  good={mobile.lcp < 2500}  warn={mobile.lcp < 4000}  desc="Largest Contentful Paint" />
          <VitalMetric label="FID"  value={formatMs(mobile.fid)}  good={mobile.fid < 100}   warn={mobile.fid < 300}   desc="First Input Delay" />
          <VitalMetric label="CLS"  value={mobile.cls.toFixed(3)} good={mobile.cls < 0.1}   warn={mobile.cls < 0.25}  desc="Cumulative Layout Shift" />
          <VitalMetric label="TTFB" value={formatMs(mobile.ttfb)} good={mobile.ttfb < 800}  warn={mobile.ttfb < 1800} desc="Time to First Byte" />
        </div>
      </div>

      {/* Top opportunities */}
      {mobile.opportunities && mobile.opportunities.length > 0 && (
        <div>
          <div style={{
            fontSize:     '0.72rem',
            color:        'rgba(255,255,255,0.4)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            marginBottom: 10,
          }}>
            Speed Opportunities
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mobile.opportunities.slice(0, 4).map((opp, i) => (
              <div key={i} style={{
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'space-between',
                padding:      '9px 14px',
                background:   'rgba(249,115,22,0.08)',
                border:       '1px solid rgba(249,115,22,0.2)',
                borderRadius: 8,
                gap:          10,
              }}>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)' }}>
                  {opp.title}
                </span>
                <span style={{
                  fontSize:   '0.75rem',
                  fontWeight: 700,
                  color:      '#FB923C',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  -{(opp.savings_ms / 1000).toFixed(1)}s
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SpeedPanel({ label, metrics, accentColor }: {
  label:       string
  metrics:     PageSpeedFull['mobile']
  accentColor: string
}) {
  const perf  = metrics.categoryScores.performance
  const color = getScoreColor(perf.score)

  return (
    <div style={{
      background:   `${accentColor}10`,
      border:       `1px solid ${accentColor}25`,
      borderRadius: 12,
      padding:      '16px',
      textAlign:    'center',
    }}>
      <div style={{
        fontSize:     '0.78rem',
        color:        'rgba(255,255,255,0.5)',
        marginBottom: 10,
        fontWeight:   600,
      }}>
        {label}
      </div>
      <div style={{
        fontSize:   '2.4rem',
        fontWeight: 800,
        color,
        textShadow: `0 0 20px ${color}60`,
        lineHeight: 1,
        marginBottom: 4,
      }}>
        {perf.score}
      </div>
      <div style={{
        fontSize:   '0.72rem',
        color:      'rgba(255,255,255,0.35)',
        marginBottom: 12,
      }}>
        Performance Score
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(metrics.categoryScores).map(([key, val]) => (
          <div key={key} style={{
            fontSize:   '0.65rem',
            color:      getScoreColor(val.score),
            background: `${getScoreColor(val.score)}15`,
            padding:    '2px 7px',
            borderRadius: 4,
          }}>
            {key.replace(/([A-Z])/g, ' $1').trim()}: {val.score}
          </div>
        ))}
      </div>
    </div>
  )
}

function VitalMetric({ label, value, good, warn, desc }: {
  label: string; value: string; good: boolean; warn: boolean; desc: string
}) {
  const color = good ? '#22C55E' : warn ? '#F59E0B' : '#EF4444'
  const status = good ? '✅ Good' : warn ? '⚠️ Needs Work' : '❌ Poor'

  return (
    <div style={{
      background:   `${color}10`,
      border:       `1px solid ${color}25`,
      borderRadius: 10,
      padding:      '12px',
      textAlign:    'center',
    }}>
      <div style={{
        fontSize:   '0.65rem',
        color:      'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize:   '1.3rem',
        fontWeight: 800,
        color,
        lineHeight: 1,
        marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>
        {desc}
      </div>
      <div style={{ fontSize: '0.62rem', color }}>
        {status}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Technical Issues
// ---------------------------------------------------------------------------

function TechnicalIssues({ issues }: { issues: NonNullable<AuditReportData['technical_issues']> }) {
  const SEVERITY_CONFIG = {
    critical: { color: '#EF4444', icon: '🚨', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
    warning:  { color: '#F59E0B', icon: '⚠️', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
    info:     { color: '#60A5FA', icon: 'ℹ️', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.25)' },
  }

  // Sort: critical first
  const sorted = [...issues].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map((issue, i) => {
        const cfg = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.info
        return (
          <div key={i} style={{
            display:      'flex',
            alignItems:   'flex-start',
            gap:          10,
            padding:      '10px 14px',
            background:   cfg.bg,
            border:       `1px solid ${cfg.border}`,
            borderRadius: 8,
          }}>
            <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{cfg.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize:   '0.8rem',
                fontWeight: 600,
                color:      cfg.color,
                marginBottom: 2,
              }}>
                {issue.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
              <div style={{
                fontSize:   '0.75rem',
                color:      'rgba(255,255,255,0.55)',
                lineHeight: 1.4,
              }}>
                {issue.description}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Opportunities
// ---------------------------------------------------------------------------

function Opportunities({ opportunities }: { opportunities: NonNullable<AuditReportData['opportunities']> }) {
  const IMPACT_CONFIG = {
    high:   { color: '#EF4444', label: 'High Impact',   icon: '🔥' },
    medium: { color: '#F59E0B', label: 'Medium Impact', icon: '⚡' },
    low:    { color: '#60A5FA', label: 'Low Impact',    icon: '💡' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {opportunities.map((opp, i) => {
        const cfg = IMPACT_CONFIG[opp.estimated_impact] ?? IMPACT_CONFIG.low
        return (
          <div key={i} style={{
            display:      'flex',
            alignItems:   'flex-start',
            gap:          12,
            padding:      '12px 16px',
            background:   `${cfg.color}08`,
            border:       `1px solid ${cfg.color}25`,
            borderRadius: 10,
          }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>{cfg.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{
                display:      'flex',
                alignItems:   'center',
                gap:          8,
                marginBottom: 4,
                flexWrap:     'wrap',
              }}>
                <span style={{
                  fontSize:     '0.68rem',
                  fontWeight:   700,
                  color:        cfg.color,
                  background:   `${cfg.color}15`,
                  padding:      '2px 8px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {cfg.label}
                </span>
                <span style={{
                  fontSize:   '0.68rem',
                  color:      'rgba(255,255,255,0.3)',
                  textTransform: 'capitalize',
                }}>
                  {opp.type.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={{
                fontSize:   '0.82rem',
                color:      'rgba(255,255,255,0.7)',
                lineHeight: 1.4,
              }}>
                {opp.description}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title, subtitle, children,
}: {
  title:    string
  subtitle: string
  children: React.ReactNode
}) {
  const { theme } = useOnboardingTheme()
  const isLight = theme === 'light'
  return (
    <div style={{ marginBottom: 28 }}>
      {/* Section header */}
      <div style={{ marginBottom: 14 }}>
        <h2 style={{
          margin:     '0 0 4px',
          fontSize:   'clamp(0.95rem, 2.5vw, 1.15rem)',
          fontWeight: 800,
          color:      isLight ? '#0f172a' : '#ffffff',
        }}>
          {title}
        </h2>
        <p style={{
          margin:   0,
          fontSize: '0.78rem',
          color:    isLight ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.4)',
        }}>
          {subtitle}
        </p>
      </div>

      {/* Content card */}
      <div style={{
        background:   isLight ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.03)',
        border:       isLight ? '1px solid rgba(51,65,85,0.16)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding:      'clamp(14px, 3vw, 22px)',
        backdropFilter: 'blur(8px)',
        boxShadow:    '0 4px 24px rgba(0,0,0,0.3)',
      }}>
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page shell (handles sticky header + background)
// ---------------------------------------------------------------------------

function PageShell({
  children, auditId, expiresAt,
}: {
  children:   React.ReactNode
  auditId?:   string
  expiresAt?: string
}) {
  const { theme } = useOnboardingTheme()
  const isLight = theme === 'light'
  const [ctaUrl, setCtaUrl] = useState(auditId ? `/get-started?tier=standard&auditId=${auditId}` : '')

  useEffect(() => {
    if (!auditId) return

    const searchParams = new URLSearchParams(window.location.search)
      setCtaUrl(buildGetStartedUrl(getGetStartedBaseUrl(), searchParams, {
      tier: 'standard',
      auditId,
    }))
  }, [auditId])

  const trackHeaderClick = () => {
    if (!auditId) return

    const searchParams = new URLSearchParams(window.location.search)
    trackEvent('audit_report_cta_clicked', {
      ...getAuditFunnelProperties(searchParams, auditId),
      cta: 'report_header',
      destination: ctaUrl,
    })
  }

  return (
    <div style={{
      minHeight:   '100vh',
      background:  isLight
        ? 'linear-gradient(180deg, #f1f5f9 0%, #e2edf7 50%, #eff6ff 100%)'
        : 'linear-gradient(180deg, #0a0a0f 0%, #0d0d18 50%, #0a0a0f 100%)',
      color:       isLight ? '#0f172a' : '#ffffff',
      fontFamily:  'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <AdvantagePointHeader variant="onboarding" />
      <div style={{
        borderBottom: isLight ? '1px solid rgba(51,65,85,0.2)' : '1px solid rgba(255,255,255,0.08)',
        background: isLight ? 'rgba(255,255,255,0.75)' : 'rgba(10,10,15,0.65)',
        backdropFilter: 'blur(12px)',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        flexWrap: 'wrap',
      }}>
          <a
            href="/audit/start"
            style={{
              padding:        '7px 14px',
              background:     isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.06)',
              color:          isLight ? '#0f172a' : '#ffffff',
              textDecoration: 'none',
              borderRadius:   8,
              border:         isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(255,255,255,0.14)',
              fontSize:       '0.78rem',
              fontWeight:     700,
              whiteSpace:     'nowrap',
            }}
          >
            ← Run Another Audit
          </a>
        {expiresAt && <ExpiryCountdown expiresAt={expiresAt} compact />}
        {auditId && (
          <a
            href={ctaUrl}
            onClick={trackHeaderClick}
            style={{
              padding:        '7px 16px',
              background:     'linear-gradient(135deg, #06b6d4, #10b981)',
              color:          '#ffffff',
              textDecoration: 'none',
              borderRadius:   8,
              fontSize:       '0.78rem',
              fontWeight:     700,
              whiteSpace:     'nowrap',
              boxShadow:      '0 2px 12px rgba(6,182,212,0.35)',
            }}
          >
            🚀 Fix My Rankings
          </a>
        )}
      </div>

      {/* Page content */}
      <main>
        {children}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report footer
// ---------------------------------------------------------------------------

function ReportFooter({ auditId, completedAt }: { auditId: string; completedAt: string | null }) {
  const { theme } = useOnboardingTheme()
  const isLight = theme === 'light'
  return (
    <div style={{
      borderTop:   isLight ? '1px solid rgba(51,65,85,0.14)' : '1px solid rgba(255,255,255,0.08)',
      paddingTop:  24,
      textAlign:   'center',
    }}>
      <div style={{
        fontSize:   '0.72rem',
        color:      isLight ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.2)',
        marginBottom: 8,
      }}>
        Report ID: {auditId.toUpperCase().slice(0, 8)}
        {completedAt && ` · Generated ${new Date(completedAt).toLocaleString()}`}
      </div>
      <div style={{
        fontSize: '0.72rem',
        color:    isLight ? 'rgba(15,23,42,0.38)' : 'rgba(255,255,255,0.15)',
      }}>
        © {new Date().getFullYear()} RankedCEO · Powered by Surface Audit Engine v2 ·{' '}
        <a
          href="/"
          style={{ color: isLight ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.3)', textDecoration: 'none' }}
        >
          rankedceo.com
        </a>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ScorePill (inline version, kept local to avoid circular imports)
// ---------------------------------------------------------------------------

function ScorePill({
  label, value, color, glow = false,
}: {
  label:  string
  value:  string
  color:  string
  glow?:  boolean
}) {
  const { theme } = useOnboardingTheme()
  const isLight = theme === 'light'
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          7,
      padding:      '5px 12px',
      background:   `${color}15`,
      border:       `1px solid ${color}35`,
      borderRadius: 20,
    }}>
      <span style={{
        fontSize:   '0.9rem',
        fontWeight: 800,
        color,
        textShadow: glow ? `0 0 10px ${color}80` : 'none',
      }}>
        {value}
      </span>
      <span style={{
        fontSize: '0.7rem',
        color:    isLight ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.4)',
      }}>
        {label}
      </span>
    </div>
  )
}