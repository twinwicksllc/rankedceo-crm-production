'use client'

// =============================================================================
// Step 1: Business Identity
// =============================================================================

import React from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { Step1FormData } from '../onboarding-flow'

const TRADES = [
  'Plumbing', 'HVAC', 'Electrical', 'Roofing', 'Landscaping',
  'Pest Control', 'Cleaning Services', 'Painting', 'Flooring',
  'General Contractor', 'Concrete & Masonry', 'Tree Service',
  'Garage Door', 'Locksmith', 'Pool & Spa', 'Other',
]

interface Props {
  form:       UseFormReturn<Step1FormData>
  onSubmit:   (data: Step1FormData) => void
  isLoading:  boolean
  auditId?:   string | null
}

export function StepBusinessIdentity({ form, onSubmit, isLoading, auditId }: Props) {
  const { register, handleSubmit, watch, formState: { errors } } = form
  const selectedTrade = watch('primary_trade')

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
          <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Step 1 of 4</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
          Tell us about your business
        </h1>
        <p className="text-white/50 mt-2 text-sm sm:text-base">
          This forms the foundation of your AdvantagePoint website.
        </p>
        {auditId && (
          <div className="mt-3 flex items-center gap-2 text-emerald-400 text-xs">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#34D399" strokeWidth="1.5"/>
              <path d="M4.5 7l2 2 3-3" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Linked to your SEO audit report
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="space-y-5">
        {/* Legal Name */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Business Legal Name <span className="text-red-400">*</span>
          </label>
          <input
            {...register('legal_name')}
            type="text"
            placeholder="e.g. Acme Plumbing LLC"
            className={inputClass(!!errors.legal_name)}
            autoFocus
          />
          {errors.legal_name && <p className="mt-1.5 text-xs text-red-400">{errors.legal_name.message}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Your Email Address <span className="text-red-400">*</span>
          </label>
          <input
            {...register('email')}
            type="email"
            placeholder="you@yourbusiness.com"
            className={inputClass(!!errors.email)}
          />
          {errors.email && <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>}
        </div>

        {/* Physical Address */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Business Address <span className="text-red-400">*</span>
          </label>
          <input
            {...register('physical_address')}
            type="text"
            placeholder="123 Main Street"
            className={inputClass(!!errors.physical_address)}
          />
          {errors.physical_address && <p className="mt-1.5 text-xs text-red-400">{errors.physical_address.message}</p>}
        </div>

        {/* City / State / ZIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-white/70 mb-2">
              City <span className="text-red-400">*</span>
            </label>
            <input
              {...register('city')}
              type="text"
              placeholder="Chicago"
              className={inputClass(!!errors.city)}
            />
            {errors.city && <p className="mt-1.5 text-xs text-red-400">{errors.city.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              State <span className="text-red-400">*</span>
            </label>
            <input
              {...register('state')}
              type="text"
              placeholder="IL"
              maxLength={2}
              className={inputClass(!!errors.state) + ' uppercase'}
            />
            {errors.state && <p className="mt-1.5 text-xs text-red-400">{errors.state.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              ZIP <span className="text-red-400">*</span>
            </label>
            <input
              {...register('zip')}
              type="text"
              placeholder="60601"
              maxLength={10}
              className={inputClass(!!errors.zip)}
            />
            {errors.zip && <p className="mt-1.5 text-xs text-red-400">{errors.zip.message}</p>}
          </div>
        </div>

        {/* Primary Trade */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Primary Trade / Service <span className="text-red-400">*</span>
          </label>
          <select
            {...register('primary_trade')}
            className={inputClass(!!errors.primary_trade) + ' cursor-pointer'}
          >
            <option value="">Select your trade…</option>
            {TRADES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errors.primary_trade && <p className="mt-1.5 text-xs text-red-400">{errors.primary_trade.message}</p>}
        </div>

        {selectedTrade === 'Other' && (
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Industry Type <span className="text-red-400">*</span>
            </label>
            <input
              {...register('primary_trade_other')}
              type="text"
              placeholder="e.g. Junk Removal"
              className={inputClass(!!errors.primary_trade_other)}
            />
            {errors.primary_trade_other && <p className="mt-1.5 text-xs text-red-400">{errors.primary_trade_other.message}</p>}
          </div>
        )}

        {/* Optional builder intake fields */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Tagline <span className="text-white/30">(optional)</span>
            </label>
            <input
              {...register('tagline')}
              type="text"
              placeholder="e.g. Fast, honest service done right"
              className={inputClass(!!errors.tagline)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Business Type <span className="text-white/30">(optional)</span>
            </label>
            <input
              {...register('business_type')}
              type="text"
              placeholder="e.g. Local service business"
              className={inputClass(!!errors.business_type)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Phone Number <span className="text-white/30">(optional)</span>
            </label>
            <input
              {...register('phone')}
              type="tel"
              placeholder="(312) 555-1212"
              className={inputClass(!!errors.phone)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Business Hours <span className="text-white/30">(optional)</span>
            </label>
            <input
              {...register('business_hours')}
              type="text"
              placeholder="Mon-Fri 8AM-6PM, Sat 9AM-2PM"
              className={inputClass(!!errors.business_hours)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Services / Products <span className="text-white/30">(optional)</span>
          </label>
          <textarea
            {...register('services_offered')}
            rows={3}
            placeholder="List your top services (comma separated), e.g. Drain cleaning, water heater repair, sewer line replacement"
            className={inputClass(!!errors.services_offered)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Target Audience <span className="text-white/30">(optional)</span>
          </label>
          <input
            {...register('target_audience')}
            type="text"
            placeholder="e.g. Homeowners in Chicago metro"
            className={inputClass(!!errors.target_audience)}
          />
        </div>
      </div>

      {/* Submit */}
      <div className="mt-8">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-14 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-base hover:from-blue-500 hover:to-violet-500 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              Saving…
            </>
          ) : (
            <>
              Continue to Domain Selection
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3.75 9h10.5M9.75 4.5L14.25 9l-4.5 4.5" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </>
          )}
        </button>
      </div>
    </form>
  )
}

function inputClass(hasError: boolean) {
  return `w-full h-12 sm:h-14 px-4 rounded-xl bg-white/5 border ${
    hasError ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-blue-500/60'
  } text-white placeholder:text-white/25 text-sm sm:text-base outline-none focus:ring-2 ${
    hasError ? 'focus:ring-red-500/20' : 'focus:ring-blue-500/20'
  } transition-all duration-200 bg-clip-padding [&_option]:bg-[#0A0F1E] [&_option]:text-white`
}