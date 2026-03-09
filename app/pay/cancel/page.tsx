// ============================================================
// /pay/cancel — Checkout Cancelled Page
// ============================================================
// Shown when a user cancels out of the Stripe checkout.
// Offers them a way to go back or return to the landing page.
//
// URL: /pay/cancel?industry=hvac
// ============================================================

import Link from 'next/link'
import { INDUSTRY_SUBDOMAIN_MAP, PLAN_INFO } from '@/lib/stripe'

interface CancelPageProps {
  searchParams: { industry?: string }
}

export default function PayCancelPage({ searchParams }: CancelPageProps) {
  const industry = searchParams.industry || 'hvac'
  const landingUrl = INDUSTRY_SUBDOMAIN_MAP[industry] || '/'
  const planInfo = PLAN_INFO[industry]

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">

        {/* Icon */}
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Checkout Cancelled
        </h1>
        <p className="text-gray-600 mb-8">
          No worries — you haven&apos;t been charged. You can try again whenever you&apos;re ready.
        </p>

        <div className="space-y-3">
          {/* Try again */}
          <Link
            href={`/pay?product=${industry}-pro-monthly`}
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200"
          >
            Try Again
          </Link>

          {/* Back to landing page */}
          <a
            href={landingUrl}
            className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors duration-200"
          >
            Back to {planInfo?.name || 'Landing Page'}
          </a>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Questions? Contact us at{' '}
          <a href="mailto:support@rankedceo.com" className="text-blue-500 hover:underline">
            support@rankedceo.com
          </a>
        </p>
      </div>
    </div>
  )
}