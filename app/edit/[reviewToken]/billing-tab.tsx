'use client'

// =============================================================================
// app/edit/[reviewToken]/billing-tab.tsx
// Phase 8.2 — Tenant Portal: Billing Tab
//
// Shows the tenant's current plan, billing interval, upgrade options,
// payment failure banner, and post-checkout success confirmation.
//
// Data is pre-loaded server-side in page.tsx and passed as props.
// All Stripe redirects (portal / checkout) use existing server actions.
// =============================================================================

import { useState, useTransition } from 'react'
import Link from 'next/link'
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

interface BillingTabProps {
  tenantId:       string
  reviewToken:    string
  billingStatus:  TenantBillingStatus | null
  /** Present when returning from Stripe Checkout (?checkout=success) */
  checkoutSuccess?: boolean
}

// ---------------------------------------------------------------------------
// Tier ordering for upgrade options
// ---------------------------------------------------------------------------

const TIER_ORDER: WaasPackageTier[] = ['hosting', 'hosting_only', 'standard', 'premium']

function tierRank(t: WaasPackageTier): number {
  return TIER_ORDER.indexOf(t)
}

// ---------------------------------------------------------------------------
// Helper: status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: TenantBillingStatus | null }) {
  if (!status) return null

  const { hasActiveSubscription, packageTier, stripeSubscriptionId } = status

  if (packageTier === 'hosting') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Free plan
      </span>
    )
  }

  // Subscription exists but not active (payment failed / cancelled)
  if (stripeSubscriptionId && !hasActiveSubscription) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-full">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        Payment issue
      </span>
    )
  }

  if (hasActiveSubscription) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Active
      </span>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Current plan card
// ---------------------------------------------------------------------------

function CurrentPlanCard({
  billingStatus,
  tenantId,
  reviewToken,
}: {
  billingStatus: TenantBillingStatus
  tenantId: string
  reviewToken: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]           = useState<string | null>(null)

  const { packageTier, planInterval, planDisplay, hasActiveSubscription } = billingStatus

  const isFree       = packageTier === 'hosting'
  const isAnnualOnly = packageTier === 'hosting_only'
  const intervalLabel = planInterval === 'year' ? 'Annual' : planInterval === 'month' ? 'Monthly' : null

  function openBillingPortal() {
    setError(null)
    startTransition(async () => {
      const res = await createBillingPortalSession({
        tenantId,
        returnUrl: `${window.location.origin}/edit/${reviewToken}?tab=billing`,
      })
      if (res.success && res.data?.url) {
        window.location.href = res.data.url
      } else {
        setError(res.error ?? 'Could not open billing portal.')
      }
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Current plan</p>
          <div className="flex items-center gap-3">
            <h3 className="text-2xl font-extrabold text-slate-900">{planDisplay.label}</h3>
            <StatusBadge status={billingStatus} />
          </div>
          {intervalLabel && (
            <p className="mt-1 text-sm text-slate-500">{intervalLabel} billing</p>
          )}
        </div>

        {/* Price */}
        <div className="text-right shrink-0">
          {isFree ? (
            <span className="text-3xl font-extrabold text-slate-900">Free</span>
          ) : isAnnualOnly ? (
            <div>
              <span className="text-3xl font-extrabold text-slate-900">$199</span>
              <span className="text-sm text-slate-400 ml-1">/ year</span>
            </div>
          ) : planInterval === 'year' ? (
            <div>
              <span className="text-3xl font-extrabold text-slate-900">${planDisplay.yearlyPrice}</span>
              <span className="text-sm text-slate-400 ml-1">/ year</span>
            </div>
          ) : (
            <div>
              <span className="text-3xl font-extrabold text-slate-900">${planDisplay.monthlyPrice}</span>
              <span className="text-sm text-slate-400 ml-1">/ month</span>
            </div>
          )}
        </div>
      </div>

      {/* Feature list */}
      <ul className="space-y-2 mb-6">
        {planDisplay.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
            <svg className="h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="8" className="fill-emerald-50" />
              <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      {/* Actions */}
      {!isFree && hasActiveSubscription && (
        <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-3">
          <button
            onClick={openBillingPortal}
            disabled={isPending}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2 disabled:opacity-50"
          >
            {isPending ? 'Opening…' : 'Manage billing & invoices →'}
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={openBillingPortal}
            disabled={isPending}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 underline underline-offset-2 disabled:opacity-50"
          >
            Cancel subscription
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Payment failure banner
// ---------------------------------------------------------------------------

function PaymentFailureBanner({
  tenantId,
  reviewToken,
}: {
  tenantId: string
  reviewToken: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]           = useState<string | null>(null)

  function openPortal() {
    setError(null)
    startTransition(async () => {
      const res = await createBillingPortalSession({
        tenantId,
        returnUrl: `${window.location.origin}/edit/${reviewToken}?tab=billing`,
      })
      if (res.success && res.data?.url) {
        window.location.href = res.data.url
      } else {
        setError(res.error ?? 'Could not open billing portal.')
      }
    })
  }

  return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
      <div className="shrink-0 mt-0.5">
        <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-800">Payment issue — action required</p>
        <p className="text-xs text-red-600 mt-0.5">
          Your last payment didn&apos;t go through. Please update your payment method to keep your plan active.
        </p>
        {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
      </div>
      <button
        onClick={openPortal}
        disabled={isPending}
        className="shrink-0 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Opening…' : 'Update payment'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Checkout success banner
// ---------------------------------------------------------------------------

function CheckoutSuccessBanner({ tier }: { tier: WaasPackageTier }) {
  const plan = WAAS_PLAN_DISPLAY[tier]
  return (
    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
      <div className="shrink-0 mt-0.5">
        <svg className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-emerald-800">
          🎉 You&apos;re now on the {plan.label} plan!
        </p>
        <p className="text-xs text-emerald-700 mt-0.5">
          Your subscription is active. All plan features are now unlocked.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Upgrade options
// ---------------------------------------------------------------------------

function UpgradeOptions({
  currentTier,
  tenantId,
  reviewToken,
}: {
  currentTier: WaasPackageTier
  tenantId:    string
  reviewToken: string
}) {
  const [interval, setInterval]       = useState<'month' | 'year'>('year')
  const [loadingTier, setLoadingTier] = useState<WaasPackageTier | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [, startTransition]           = useTransition()

  const upgradeTiers = TIER_ORDER.filter(
    (t): t is 'hosting_only' | 'standard' | 'premium' =>
      tierRank(t) > tierRank(currentTier) && t !== 'hosting',
  )

  if (upgradeTiers.length === 0) return null

  function handleUpgrade(tier: 'hosting_only' | 'standard' | 'premium') {
    const chosenInterval = tier === 'hosting_only' ? 'year' : interval
    setError(null)
    setLoadingTier(tier)
    startTransition(async () => {
      const res = await createCheckoutSession({
        tenantId,
        packageTier: tier,
        interval: chosenInterval,
        successUrl: `${window.location.origin}/edit/${reviewToken}?tab=billing&checkout=success`,
        cancelUrl:  `${window.location.origin}/edit/${reviewToken}?tab=billing`,
      })
      if (res.success && res.data?.url) {
        window.location.href = res.data.url
      } else {
        setError(res.error ?? 'Could not create checkout session.')
        setLoadingTier(null)
      }
    })
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-slate-700">Upgrade your plan</h4>
        {/* Interval toggle — only shown if any upgrade tier supports monthly */}
        {upgradeTiers.some((t) => t !== 'hosting_only') && (
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5 text-xs">
            <button
              onClick={() => setInterval('month')}
              className={`px-3 py-1 rounded-full font-medium transition-all ${interval === 'month' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval('year')}
              className={`px-3 py-1 rounded-full font-medium transition-all flex items-center gap-1 ${interval === 'year' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              Annual
              <span className="text-[9px] font-bold text-emerald-600">–15%</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {upgradeTiers.map((tier) => {
          const plan         = WAAS_PLAN_DISPLAY[tier]
          const isAnnualOnly = tier === 'hosting_only'
          const price        = isAnnualOnly
            ? plan.yearlyPrice
            : interval === 'year'
              ? plan.yearlyPrice
              : plan.monthlyPrice
          const priceSub = isAnnualOnly ? '/yr · annual only' : interval === 'year' ? '/year' : '/month'
          const isLoading    = loadingTier === tier

          return (
            <div
              key={tier}
              className={`relative rounded-xl border p-5 transition-all ${
                plan.highlighted ? 'border-blue-400 bg-blue-50/30 shadow-sm' : 'border-slate-200 bg-white'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-2.5 left-4 text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                  Recommended
                </span>
              )}
              {isAnnualOnly && (
                <span className="absolute -top-2.5 left-4 text-[10px] font-bold uppercase tracking-wider text-teal-600 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                  Annual only
                </span>
              )}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-800">{plan.label}</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl font-extrabold text-slate-900">${price}</span>
                    <span className="text-xs text-slate-400">{priceSub}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleUpgrade(tier)}
                  disabled={isLoading || loadingTier !== null}
                  className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50 ${
                    plan.highlighted
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-slate-900 hover:bg-slate-700 text-white'
                  }`}
                >
                  {isLoading ? 'Redirecting…' : 'Upgrade →'}
                </button>
              </div>
              <ul className="space-y-1">
                {plan.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <svg className="h-3 w-3 shrink-0 text-emerald-500" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BillingTab({
  tenantId,
  reviewToken,
  billingStatus,
  checkoutSuccess,
}: BillingTabProps) {
  const showPaymentFailure =
    billingStatus?.stripeSubscriptionId &&
    !billingStatus.hasActiveSubscription &&
    billingStatus.packageTier !== 'hosting'

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Page title */}
        <div>
          <h2 className="text-base font-semibold text-slate-800">Billing & Plan</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your subscription, view invoices, or upgrade your plan.
          </p>
        </div>

        {/* Post-checkout success banner */}
        {checkoutSuccess && billingStatus && (
          <CheckoutSuccessBanner tier={billingStatus.packageTier} />
        )}

        {/* Payment failure banner */}
        {showPaymentFailure && (
          <PaymentFailureBanner tenantId={tenantId} reviewToken={reviewToken} />
        )}

        {/* Current plan card */}
        {billingStatus ? (
          <CurrentPlanCard
            billingStatus={billingStatus}
            tenantId={tenantId}
            reviewToken={reviewToken}
          />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-400">
            Unable to load billing information.
          </div>
        )}

        {/* Upgrade options */}
        {billingStatus && (
          <UpgradeOptions
            currentTier={billingStatus.packageTier}
            tenantId={tenantId}
            reviewToken={reviewToken}
          />
        )}

        {/* Link to public pricing page */}
        <p className="text-xs text-center text-slate-400 pt-2">
          View full feature comparison on our{' '}
          <Link href="/waas-plans" className="text-blue-600 hover:underline" target="_blank">
            pricing page
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
