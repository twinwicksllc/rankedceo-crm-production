'use client'

// =============================================================================
// Buy Now CTA
// Conversion panel — links to /get-started?tier=standard&auditId=
// Uses glassmorphism + heavy shadow, red-to-green gradient urgency
// =============================================================================

import { useEffect, useState } from 'react'
import {
  buildGetStartedUrl,
  getAuditFunnelProperties,
  getGetStartedBaseUrl,
} from '@/lib/analytics/audit-funnel'
import { trackEvent } from '@/lib/analytics/track-event'

interface BuyNowCtaProps {
  auditId:      string
  targetDomain: string
  score:        number
  grade:        'A' | 'B' | 'C' | 'D' | 'F'
  compact?:     boolean  // inline vs full panel
}

const PAIN_POINTS = [
  { icon: '📉', text: 'Losing leads to competitors every day' },
  { icon: '🐌', text: 'Slow site speeds driving visitors away' },
  { icon: '🔍', text: 'Invisible on Google for buying-intent searches' },
  { icon: '💸', text: 'Wasting ad budget on unoptimized pages' },
]

const INCLUSIONS = [
  '✅ Full SEO optimization for your local market',
  '✅ Google Business Profile management',
  '✅ Monthly ranking reports & strategy calls',
  '✅ Competitor monitoring & gap-closing strategy',
  '✅ High-converting landing page build',
  '✅ 24/7 dashboard access via RankedCEO',
]

function getScoreMessage(score: number, grade: string): { headline: string; sub: string } {
  if (grade === 'A') {
    return {
      headline: 'Your site is strong — let\'s keep it that way.',
      sub:      'Maintain your rankings and outpace competitors with ongoing SEO management.',
    }
  }
  if (grade === 'B') {
    return {
      headline: 'You\'re close to the top — one push can dominate.',
      sub:      'A few targeted improvements and you\'ll own Page 1 for your local market.',
    }
  }
  if (grade === 'C') {
    return {
      headline: 'You\'re losing leads on 3 fronts simultaneously.',
      sub:      'Rankings, speed, and competitor gaps are costing you customers every single day.',
    }
  }
  if (grade === 'D') {
    return {
      headline: 'Your competitors are eating your lunch — right now.',
      sub:      `With a score of ${score}/100, you\'re likely invisible for the searches that matter most.`,
    }
  }
  return {
    headline: 'Your online presence is critically underperforming.',
    sub:      `A score of ${score}/100 means competitors are capturing nearly all your potential leads.`,
  }
}

export function BuyNowCta({
  auditId,
  targetDomain,
  score,
  grade,
  compact = false,
}: BuyNowCtaProps) {
  const msg        = getScoreMessage(score, grade)
  const [ctaUrl, setCtaUrl] = useState(`/get-started?tier=standard&auditId=${auditId}`)
  const isUrgent   = grade === 'D' || grade === 'F' || grade === 'C'
  const accentColor = isUrgent ? '#EF4444' : '#2563EB'

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    setCtaUrl(buildGetStartedUrl(getGetStartedBaseUrl(), searchParams, {
      tier: 'standard',
      auditId,
    }))
  }, [auditId])

  const trackClick = (variant: 'compact' | 'full') => {
    const searchParams = new URLSearchParams(window.location.search)

    trackEvent('audit_report_cta_clicked', {
      ...getAuditFunnelProperties(searchParams, auditId),
      cta: variant === 'compact' ? 'buy_now_compact' : 'buy_now_full',
      destination: ctaUrl,
      targetDomain,
      score,
      grade,
    })
  }

  // ── Compact inline button ────────────────────────────────────────────────
  if (compact) {
    return (
      <a
        href={ctaUrl}
        onClick={() => trackClick('compact')}
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            8,
          padding:        '12px 24px',
          background:     'linear-gradient(135deg, #2563EB, #1D4ED8)',
          color:          '#ffffff',
          textDecoration: 'none',
          borderRadius:   10,
          fontSize:       '0.9rem',
          fontWeight:     700,
          boxShadow:      '0 4px 20px rgba(37,99,235,0.45)',
          whiteSpace:     'nowrap',
        }}
      >
        <span>🚀</span>
        <span>Fix My Rankings — Start Today</span>
      </a>
    )
  }

  // ── Full panel ────────────────────────────────────────────────────────────
  return (
    <div style={{
      background:   'linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(15,15,20,0.95) 60%, rgba(239,68,68,0.08) 100%)',
      border:       '1px solid rgba(37,99,235,0.35)',
      borderRadius: 16,
      overflow:     'hidden',
      boxShadow:    '0 8px 40px rgba(37,99,235,0.2), 0 0 0 1px rgba(255,255,255,0.05)',
    }}>

      {/* Top urgency bar */}
      {isUrgent && (
        <div style={{
          padding:   '8px 20px',
          background: 'linear-gradient(90deg, rgba(239,68,68,0.8), rgba(220,38,38,0.6))',
          fontSize:  '0.78rem',
          fontWeight: 700,
          color:     '#ffffff',
          textAlign: 'center',
          letterSpacing: '0.02em',
        }}>
          🚨 Your competitors are winning leads you should be getting — every day you wait costs you
        </div>
      )}

      <div style={{ padding: '28px 24px' }}>

        {/* Headline */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize:     '0.7rem',
            color:        '#60A5FA',
            fontWeight:   700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 8,
          }}>
            🎯 RankedCEO Standard Plan
          </div>
          <h3 style={{
            margin:     '0 0 8px',
            fontSize:   'clamp(1.1rem, 3vw, 1.5rem)',
            fontWeight: 800,
            color:      '#ffffff',
            lineHeight: 1.25,
          }}>
            {msg.headline}
          </h3>
          <p style={{
            margin:     0,
            fontSize:   '0.88rem',
            color:      'rgba(255,255,255,0.6)',
            lineHeight: 1.5,
          }}>
            {msg.sub}
          </p>
        </div>

        {/* Score context */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          12,
          padding:      '12px 16px',
          background:   'rgba(255,255,255,0.05)',
          borderRadius: 10,
          marginBottom: 20,
          border:       '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            width:        48,
            height:       48,
            borderRadius: '50%',
            background:   `${accentColor}25`,
            border:       `2px solid ${accentColor}50`,
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            fontSize:     '1.2rem',
            fontWeight:   800,
            color:        accentColor,
            flexShrink:   0,
          }}>
            {grade}
          </div>
          <div>
            <div style={{
              fontSize:   '0.82rem',
              fontWeight: 700,
              color:      '#ffffff',
              marginBottom: 2,
            }}>
              {targetDomain} — Score: {score}/100
            </div>
            <div style={{
              fontSize: '0.75rem',
              color:    'rgba(255,255,255,0.45)',
            }}>
              {score < 50
                ? 'Significant improvements needed to compete locally'
                : score < 70
                  ? 'Moderate improvements will push you to Page 1'
                  : 'Strong foundation — optimize for long-term domination'
              }
            </div>
          </div>
        </div>

        {/* Two columns: pain points + inclusions */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap:                 16,
          marginBottom:        24,
        }}>
          {/* Pain points */}
          <div>
            <div style={{
              fontSize:     '0.72rem',
              color:        '#EF4444',
              fontWeight:   700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 10,
            }}>
              ❌ Without RankedCEO
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {PAIN_POINTS.map((pp, i) => (
                <div key={i} style={{
                  display:    'flex',
                  alignItems: 'flex-start',
                  gap:        8,
                  fontSize:   '0.8rem',
                  color:      'rgba(255,255,255,0.55)',
                }}>
                  <span>{pp.icon}</span>
                  <span>{pp.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Inclusions */}
          <div>
            <div style={{
              fontSize:     '0.72rem',
              color:        '#22C55E',
              fontWeight:   700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 10,
            }}>
              ✅ With RankedCEO Standard
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {INCLUSIONS.slice(0, 4).map((item, i) => (
                <div key={i} style={{
                  fontSize:   '0.8rem',
                  color:      'rgba(255,255,255,0.7)',
                }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing teaser */}
        <div style={{
          background:   'rgba(37,99,235,0.12)',
          border:       '1px solid rgba(37,99,235,0.3)',
          borderRadius: 10,
          padding:      '14px 18px',
          marginBottom: 20,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
          flexWrap:     'wrap',
          gap:          12,
        }}>
          <div>
            <div style={{
              fontSize:   '0.72rem',
              color:      'rgba(255,255,255,0.4)',
              marginBottom: 3,
            }}>
              Starting at
            </div>
            <div style={{
              fontSize:   '1.6rem',
              fontWeight: 800,
              color:      '#ffffff',
              lineHeight: 1,
            }}>
              $497<span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/mo</span>
            </div>
          </div>
          <div style={{
            fontSize:   '0.78rem',
            color:      'rgba(255,255,255,0.5)',
            maxWidth:   240,
          }}>
            Cancel anytime · No setup fees · Results in 30 days or we work free
          </div>
        </div>

        {/* CTA Button */}
        <a
          href={ctaUrl}
          onClick={() => trackClick('full')}
          style={{
            display:        'block',
            padding:        '16px 24px',
            background:     'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
            color:          '#ffffff',
            textDecoration: 'none',
            borderRadius:   12,
            fontSize:       '1rem',
            fontWeight:     800,
            textAlign:      'center',
            boxShadow:      '0 6px 30px rgba(37,99,235,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
            letterSpacing:  '0.01em',
            transition:     'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform  = 'translateY(-2px)'
            e.currentTarget.style.boxShadow  = '0 10px 40px rgba(37,99,235,0.6), inset 0 1px 0 rgba(255,255,255,0.15)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform  = 'translateY(0)'
            e.currentTarget.style.boxShadow  = '0 6px 30px rgba(37,99,235,0.5), inset 0 1px 0 rgba(255,255,255,0.15)'
          }}
        >
          🚀 Fix My Rankings — Start Today →
        </a>

        {/* Social proof */}
        <div style={{
          marginTop:      14,
          textAlign:      'center',
          fontSize:       '0.75rem',
          color:          'rgba(255,255,255,0.35)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            8,
          flexWrap:       'wrap',
        }}>
          <span>⭐⭐⭐⭐⭐</span>
          <span>Trusted by 200+ local businesses</span>
          <span>·</span>
          <span>Average +34 positions in 30 days</span>
        </div>
      </div>
    </div>
  )
}