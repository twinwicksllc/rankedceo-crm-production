'use client'

// =============================================================================
// Manual Audit State
// Shown when audit engine fails — reassures prospect, notifies Darrick
// Red-to-amber gradient, no scary error messages, actionable CTA
// =============================================================================

import { useEffect, useState } from 'react'
import {
  buildGetStartedUrl,
  getAuditFunnelProperties,
  getGetStartedBaseUrl,
} from '@/lib/analytics/audit-funnel'
import { trackEvent } from '@/lib/analytics/track-event'

interface ManualAuditStateProps {
  targetUrl:    string
  auditId:      string
  errorMessage: string | null
  adminEmail?:  string
  badgeLabel?:  string
  title?:       string
  subtitle?:    string
}

export function ManualAuditState({
  targetUrl,
  auditId,
  errorMessage,
  adminEmail = 'darrick@rankedceo.com',
  badgeLabel,
  title = 'Manual Audit Required',
  subtitle,
}: ManualAuditStateProps) {
  const [ctaUrl, setCtaUrl] = useState(`/get-started?tier=standard&auditId=${auditId}`)

  const targetDomain = (() => {
    try { return new URL(targetUrl).hostname.replace(/^www\./, '') }
    catch { return targetUrl }
  })()

  const shortAuditId = auditId.slice(0, 8).toUpperCase()
  const message = subtitle ?? (
    <>
      Our automated scanner couldn't fully analyze{' '}
      <strong style={{ color: '#FCD34D' }}>{targetDomain}</strong>{' '}
      right now — but don't worry. A member of the RankedCEO team has been
      notified and will complete your report manually.
    </>
  )

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    setCtaUrl(buildGetStartedUrl(getGetStartedBaseUrl(), searchParams, {
      tier: 'standard',
      auditId,
    }))
  }, [auditId])

  const trackClick = () => {
    const searchParams = new URLSearchParams(window.location.search)

    trackEvent('audit_report_cta_clicked', {
      ...getAuditFunnelProperties(searchParams, auditId),
      cta: 'manual_audit_state',
      destination: ctaUrl,
      targetDomain,
    })
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>

      {/* Icon */}
      <div style={{
        width:        80,
        height:       80,
        borderRadius: '50%',
        background:   'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.15))',
        border:       '2px solid rgba(245,158,11,0.4)',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        fontSize:     '2.2rem',
        margin:       '0 auto 24px',
      }}>
        🔍
      </div>

      {/* Headline */}
      {badgeLabel && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          marginBottom: 12,
          borderRadius: 999,
          border: '1px solid rgba(16,185,129,0.35)',
          background: 'rgba(16,185,129,0.12)',
          color: '#6EE7B7',
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
        }}>
          ● {badgeLabel}
        </div>
      )}

      <h1 style={{
        margin:     '0 0 12px',
        fontSize:   'clamp(1.4rem, 4vw, 2rem)',
        fontWeight: 800,
        color:      '#ffffff',
        lineHeight: 1.2,
      }}>
        {title}
      </h1>

      {/* Sub-headline */}
      <p style={{
        margin:     '0 0 28px',
        fontSize:   '1rem',
        color:      'rgba(255,255,255,0.65)',
        lineHeight: 1.6,
        maxWidth:   520,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}>
        {message}
      </p>

      {/* Status card */}
      <div style={{
        background:   'rgba(255,255,255,0.04)',
        border:       '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14,
        padding:      '20px 24px',
        marginBottom: 24,
        textAlign:    'left',
      }}>
        <div style={{
          fontSize:     '0.7rem',
          color:        'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom:  12,
        }}>
          Audit Status
        </div>

        <StatusRow icon="📋" label="Reference ID"   value={shortAuditId}           />
        <StatusRow icon="🌐" label="Target URL"     value={targetDomain}           />
        <StatusRow icon="📬" label="Assigned to"    value={adminEmail}             />
        <StatusRow icon="⏱️" label="ETA"             value="Within 1 business day" />
        <StatusRow
          icon="✅"
          label="Status"
          value="Notified — pending manual review"
          valueColor="#22C55E"
        />
      </div>

      {/* What happens next */}
      <div style={{
        background:   'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(0,0,0,0.2))',
        border:       '1px solid rgba(245,158,11,0.25)',
        borderRadius: 14,
        padding:      '20px 24px',
        marginBottom: 28,
        textAlign:    'left',
      }}>
        <div style={{
          fontSize:     '0.85rem',
          fontWeight:   700,
          color:        '#FCD34D',
          marginBottom: 14,
          display:      'flex',
          alignItems:   'center',
          gap:          6,
        }}>
          <span>📌</span> What happens next
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <NextStep
            num={1}
            title="Team Notified"
            description="Our SEO team has already been alerted about your audit request."
          />
          <NextStep
            num={2}
            title="Manual Analysis"
            description="We'll personally review your site's rankings, speed, and competitor landscape."
          />
          <NextStep
            num={3}
            title="Report Delivered"
            description="Your full audit report will be emailed to you within 1 business day."
          />
          <NextStep
            num={4}
            title="Strategy Call"
            description="We'll reach out to walk you through the findings and recommend a growth plan."
          />
        </div>
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <a
          href={ctaUrl}
          onClick={trackClick}
          style={{
            display:        'inline-block',
            padding:        '14px 32px',
            background:     'linear-gradient(135deg, #2563EB, #1D4ED8)',
            color:          '#ffffff',
            textDecoration: 'none',
            borderRadius:   10,
            fontSize:       '0.95rem',
            fontWeight:     700,
            boxShadow:      '0 4px 20px rgba(37,99,235,0.4)',
            transition:     'opacity 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          🚀 Skip the Wait — Start Your Campaign Now
        </a>

        <p style={{
          fontSize: '0.75rem',
          color:    'rgba(255,255,255,0.3)',
          margin:   0,
        }}>
          Or wait for the manual report — whichever works for you.
        </p>
      </div>

      {/* Dev-only error detail */}
      {process.env.NODE_ENV === 'development' && errorMessage && (
        <details style={{ marginTop: 32, textAlign: 'left' }}>
          <summary style={{
            cursor:   'pointer',
            fontSize: '0.72rem',
            color:    'rgba(255,255,255,0.3)',
          }}>
            Dev: Error details
          </summary>
          <pre style={{
            marginTop:   8,
            padding:     12,
            background:  'rgba(239,68,68,0.1)',
            border:      '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8,
            fontSize:    '0.7rem',
            color:       '#FCA5A5',
            whiteSpace:  'pre-wrap',
            wordBreak:   'break-word',
          }}>
            {errorMessage}
          </pre>
        </details>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusRow({
  icon, label, value, valueColor,
}: {
  icon:        string
  label:       string
  value:       string
  valueColor?: string
}) {
  return (
    <div style={{
      display:        'flex',
      justifyContent: 'space-between',
      alignItems:     'center',
      padding:        '7px 0',
      borderBottom:   '1px solid rgba(255,255,255,0.06)',
      gap:            12,
    }}>
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        8,
        fontSize:   '0.8rem',
        color:      'rgba(255,255,255,0.4)',
        flexShrink: 0,
      }}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div style={{
        fontSize:  '0.82rem',
        fontWeight: 600,
        color:     valueColor ?? 'rgba(255,255,255,0.8)',
        textAlign: 'right',
        wordBreak: 'break-all',
      }}>
        {value}
      </div>
    </div>
  )
}

function NextStep({
  num, title, description,
}: {
  num:         number
  title:       string
  description: string
}) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{
        width:        24,
        height:       24,
        borderRadius: '50%',
        background:   'rgba(245,158,11,0.2)',
        border:       '1px solid rgba(245,158,11,0.4)',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        fontSize:     '0.72rem',
        fontWeight:   800,
        color:        '#FCD34D',
        flexShrink:   0,
      }}>
        {num}
      </div>
      <div>
        <div style={{
          fontSize:     '0.82rem',
          fontWeight:   700,
          color:        '#ffffff',
          marginBottom: 2,
        }}>
          {title}
        </div>
        <div style={{
          fontSize:   '0.76rem',
          color:      'rgba(255,255,255,0.5)',
          lineHeight: 1.4,
        }}>
          {description}
        </div>
      </div>
    </div>
  )
}