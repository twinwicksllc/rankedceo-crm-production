// ============================================================
// /pay — Checkout Controller Page
// ============================================================
// Entry point for all subscription checkouts.
// Reads ?product= query param, maps to priceId, then either:
//   1. Redirects to login if not authenticated
//   2. Creates a Stripe checkout session and redirects
//
// URL format: /pay?product=hvac-pro-monthly
//             /pay?product=smile-pro-yearly
// ============================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { STRIPE_PRICE_IDS, PLAN_INFO } from '@/lib/stripe'
import CheckoutButton from './CheckoutButton'

// Map product slug → { priceId, industry, interval }
const PRODUCT_MAP: Record<string, { priceId: string; industry: string; interval: 'monthly' | 'yearly' }> = {
  'hvac-pro-monthly':       { priceId: STRIPE_PRICE_IDS.hvac.monthly,       industry: 'hvac',       interval: 'monthly' },
  'hvac-pro-yearly':        { priceId: STRIPE_PRICE_IDS.hvac.yearly,         industry: 'hvac',       interval: 'yearly'  },
  'plumbing-pro-monthly':   { priceId: STRIPE_PRICE_IDS.plumbing.monthly,    industry: 'plumbing',   interval: 'monthly' },
  'plumbing-pro-yearly':    { priceId: STRIPE_PRICE_IDS.plumbing.yearly,     industry: 'plumbing',   interval: 'yearly'  },
  'electrical-pro-monthly': { priceId: STRIPE_PRICE_IDS.electrical.monthly,  industry: 'electrical', interval: 'monthly' },
  'electrical-pro-yearly':  { priceId: STRIPE_PRICE_IDS.electrical.yearly,   industry: 'electrical', interval: 'yearly'  },
  'smile-pro-monthly':      { priceId: STRIPE_PRICE_IDS.smile.monthly,       industry: 'smile',      interval: 'monthly' },
  'smile-pro-yearly':       { priceId: STRIPE_PRICE_IDS.smile.yearly,        industry: 'smile',      interval: 'yearly'  },
}

interface PayPageProps {
  searchParams: { product?: string }
}

export default async function PayPage({ searchParams }: PayPageProps) {
  const productSlug = searchParams.product

  // Validate product
  if (!productSlug || !PRODUCT_MAP[productSlug]) {
    redirect('/')
  }

  const { priceId, industry, interval } = PRODUCT_MAP[productSlug]
  const planInfo = PLAN_INFO[industry]

  // Check auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Redirect to login, preserving the product param so we can return here
    redirect(`/login?redirect=/pay?product=${productSlug}`)
  }

  const price = interval === 'monthly' ? planInfo.monthlyPrice : planInfo.yearlyPrice
  const savings = interval === 'yearly'
    ? Math.round((planInfo.monthlyPrice * 12 - planInfo.yearlyPrice) / (planInfo.monthlyPrice * 12) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">
              {industry === 'hvac' ? '❄️' : industry === 'plumbing' ? '🔧' : industry === 'electrical' ? '⚡' : '😁'}
            </div>
            <div>
              <h1 className="text-xl font-bold">{planInfo.name}</h1>
              <p className="text-blue-100 text-sm">RankedCEO CRM</p>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-gray-900">${price}</span>
            <span className="text-gray-500 mb-1">/{interval === 'monthly' ? 'month' : 'year'}</span>
          </div>
          {interval === 'yearly' && savings > 0 && (
            <div className="mt-1">
              <span className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                Save {savings}% vs monthly
              </span>
            </div>
          )}
          <p className="text-gray-500 text-sm mt-2">
            {interval === 'monthly' ? 'Billed monthly. Cancel anytime.' : 'Billed annually.'}
          </p>
        </div>

        {/* Features */}
        <div className="px-8 py-6 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            What&apos;s included
          </h3>
          <ul className="space-y-2">
            {planInfo.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-green-500 font-bold">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="px-8 py-6">
          <CheckoutButton priceId={priceId} industry={industry} />
          <p className="text-center text-xs text-gray-400 mt-3">
            Secured by Stripe · 256-bit SSL encryption
          </p>
          <p className="text-center text-xs text-gray-400 mt-1">
            Logged in as {user.email}
          </p>
        </div>

      </div>
    </div>
  )
}