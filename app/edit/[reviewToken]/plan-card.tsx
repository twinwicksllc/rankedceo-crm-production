'use client'

// =============================================================================
// app/edit/[reviewToken]/plan-card.tsx
// Phase 7.4: WaaS Billing Plan Card
//
// Shown on the portal overview tab. Displays the tenant's current plan tier,
// billing interval, and provides buttons to:
//   - Open Stripe Billing Portal (manage payment, invoices, cancel)
//   - Upgrade to a higher plan via Stripe Checkout
//
// Data is pre-loaded server-side in portal-home.tsx props.
// All Stripe redirects are handled by client-side form submits to keep
// navigation clean (no JS redirect race conditions).
// =============================================================================

import { useState, useTransition } from 'react'
import {
  createBillingPortalSession,
  createCheckoutSession,
  type TenantBillingStatus,
} from '@/lib/waas/actions/billing'
import { WAAS_PLAN_DISPLAY } from '@/lib/waas/billing-config'
import type { WaasPackageTier } from '@/lib/waas/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlanCardProps {
  tenantId:      string
  reviewToken:   string
  billingStatus: TenantBillingStatus | null
}

// ---------------------------------------------------------------------------
// Tier ordering for "upgrade" logic
// ---------------------------------------------------------------------------

// Tier ordering — hosting_only sits between free hosting and standard
const TIER_ORDER: WaasPackageTier[] = ['hosting', 'hosting_only', 'standard', 'premium']

function tierIndex(tier: WaasPackageTier): number {
  return TIER_ORDER.indexOf(tier)
}

// ---------------------------------------------------------------------------
// PlanCard
// ---------------------------------------------------------------------------

export function PlanCard({ tenantId, reviewToken, billingStatus }: PlanCardProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [upgradeInterval, setUpgradeInterval] = useState<'month' | 'year'>('month')

  if (!billingStatus) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-400">Unable to load billing information.</p>
      </div>
    )
  }

  const {
    packageTier,
    planInterval,
    hasActiveSubscription,
    planDisplay,
  } = billingStatus

  const currentTierIdx = tierIndex(packageTier)
  const returnUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/edit/${reviewToken}?tab=overview`

  // ---------------------------------------------------------------------------
  // Manage billing portal
  // ---------------------------------------------------------------------------

  function handleManageBilling() {
    setError(null)
    startTransition(async () => {
      const result = await createBillingPortalSession({
        tenantId,
        returnUrl,
      })
      if (result.success && result.data?.url) {
        window.location.href = result.data.url
      } else {
        setError(result.error ?? 'Failed to open billing portal')
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Upgrade to tier
  // ---------------------------------------------------------------------------

  function handleUpgrade(tier: Exclude<WaasPackageTier, 'hosting'>) {
    setError(null)
    // hosting_only is annual-only — always use 'year' regardless of toggle
    const effectiveInterval = tier === 'hosting_only' ? 'year' : upgradeInterval
    startTransition(async () => {
      const result = await createCheckoutSession({
        tenantId,
        packageTier: tier,
        interval:    effectiveInterval,
        successUrl:  `${window.location.origin}/edit/${reviewToken}?tab=overview&billing=success`,
        cancelUrl:   `${window.location.origin}/edit/${reviewToken}?tab=overview&billing=cancelled`,
      })
      if (result.success && result.data?.url) {
        window.location.href = result.data.url
      } else {
        setError(result.error ?? 'Failed to start checkout')
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Render — current plan badge
  // ---------------------------------------------------------------------------

  const planColors: Record<WaasPackageTier, string> = {
    hosting:      'bg-slate-100 text-slate-600',
    hosting_only: 'bg-teal-100 text-teal-700',
    standard:     'bg-blue-100 text-blue-700',
    premium:      'bg-violet-100 text-violet-700',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">Your Plan</h2>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${planColors[packageTier]}`}>
          {planDisplay.label}
          {planInterval && (
            <span className="opacity-70">· {planInterval === 'month' ? 'Monthly' : 'Annual'}</span>
          )}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* Current plan features */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">What&apos;s included</p>
          <ul className="space-y-1.5">
            {planDisplay.features.map((feat: string) => (
              <li key={feat} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-px text-emerald-500">✓</span>
                {feat}
              </li>
            ))}
          </ul>
        </div>

        {/* Billing portal button (only if has active subscription) */}
        {hasActiveSubscription && (
          <button
            type="button"
            onClick={handleManageBilling}
            disabled={isPending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              '💳'
            )}
            Manage Billing &amp; Invoices
          </button>
        )}

        {/* Upgrade section (only if not on premium) */}
        {currentTierIdx < tierIndex('premium') && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-3">Upgrade your plan</p>

            {/* Interval toggle */}
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setUpgradeInterval('month')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                  upgradeInterval === 'month'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setUpgradeInterval('year')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                  upgradeInterval === 'year'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                Annual
                <span className="ml-1 text-[10px] text-emerald-500 font-semibold">Save 15%</span>
              </button>
            </div>

            {/* Upgrade cards */}
            <div className="space-y-2">
              {(TIER_ORDER.filter(
                (t) => tierIndex(t) > currentTierIdx && t !== 'hosting'
              ) as Exclude<WaasPackageTier, 'hosting'>[]).map((tier) => {
                const display      = WAAS_PLAN_DISPLAY[tier]
                const isAnnualOnly = tier === 'hosting_only'
                // For annual-only tiers show the flat yearly price, otherwise per-month breakdown
                const priceLabel = isAnnualOnly
                  ? `$${display.yearlyPrice}/yr`
                  : upgradeInterval === 'month'
                    ? `$${display.monthlyPrice}/mo`
                    : `$${Math.round(display.yearlyPrice / 12)}/mo`
                return (
                  <div
                    key={tier}
                    className={`rounded-xl border p-3.5 ${
                      display.highlighted
                        ? 'border-blue-200 bg-blue-50/50'
                        : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{display.label}</p>
                        <p className="text-[11px] text-slate-500">
                          {priceLabel}
                          {isAnnualOnly ? (
                            <span className="ml-1 text-teal-600 font-medium">· annual only</span>
                          ) : upgradeInterval === 'year' ? (
                            <span className="ml-1 text-emerald-600">billed annually</span>
                          ) : null}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpgrade(tier)}
                        disabled={isPending}
                        className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          display.highlighted
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-slate-800 hover:bg-slate-900 text-white'
                        }`}
                      >
                        {isPending ? '…' : 'Upgrade'}
                      </button>
                    </div>
                    <ul className="space-y-0.5">
                      {display.features.slice(0, 3).map((feat: string) => (
                        <li key={feat} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                          <span className="text-emerald-500 mt-px">✓</span>
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
