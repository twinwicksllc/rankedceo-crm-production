'use client'

// ============================================================
// SuccessRedirect — Client Component
// ============================================================
// Counts down 5 seconds then redirects to the industry dashboard.
// ============================================================

import { useEffect, useState } from 'react'

interface SuccessRedirectProps {
  dashboardUrl: string
  productName: string
}

export default function SuccessRedirect({ dashboardUrl, productName }: SuccessRedirectProps) {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          window.location.href = dashboardUrl
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [dashboardUrl])

  return (
    <div>
      <p className="text-gray-600 text-sm mb-4">
        Redirecting to your {productName} dashboard in{' '}
        <span className="font-bold text-blue-600">{countdown}</span> seconds...
      </p>
      <a
        href={dashboardUrl}
        className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors duration-200"
      >
        Go to Dashboard →
      </a>
    </div>
  )
}