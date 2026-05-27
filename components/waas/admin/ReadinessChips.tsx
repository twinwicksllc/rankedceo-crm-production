// =============================================================================
// components/waas/admin/ReadinessChips.tsx
//
// Readiness chips for the admin tenant health view.
// Shows compact color-coded chips for each launch-readiness criterion.
//
// Criteria (6 total — one per milestone in the Audit → WaaS → Live journey):
//   1. Profile     — legal_name + primary_trade filled
//   2. Onboarding  — onboarding_completed = true
//   3. Domain      — domain or subdomain configured
//   4. DNS         — domain_verified = true
//   5. Template    — client_selected_template_slug set
//   6. Payment     — stripe_subscription_id set
//
// Usage:
//   <ReadinessChips tenant={tenant} />            — compact (list view)
//   <ReadinessChips tenant={tenant} expanded />   — full labels (detail page)
//   <ReadinessScore tenant={tenant} />            — "N / 6" score badge only
// =============================================================================

import type { AdminTenantListItem } from '@/lib/waas/actions/admin'
import type { WaasBrandConfig } from '@/lib/waas/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReadinessStatus = 'ready' | 'partial' | 'missing'

export interface ReadinessCheck {
  key:     string
  label:   string
  status:  ReadinessStatus
  detail?: string  // tooltip / screen-reader detail
}

// ---------------------------------------------------------------------------
// Core readiness calculation
// ---------------------------------------------------------------------------

export function getTenantReadiness(tenant: AdminTenantListItem): ReadinessCheck[] {
  const bc = tenant.brand_config as WaasBrandConfig | null

  // 1. Profile — legal_name + primary_trade
  const hasName  = Boolean(tenant.legal_name?.trim())
  const hasTrade = Boolean(tenant.primary_trade?.trim())
  const profile: ReadinessCheck = hasName && hasTrade
    ? { key: 'profile',  label: 'Profile',  status: 'ready',   detail: `${tenant.legal_name} · ${tenant.primary_trade}` }
    : hasName || hasTrade
    ? { key: 'profile',  label: 'Profile',  status: 'partial', detail: hasName ? `Has name, missing trade` : `Has trade, missing name` }
    : { key: 'profile',  label: 'Profile',  status: 'missing', detail: 'No business name or trade set' }

  // 2. Onboarding — onboarding_completed flag
  const onboarding: ReadinessCheck = tenant.onboarding_completed
    ? { key: 'onboarding', label: 'Onboarded', status: 'ready',   detail: tenant.onboarding_completed_at ? `Completed ${new Date(tenant.onboarding_completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Onboarding complete' }
    : tenant.onboarding_step > 0
    ? { key: 'onboarding', label: 'Onboarded', status: 'partial', detail: `In progress — step ${tenant.onboarding_step}` }
    : { key: 'onboarding', label: 'Onboarded', status: 'missing', detail: 'Not started' }

  // 3. Domain — custom domain or subdomain
  const hasDomain    = Boolean(tenant.domain?.trim())
  const hasSubdomain = Boolean(tenant.subdomain?.trim())
  const domain: ReadinessCheck = hasDomain
    ? { key: 'domain', label: 'Domain', status: 'ready',   detail: tenant.domain ?? undefined }
    : hasSubdomain
    ? { key: 'domain', label: 'Domain', status: 'partial', detail: `Subdomain: ${tenant.subdomain}.rankedceo.com` }
    : { key: 'domain', label: 'Domain', status: 'missing', detail: 'No domain configured' }

  // 4. DNS verified — domain_verified flag
  const dns: ReadinessCheck = tenant.domain_verified
    ? { key: 'dns', label: 'DNS', status: 'ready',   detail: tenant.domain_verified_at ? `Verified ${new Date(tenant.domain_verified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'DNS verified' }
    : hasDomain
    ? { key: 'dns', label: 'DNS', status: 'partial', detail: 'Domain set but DNS not verified yet' }
    : { key: 'dns', label: 'DNS', status: 'missing', detail: 'No domain to verify' }

  // 5. Template — client selected a design variant
  const template: ReadinessCheck = Boolean(tenant.client_selected_template_slug)
    ? { key: 'template', label: 'Template', status: 'ready',   detail: tenant.client_selected_template_slug ?? undefined }
    : { key: 'template', label: 'Template', status: 'missing', detail: 'No template selected by client' }

  // 6. Payment — active Stripe subscription
  const payment: ReadinessCheck = Boolean(tenant.stripe_subscription_id)
    ? { key: 'payment', label: 'Paid', status: 'ready',   detail: `Sub: ${tenant.stripe_subscription_id}` }
    : { key: 'payment', label: 'Paid', status: 'missing', detail: 'No active subscription' }

  return [profile, onboarding, domain, dns, template, payment]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHIP_COLORS: Record<ReadinessStatus, string> = {
  ready:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  partial: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  missing: 'bg-white/5 text-white/25 border-white/8',
}

const DOT_COLORS: Record<ReadinessStatus, string> = {
  ready:   'bg-emerald-400',
  partial: 'bg-amber-400',
  missing: 'bg-white/20',
}

/** Returns a score summary, e.g. { score: 4, total: 6, pct: 66 } */
export function getReadinessScore(checks: ReadinessCheck[]): { score: number; total: number; pct: number } {
  const score = checks.filter((c) => c.status === 'ready').length
  const total = checks.length
  return { score, total, pct: Math.round((score / total) * 100) }
}

/** Score badge color based on how many are ready */
function scoreBadgeClass(pct: number): string {
  if (pct >= 100) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
  if (pct >= 66)  return 'bg-amber-500/15 text-amber-300 border-amber-500/25'
  return 'bg-red-500/10 text-red-400 border-red-500/20'
}

// ---------------------------------------------------------------------------
// ReadinessChips — main component
// ---------------------------------------------------------------------------

interface ReadinessChipsProps {
  tenant:   AdminTenantListItem
  expanded?: boolean  // show full labels (default: compact with dots only)
}

export function ReadinessChips({ tenant, expanded = false }: ReadinessChipsProps) {
  const checks = getTenantReadiness(tenant)

  if (expanded) {
    return (
      <div className="flex flex-wrap gap-1.5" role="list" aria-label="Launch readiness">
        {checks.map((check) => (
          <span
            key={check.key}
            role="listitem"
            title={check.detail}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${CHIP_COLORS[check.status]}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLORS[check.status]}`} aria-hidden="true" />
            {check.label}
          </span>
        ))}
      </div>
    )
  }

  // Compact: tiny dots with 2–4 char labels
  return (
    <div className="flex flex-wrap gap-1" role="list" aria-label="Launch readiness">
      {checks.map((check) => (
        <span
          key={check.key}
          role="listitem"
          title={`${check.label}: ${check.detail ?? check.status}`}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border leading-none ${CHIP_COLORS[check.status]}`}
        >
          <span className={`w-1 h-1 rounded-full shrink-0 ${DOT_COLORS[check.status]}`} aria-hidden="true" />
          {check.label}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReadinessScore — compact "N / 6" badge for column headers / summaries
// ---------------------------------------------------------------------------

interface ReadinessScoreProps {
  tenant: AdminTenantListItem
}

export function ReadinessScore({ tenant }: ReadinessScoreProps) {
  const checks = getTenantReadiness(tenant)
  const { score, total, pct } = getReadinessScore(checks)

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${scoreBadgeClass(pct)}`}
      title={`${score} of ${total} readiness checks passed`}
      aria-label={`Readiness: ${score} of ${total}`}
    >
      {score}/{total}
    </span>
  )
}
