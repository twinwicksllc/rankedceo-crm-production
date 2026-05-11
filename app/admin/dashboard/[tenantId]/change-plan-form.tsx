'use client'

// =============================================================================
// app/admin/dashboard/[tenantId]/change-plan-form.tsx
// Phase 7.4: Admin "Change Plan" panel
//
// Allows Tom & Darrick to manually override a tenant's package_tier and
// plan_interval without touching Stripe (useful for comped accounts,
// manual invoicing, and test mode tenants).
//
// Calls adminUpdateTenantPlan() server action on submit.
// =============================================================================

import { useState, useTransition } from 'react'
import { adminUpdateTenantPlan } from '@/lib/waas/actions/billing'
import { WAAS_PLAN_DISPLAY } from '@/lib/waas/billing-config'
import type { WaasPackageTier } from '@/lib/waas/types'

interface ChangePlanFormProps {
  tenantId:     string
  currentTier:  WaasPackageTier
  currentInterval: 'month' | 'year' | null
}

export function ChangePlanForm({ tenantId, currentTier, currentInterval }: ChangePlanFormProps) {
  const [tier,     setTier]     = useState<WaasPackageTier>(currentTier)
  const [interval, setInterval] = useState<'month' | 'year' | null>(currentInterval)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setSuccess(false)
    setError(null)
    startTransition(async () => {
      const result = await adminUpdateTenantPlan({
        tenantId,
        packageTier: tier,
        interval:    tier === 'hosting' ? null
                   : tier === 'hosting_only' ? 'year'  // annual-only tier
                   : interval,
      })
      if (result.success) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(result.error ?? 'Failed to update plan')
      }
    })
  }

  const isDirty = tier !== currentTier || interval !== currentInterval

  return (
    <div className="space-y-4">
      {/* Tier selector */}
      <div>
        <p className="text-white/35 text-[10px] uppercase tracking-wide mb-2">Package Tier</p>
        <div className="grid grid-cols-4 gap-2">
          {(['hosting', 'hosting_only', 'standard', 'premium'] as WaasPackageTier[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                tier === t
                  ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                  : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/70'
              }`}
            >
              {WAAS_PLAN_DISPLAY[t].label}
            </button>
          ))}
        </div>
        {tier === 'hosting_only' && (
          <p className="mt-1.5 text-teal-400 text-[10px]">
            ℹ️ Hosting Only is billed annually — interval will be set to &quot;year&quot; automatically.
          </p>
        )}
      </div>

      {/* Interval selector (only for paid tiers) */}
      {/* Interval selector — only for standard/premium (hosting_only is annual-only) */}
      {tier !== 'hosting' && tier !== 'hosting_only' && (
        <div>
          <p className="text-white/35 text-[10px] uppercase tracking-wide mb-2">Billing Interval</p>
          <div className="grid grid-cols-2 gap-2">
            {(['month', 'year'] as const).map((int) => (
              <button
                key={int}
                type="button"
                onClick={() => setInterval(int)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                  interval === int
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                    : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/70'
                }`}
              >
                {int === 'month' ? 'Monthly' : 'Annual'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!isDirty || isPending}
        className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-xs font-semibold text-white transition-all"
      >
        {isPending ? 'Saving…' : success ? '✓ Saved' : 'Save Plan Override'}
      </button>

      {/* Note */}
      <p className="text-white/25 text-[10px]">
        This is a manual override — Stripe subscription is not modified. Use this for comped
        accounts, manual invoicing, or test tenants.
      </p>

      {error && (
        <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
