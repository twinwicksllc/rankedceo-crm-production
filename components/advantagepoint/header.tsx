// =============================================================================
// AdvantagePoint — Shared Header Component
// Used across /onboarding and /admin routes
// =============================================================================

import React from 'react'
import Link from 'next/link'

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
  return (
    <header className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo / Wordmark */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-shadow">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L3 7v11h5v-6h4v6h5V7L10 2z" fill="white" fillOpacity="0.9"/>
                <path d="M10 2L17 7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="10" cy="6" r="1.5" fill="white"/>
              </svg>
            </div>
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 opacity-20 blur group-hover:opacity-40 transition-opacity" />
          </div>
          <div>
            <span className="text-white font-bold text-lg tracking-tight leading-none block">
              AdvantagePoint
            </span>
            <span className="text-white/40 text-[10px] font-medium tracking-widest uppercase leading-none">
              {variant === 'admin' ? 'Command Center' : 'Onboarding'}
            </span>
          </div>
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

        {/* Admin badge */}
        {variant === 'admin' && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/60 text-xs font-medium">Admin Mode</span>
          </div>
        )}
      </div>
    </header>
  )
}