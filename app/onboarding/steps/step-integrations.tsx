'use client'

// =============================================================================
// Step 4: Integrations & Sales Hooks
// Calendly URL, Financing toggle, USP textarea
// =============================================================================

import React from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { Step4FormData } from '../onboarding-flow'

interface Props {
  form:      UseFormReturn<Step4FormData>
  onSubmit:  (data: Step4FormData) => void
  onBack:    () => void
  isLoading: boolean
}

export function StepIntegrations({ form, onSubmit, onBack, isLoading }: Props) {
  const { register, handleSubmit, watch, formState: { errors } } = form
  const financingEnabled = watch('financing_enabled')
  const uspValue         = watch('usp') ?? ''

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
          <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Step 4 of 4</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
          Integrations & your edge
        </h1>
        <p className="text-white/50 mt-2 text-sm sm:text-base">
          Connect your booking system and tell us what makes you the best choice.
        </p>
      </div>

      <div className="space-y-6">
        {/* Calendly URL */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">
            Booking / Scheduling URL
          </label>
          <p className="text-white/35 text-xs mb-2">
            Your Calendly, Acuity, or any online booking link
          </p>
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white/30">
                <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 1v2M11 1v2M1 6h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <input
              {...register('calendly_url')}
              type="url"
              placeholder="https://calendly.com/yourbusiness"
              className={`w-full h-12 sm:h-14 pl-10 pr-4 rounded-xl bg-white/5 border ${
                errors.calendly_url ? 'border-red-500/50' : 'border-white/10 focus:border-blue-500/60'
              } text-white placeholder:text-white/25 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
            />
          </div>
          {errors.calendly_url && (
            <p className="mt-1.5 text-xs text-red-400">{errors.calendly_url.message}</p>
          )}
        </div>

        {/* Financing Toggle */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-3">
            Financing Integration
          </label>
          <label className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/7 transition-all group">
            <div className="relative mt-0.5 shrink-0">
              <input
                {...register('financing_enabled')}
                type="checkbox"
                className="sr-only peer"
              />
              <div className={`w-11 h-6 rounded-full transition-all duration-200 ${
                financingEnabled ? 'bg-blue-600' : 'bg-white/15'
              }`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                  financingEnabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-white font-medium text-sm">
                  Enable Financing Options
                </p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium border border-amber-500/20">
                  Coming Soon
                </span>
              </div>
              <p className="text-white/40 text-xs mt-1">
                Integrate Optimus/Pricebook financing to offer payment plans to your customers. Increases conversion by up to 40%.
              </p>
            </div>
          </label>
        </div>

        {/* USP */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">
            Your Unique Selling Proposition <span className="text-red-400">*</span>
          </label>
          <p className="text-white/35 text-xs mb-2">
            What makes your business better than your competitors? Be specific — this becomes your homepage headline.
          </p>
          <textarea
            {...register('usp')}
            rows={4}
            placeholder="e.g. We're the only HVAC company in Chicago that offers same-day service with a 100% satisfaction guarantee. Our technicians are NATE-certified and we've never missed an appointment in 12 years."
            className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
              errors.usp ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-blue-500/60'
            } text-white placeholder:text-white/25 text-sm outline-none focus:ring-2 ${
              errors.usp ? 'focus:ring-red-500/20' : 'focus:ring-blue-500/20'
            } transition-all resize-none leading-relaxed`}
          />
          <div className="flex items-center justify-between mt-1.5">
            {errors.usp
              ? <p className="text-xs text-red-400">{errors.usp.message}</p>
              : <span />
            }
            <span className={`text-xs ml-auto ${
              uspValue.length > 450 ? 'text-amber-400' : 'text-white/25'
            }`}>
              {uspValue.length}/500
            </span>
          </div>
        </div>

        {/* Summary box */}
        <div className="rounded-xl bg-gradient-to-br from-blue-500/5 to-violet-500/5 border border-blue-500/15 p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#60A5FA" strokeWidth="1.5"/>
                <path d="M8 5v4M8 10.5v.5" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="text-blue-300 font-semibold text-sm mb-1">What happens next?</p>
              <p className="text-blue-200/50 text-xs leading-relaxed">
                After you submit, our team reviews your information and begins building your AdvantagePoint website. You'll receive a confirmation email and your site will be live within 48 hours.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        <button
          type="button"
          onClick={onBack}
          className="h-14 px-6 rounded-xl border border-white/15 text-white/60 hover:text-white hover:border-white/30 font-medium text-sm transition-all"
        >
          ← Back
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 h-14 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold text-base hover:from-blue-500 hover:to-violet-500 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              Submitting…
            </>
          ) : (
            <>
              🚀 Submit & Start Building
            </>
          )}
        </button>
      </div>
    </form>
  )
}