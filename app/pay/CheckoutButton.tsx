'use client'

// ============================================================
// CheckoutButton — Client Component
// ============================================================
// Calls POST /api/stripe/create-checkout and redirects to
// the Stripe hosted checkout page.
// ============================================================

import { useState } from 'react'

interface CheckoutButtonProps {
  priceId: string
  industry: string
}

export default function CheckoutButton({ priceId, industry }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCheckout = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, industry }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to start checkout. Please try again.')
        return
      }

      // Redirect to Stripe hosted checkout
      window.location.href = data.url

    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Redirecting to payment...
          </>
        ) : (
          <>
            🔒 Proceed to Secure Payment
          </>
        )}
      </button>
    </div>
  )
}