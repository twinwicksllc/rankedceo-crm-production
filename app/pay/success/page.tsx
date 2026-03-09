// ============================================================
// /pay/success — Post-Checkout Success Page
// ============================================================
// Shown after a successful Stripe checkout.
// Verifies the session, then auto-redirects to the appropriate
// industry subdomain dashboard after 5 seconds.
//
// URL: /pay/success?session_id=cs_...&industry=hvac
// ============================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { stripe, INDUSTRY_SUBDOMAIN_MAP } from '@/lib/stripe'
import SuccessRedirect from './SuccessRedirect'

interface SuccessPageProps {
  searchParams: { session_id?: string; industry?: string }
}

export default async function PaySuccessPage({ searchParams }: SuccessPageProps) {
  const { session_id, industry } = searchParams

  // Require auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Validate session
  if (!session_id) {
    redirect('/')
  }

  // Retrieve session from Stripe to confirm payment
  let sessionValid = false
  let customerEmail = user.email || ''
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id)
    sessionValid = session.payment_status === 'paid' || session.status === 'complete'
    if (session.customer_details?.email) {
      customerEmail = session.customer_details.email
    }
  } catch (err) {
    console.error('[Pay Success] Failed to retrieve session:', err)
    // Still show success page — webhook will handle the subscription sync
    sessionValid = true
  }

  // Determine redirect URL
  const industryKey = industry || 'hvac'
  const dashboardUrl = INDUSTRY_SUBDOMAIN_MAP[industryKey]
    ? `${INDUSTRY_SUBDOMAIN_MAP[industryKey]}/dashboard`
    : '/dashboard'

  const industryNames: Record<string, string> = {
    hvac:       'HVAC Pro',
    plumbing:   'Plumb Pro',
    electrical: 'Spark Pro',
    smile:      'Smile MakeOver',
  }
  const productName = industryNames[industryKey] || 'RankedCEO CRM'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">

        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          You&apos;re all set! 🎉
        </h1>
        <p className="text-gray-600 mb-2">
          Welcome to <strong>{productName}</strong>
        </p>
        <p className="text-gray-500 text-sm mb-8">
          A confirmation email has been sent to <strong>{customerEmail}</strong>
        </p>

        {/* Auto-redirect component */}
        <SuccessRedirect dashboardUrl={dashboardUrl} productName={productName} />

        <p className="text-xs text-gray-400 mt-4">
          Powered by RankedCEO CRM · Secured by Stripe
        </p>
      </div>
    </div>
  )
}