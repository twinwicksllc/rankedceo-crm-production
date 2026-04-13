'use client'

// =============================================================================
// AdvantagePoint — Onboarding Success Screen
// =============================================================================

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdvantagePointHeader } from '@/components/advantagepoint/header'
import type { WaasPackageTier } from '@/lib/waas/types'

interface Props {
  businessName: string
  tier:         WaasPackageTier
}

const TIER_LABELS: Record<WaasPackageTier, string> = {
  hosting:  'Hosting',
  standard: 'Standard',
  premium:  'Premium',
}

export function OnboardingSuccess({ businessName, tier }: Props) {
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    setShowConfetti(true)
    const t = setTimeout(() => setShowConfetti(false), 4000)
    return () => clearTimeout(t)
  }, [])

  const steps = [
    { icon: '📧', label: 'Confirmation email sent',     time: 'Just now'    },
    { icon: '🔍', label: 'Team review begins',          time: 'Within 1h'   },
    { icon: '🏗️', label: 'Site build starts',           time: 'Within 24h'  },
    { icon: '🚀', label: 'Your site goes live',         time: 'Within 48h'  },
  ]

  return (
    <div className="flex flex-col flex-1">
      <AdvantagePointHeader variant="onboarding" />

      {/* Confetti particles (CSS-only) */}
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-sm animate-bounce"
              style={{
                left:            `${Math.random() * 100}%`,
                top:             `${-10 + Math.random() * 20}%`,
                backgroundColor: ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444'][i % 5],
                animationDelay:  `${Math.random() * 2}s`,
                animationDuration: `${1.5 + Math.random() * 2}s`,
                transform:       `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg text-center">

          {/* Success icon */}
          <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M8 20l8 8 16-16" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            You're in! 🎉
          </h1>
          <p className="text-white/60 text-base sm:text-lg leading-relaxed mb-2">
            <strong className="text-white">{businessName || 'Your business'}</strong> has been submitted for review.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8">
            <span className="text-blue-400 text-sm font-semibold">{TIER_LABELS[tier]} Plan</span>
            <span className="text-white/30 text-sm">•</span>
            <span className="text-white/50 text-sm">Pending Review</span>
          </div>

          {/* Timeline */}
          <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6 mb-8 text-left">
            <h3 className="text-white font-semibold text-sm mb-5 uppercase tracking-wider">What happens next</h3>
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg shrink-0">
                    {step.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{step.label}</p>
                  </div>
                  <span className="text-white/30 text-xs shrink-0">{step.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="flex-1 h-12 rounded-xl border border-white/15 text-white/60 hover:text-white hover:border-white/30 font-medium text-sm transition-all flex items-center justify-center"
            >
              Back to Home
            </Link>
            <a
              href="mailto:support@advantagepoint.com"
              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-sm hover:from-blue-500 hover:to-violet-500 transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="14" height="10" rx="2" stroke="white" strokeWidth="1.5"/>
                <path d="M1 5l7 5 7-5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}