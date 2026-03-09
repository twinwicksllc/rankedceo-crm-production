// ============================================================
// /dashboard/billing — Billing & Subscription Management
// ============================================================
// Shows the user's current subscription status, plan details,
// billing history, and options to upgrade, cancel, or manage
// payment methods via the Stripe Billing Portal.
// ============================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionService } from '@/lib/services/subscription-service'
import { PLAN_INFO, STRIPE_PRICE_IDS } from '@/lib/stripe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import BillingActions from './BillingActions'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch all subscriptions for this user
  const subscriptionService = new SubscriptionService()
  const { data: subscriptions } = await subscriptionService.getAllSubscriptions(user.id)

  // Get user's Stripe customer ID
  const { data: userRecord } = await supabase
    .from('users')
    .select('crm_stripe_customer_id')
    .eq('id', user.id)
    .single()

  const hasCustomer = !!userRecord?.crm_stripe_customer_id
  const activeSubscriptions = subscriptions?.filter(s =>
    ['active', 'trialing', 'past_due'].includes(s.status)
  ) || []

  const statusColors: Record<string, string> = {
    active:     'bg-green-100 text-green-700',
    trialing:   'bg-blue-100 text-blue-700',
    past_due:   'bg-yellow-100 text-yellow-700',
    canceled:   'bg-gray-100 text-gray-600',
    incomplete: 'bg-orange-100 text-orange-700',
    unpaid:     'bg-red-100 text-red-700',
  }

  const industryEmoji: Record<string, string> = {
    hvac:       '❄️',
    plumbing:   '🔧',
    electrical: '⚡',
    smile:      '😁',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your plans, payment methods, and invoices</p>
      </div>

      {/* Active Subscriptions */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Your Subscriptions</h2>

        {activeSubscriptions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No active subscriptions</h3>
              <p className="text-gray-500 mb-6">
                Get started by subscribing to one of our industry products.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                {(['hvac', 'plumbing', 'electrical', 'smile'] as const).map(industry => (
                  <a
                    key={industry}
                    href={`/pay?product=${industry}-pro-monthly`}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                  >
                    {industryEmoji[industry]} {PLAN_INFO[industry].name}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          activeSubscriptions.map(sub => {
            const planInfo = PLAN_INFO[sub.industry]
            const periodEnd = new Date(sub.current_period_end).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric'
            })

            return (
              <Card key={sub.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{industryEmoji[sub.industry]}</span>
                      <div>
                        <CardTitle className="text-lg">{planInfo?.name || sub.plan_name}</CardTitle>
                        <CardDescription>
                          {sub.billing_interval === 'monthly' ? 'Monthly' : 'Annual'} plan ·{' '}
                          ${(sub.amount_cents / 100).toFixed(2)}/{sub.billing_interval === 'monthly' ? 'mo' : 'yr'}
                        </CardDescription>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${statusColors[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                      {sub.status.replace('_', ' ')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-500">Current period ends</p>
                      <p className="font-medium">{periodEnd}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Plan tier</p>
                      <p className="font-medium capitalize">{sub.plan_tier}</p>
                    </div>
                    {sub.cancel_at_period_end && (
                      <div className="col-span-2">
                        <p className="text-yellow-600 text-sm font-medium">
                          ⚠️ Subscription will cancel on {periodEnd}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Upgrade option for monthly subscribers */}
                  {sub.billing_interval === 'monthly' && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                      <p className="text-sm text-blue-700">
                        💡 <strong>Save money</strong> — switch to annual billing and save up to 15%
                      </p>
                      <a
                        href={`/pay?product=${sub.industry}-pro-yearly`}
                        className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium underline"
                      >
                        Switch to Annual →
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Past/Canceled Subscriptions */}
      {subscriptions && subscriptions.filter(s => s.status === 'canceled').length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-500">Past Subscriptions</h2>
          {subscriptions.filter(s => s.status === 'canceled').map(sub => (
            <Card key={sub.id} className="opacity-60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{industryEmoji[sub.industry]}</span>
                    <div>
                      <CardTitle className="text-base">{PLAN_INFO[sub.industry]?.name || sub.plan_name}</CardTitle>
                      <CardDescription>Canceled</CardDescription>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-500">
                    Canceled
                  </span>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Billing Management */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Management</CardTitle>
          <CardDescription>
            Update payment methods, download invoices, and manage your billing details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BillingActions
            hasCustomer={hasCustomer}
            hasActiveSubscription={activeSubscriptions.length > 0}
            subscriptions={activeSubscriptions}
          />
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>Subscribe to additional industry products</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['hvac', 'plumbing', 'electrical', 'smile'] as const).map(industry => {
              const isSubscribed = activeSubscriptions.some(s => s.industry === industry)
              const planInfo = PLAN_INFO[industry]

              return (
                <div
                  key={industry}
                  className={`border rounded-xl p-4 ${isSubscribed ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{industryEmoji[industry]}</span>
                    <h3 className="font-semibold">{planInfo.name}</h3>
                    {isSubscribed && (
                      <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-3">
                    From ${planInfo.monthlyPrice}/mo
                  </p>
                  {!isSubscribed && (
                    <a
                      href={`/pay?product=${industry}-pro-monthly`}
                      className="inline-block text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-4 rounded-lg transition-colors"
                    >
                      Subscribe →
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}