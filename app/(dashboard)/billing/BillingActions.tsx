'use client'

// ============================================================
// BillingActions — Client Component
// ============================================================
// Handles billing portal redirect and subscription cancellation.
// ============================================================

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface Subscription {
  id: string
  stripe_subscription_id: string
  industry: string
  plan_name: string
  status: string
  cancel_at_period_end: boolean
  current_period_end: string
}

interface BillingActionsProps {
  hasCustomer: boolean
  hasActiveSubscription: boolean
  subscriptions: Subscription[]
}

export default function BillingActions({
  hasCustomer,
  hasActiveSubscription,
  subscriptions,
}: BillingActionsProps) {
  const [portalLoading, setPortalLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const openBillingPortal = async () => {
    setPortalLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to open billing portal')
        return
      }
      window.location.href = data.url
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPortalLoading(false)
    }
  }

  const cancelSubscription = async (stripeSubscriptionId: string, industry: string) => {
    if (!confirm(`Are you sure you want to cancel your ${industry} subscription? You'll retain access until the end of your billing period.`)) {
      return
    }

    setCancelLoading(stripeSubscriptionId)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripeSubscriptionId }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to cancel subscription')
        return
      }
      setSuccessMessage(data.message)
      // Refresh the page to show updated status
      setTimeout(() => window.location.reload(), 2000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setCancelLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          ✓ {successMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {/* Billing Portal — manage payment methods, invoices */}
        {hasCustomer && (
          <Button
            onClick={openBillingPortal}
            disabled={portalLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {portalLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Opening portal...
              </>
            ) : (
              <>💳 Manage Payment & Invoices</>
            )}
          </Button>
        )}
      </div>

      {/* Per-subscription cancel buttons */}
      {subscriptions.filter(s => !s.cancel_at_period_end).length > 0 && (
        <div className="border-t pt-4 mt-4">
          <p className="text-sm text-gray-500 mb-3">Cancel a subscription:</p>
          <div className="flex flex-wrap gap-2">
            {subscriptions
              .filter(s => !s.cancel_at_period_end)
              .map(sub => (
                <Button
                  key={sub.id}
                  onClick={() => cancelSubscription(sub.stripe_subscription_id, sub.industry)}
                  disabled={cancelLoading === sub.stripe_subscription_id}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                >
                  {cancelLoading === sub.stripe_subscription_id
                    ? 'Canceling...'
                    : `Cancel ${sub.industry} plan`}
                </Button>
              ))}
          </div>
        </div>
      )}

      {!hasCustomer && !hasActiveSubscription && (
        <p className="text-sm text-gray-500">
          No billing account found. Subscribe to a plan to get started.
        </p>
      )}
    </div>
  )
}