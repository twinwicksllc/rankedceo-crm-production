'use client'

// =============================================================================
// AdvantagePoint — Shared Header Component
// Used across /onboarding and /admin routes
// =============================================================================

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useOnboardingTheme } from '@/app/get-started/theme-context'

interface AdvantagePointHeaderProps {
  variant?: 'onboarding' | 'admin'
  step?:    number
  totalSteps?: number
}

export function AdvantagePointHeader({
  variant = 'onboarding',
  step,
  totalSteps,
}: AdvantagePointHeaderProps) {
  const { theme, toggleTheme } = useOnboardingTheme()
  const isLightOnboarding = variant === 'onboarding' && theme === 'light'

  return (
    <header
      className={`relative z-10 backdrop-blur-xl ${
        isLightOnboarding
          ? 'border-b border-slate-500/40 bg-slate-700/95'
          : 'border-b border-white/10 bg-black/20'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo / Wordmark */}
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/ranked_logo.png"
            alt="RankedCEO"
            width={168}
            height={36}
            className="h-8 w-auto object-contain"
            priority
          />
        </Link>

        {/* Progress indicator (onboarding only) */}
        {variant === 'onboarding' && step && totalSteps && (
          <div className="hidden sm:flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i + 1 < step
                    ? 'w-6 bg-blue-500'
                    : i + 1 === step
                    ? 'w-8 bg-gradient-to-r from-blue-500 to-violet-500'
                    : 'w-4 bg-white/20'
                }`}
              />
            ))}
            <span className="text-white/40 text-xs ml-2 font-medium">
              {step} of {totalSteps}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {variant === 'onboarding' && (
            <button
              type="button"
              onClick={toggleTheme}
              className="h-9 px-3 rounded-lg border border-white/20 text-white/70 hover:text-white transition-colors text-xs font-semibold"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </button>
          )}

          {/* Admin badge */}
          {variant === 'admin' && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/60 text-xs font-medium">Admin Mode</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}