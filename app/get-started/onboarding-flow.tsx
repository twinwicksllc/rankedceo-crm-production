'use client'

// =============================================================================
// AdvantagePoint — Multi-Step Onboarding Flow (Client Component)
// React Hook Form + Zod, 4 steps, state-managed, glassmorphism dark theme
// =============================================================================

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AdvantagePointHeader } from '@/components/advantagepoint/header'
import { StepBusinessIdentity }  from './steps/step-business-identity'
import { StepDomainWishlist }    from './steps/step-domain-wishlist'
import { StepBrandIdentity }     from './steps/step-brand-identity'
import { StepIntegrations }      from './steps/step-integrations'
import { OnboardingSuccess }     from './onboarding-success'
import {
  saveOnboardingStep1,
  saveOnboardingStep2,
  saveOnboardingStep3,
  saveOnboardingStep4,
} from '@/lib/waas/actions/onboarding'
import type {
  DomainWishlistItem,
  WaasPackageTier,
} from '@/lib/waas/types'
import { getAuditFunnelProperties } from '@/lib/analytics/audit-funnel'
import { trackEvent } from '@/lib/analytics/track-event'

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

export const step1Schema = z.object({
  legal_name:       z.string().min(2, 'Business name must be at least 2 characters'),
  physical_address: z.string().min(5, 'Please enter a valid address'),
  city:             z.string().min(2, 'City is required'),
  state:            z.string().min(2, 'State is required'),
  zip:              z.string().regex(/^\d{5}(-\d{4})?$/, 'Enter a valid ZIP code'),
  primary_trade:    z.string().min(2, 'Please select your primary trade'),
  email:            z.string().email('Please enter a valid email address'),
})

export const step4Schema = z.object({
  calendly_url:      z.string().url('Please enter a valid URL').or(z.literal('')),
  financing_enabled: z.boolean(),
  usp:               z.string().min(10, 'Please describe what makes your business unique (min 10 characters)').max(500, 'Keep it under 500 characters'),
})

export type Step1FormData = z.infer<typeof step1Schema>
export type Step4FormData = z.infer<typeof step4Schema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OnboardingFlowProps {
  auditId?:     string | null
  initialTier?: WaasPackageTier
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OnboardingFlow({ auditId, initialTier = 'standard' }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep]   = useState(1)
  const [tenantId,    setTenantId]      = useState<string | null>(null)
  const [isLoading,   setIsLoading]     = useState(false)
  const [error,       setError]         = useState<string | null>(null)
  const [completed,   setCompleted]     = useState(false)

  // Step 2 state (managed outside RHF — complex array)
  const [domains, setDomains] = useState<DomainWishlistItem[]>([])

  // Step 3 state (logo + colors)
  const [primaryColor,   setPrimaryColor]   = useState('#2563EB')
  const [secondaryColor, setSecondaryColor] = useState('#1E40AF')
  const [logoUrl,        setLogoUrl]        = useState<string | null>(null)
  const [businessName,   setBusinessName]   = useState('')
  const trackedSteps = useRef<Set<number>>(new Set())
  const trackingContext = useRef<Record<string, string | number | boolean | null | undefined>>({})

  const TOTAL_STEPS = 4

  useEffect(() => {
    trackingContext.current = getAuditFunnelProperties(
      new URLSearchParams(window.location.search),
      auditId,
    )

    trackEvent('audit_onboarding_started', {
      ...trackingContext.current,
      tier: initialTier,
      hasAuditId: Boolean(auditId),
    })
  }, [auditId, initialTier])

  useEffect(() => {
    if (trackedSteps.current.has(currentStep)) {
      return
    }

    trackedSteps.current.add(currentStep)
    trackEvent('audit_onboarding_step_viewed', {
      ...trackingContext.current,
      step: currentStep,
      stepName: ['business', 'domains', 'brand', 'integrations'][currentStep - 1],
      tier: initialTier,
      hasAuditId: Boolean(auditId),
    })
  }, [auditId, currentStep, initialTier])

  // Step 1 form
  const step1Form = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      legal_name:       '',
      physical_address: '',
      city:             '',
      state:            '',
      zip:              '',
      primary_trade:    '',
      email:            '',
    },
  })

  // Step 4 form
  const step4Form = useForm<Step4FormData>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      calendly_url:      '',
      financing_enabled: false,
      usp:               '',
    },
  })

  const handleError = useCallback((msg: string) => {
    trackEvent('audit_onboarding_error', {
      ...trackingContext.current,
      step: currentStep,
      message: msg,
    })
    setError(msg)
    setIsLoading(false)
  }, [currentStep])

  // ---------------------------------------------------------------------------
  // Step handlers
  // ---------------------------------------------------------------------------

  const handleStep1Submit = async (data: Step1FormData) => {
    setIsLoading(true)
    setError(null)
    setBusinessName(data.legal_name)

    const result = await saveOnboardingStep1(
      tenantId,
      {
        legal_name:       data.legal_name,
        physical_address: data.physical_address,
        city:             data.city,
        state:            data.state,
        zip:              data.zip,
        primary_trade:    data.primary_trade,
      },
      auditId,
      data.email,
    )

    if (!result.success || !result.data) {
      handleError(result.error ?? 'Failed to save. Please try again.')
      return
    }

    setTenantId(result.data.tenantId)
    setIsLoading(false)
    trackEvent('audit_onboarding_step_completed', {
      ...trackingContext.current,
      step: 1,
      stepName: 'business',
      tenantCreated: true,
      hasAuditId: Boolean(auditId),
      tier: initialTier,
    })
    setCurrentStep(2)
  }

  const handleStep2Next = async () => {
    if (!tenantId) { handleError('Session expired. Please refresh.'); return }
    if (domains.length === 0) { setError('Please add at least one domain preference.'); return }
    setIsLoading(true)
    setError(null)

    const result = await saveOnboardingStep2(tenantId, { domains })
    if (!result.success) { handleError(result.error ?? 'Failed to save domains.'); return }

    setIsLoading(false)
    trackEvent('audit_onboarding_step_completed', {
      ...trackingContext.current,
      step: 2,
      stepName: 'domains',
      domainCount: domains.length,
      tier: initialTier,
    })
    setCurrentStep(3)
  }

  const handleStep3Next = async () => {
    if (!tenantId) { handleError('Session expired. Please refresh.'); return }
    setIsLoading(true)
    setError(null)

    const result = await saveOnboardingStep3(
      tenantId,
      primaryColor,
      secondaryColor,
      logoUrl,
      businessName,
    )
    if (!result.success) { handleError(result.error ?? 'Failed to save brand.'); return }

    setIsLoading(false)
    trackEvent('audit_onboarding_step_completed', {
      ...trackingContext.current,
      step: 3,
      stepName: 'brand',
      hasLogo: Boolean(logoUrl),
      tier: initialTier,
    })
    setCurrentStep(4)
  }

  const handleStep4Submit = async (data: Step4FormData) => {
    if (!tenantId) { handleError('Session expired. Please refresh.'); return }
    setIsLoading(true)
    setError(null)

    const result = await saveOnboardingStep4(tenantId, data, initialTier)
    if (!result.success) { handleError(result.error ?? 'Failed to submit.'); return }

    setIsLoading(false)
    trackEvent('audit_onboarding_step_completed', {
      ...trackingContext.current,
      step: 4,
      stepName: 'integrations',
      calendlyConnected: Boolean(data.calendly_url),
      financingEnabled: data.financing_enabled,
      tier: initialTier,
    })
    trackEvent('audit_onboarding_completed', {
      ...trackingContext.current,
      tier: initialTier,
      hasAuditId: Boolean(auditId),
      tenantId,
    })
    setCompleted(true)
  }

  const goBack = () => {
    setError(null)
    trackEvent('audit_onboarding_back_clicked', {
      ...trackingContext.current,
      fromStep: currentStep,
      toStep: Math.max(1, currentStep - 1),
      tier: initialTier,
    })
    setCurrentStep(s => Math.max(1, s - 1))
  }

  // ---------------------------------------------------------------------------
  // Success state
  // ---------------------------------------------------------------------------

  if (completed) {
    return <OnboardingSuccess businessName={businessName} tier={initialTier} />
  }

  // ---------------------------------------------------------------------------
  // Step labels for mobile progress
  // ---------------------------------------------------------------------------

  const stepLabels = ['Business', 'Domains', 'Brand', 'Integrations']

  return (
    <div className="flex flex-col flex-1">
      <AdvantagePointHeader variant="onboarding" step={currentStep} totalSteps={TOTAL_STEPS} />

      {/* Mobile step label */}
      <div className="sm:hidden flex items-center gap-2 px-4 pt-4">
        <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-[10px] font-bold">
          {currentStep}
        </div>
        <span className="text-white/60 text-sm font-medium">
          Step {currentStep}: {stepLabels[currentStep - 1]}
        </span>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-2xl">

          {/* Step progress dots (desktop) */}
          <div className="hidden sm:flex items-center gap-3 mb-8">
            {stepLabels.map((label, i) => (
              <React.Fragment key={label}>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all duration-300 ${
                    i + 1 < currentStep
                      ? 'bg-blue-500 text-white'
                      : i + 1 === currentStep
                      ? 'bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-white/10 text-white/30'
                  }`}>
                    {i + 1 < currentStep ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7l3.5 3.5L12 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : i + 1}
                  </div>
                  <span className={`text-sm font-medium transition-colors ${
                    i + 1 === currentStep ? 'text-white' : 'text-white/30'
                  }`}>{label}</span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={`flex-1 h-px transition-all duration-500 ${
                    i + 1 < currentStep ? 'bg-blue-500' : 'bg-white/10'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Glass card */}
          <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-3 px-6 py-3 bg-red-500/10 border-b border-red-500/20">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                  <circle cx="8" cy="8" r="7" stroke="#EF4444" strokeWidth="1.5"/>
                  <path d="M8 5v3.5M8 10.5v.5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p className="text-red-400 text-sm">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">✕</button>
              </div>
            )}

            {/* Step content */}
            <div className="p-6 sm:p-8">
              {currentStep === 1 && (
                <StepBusinessIdentity
                  form={step1Form}
                  onSubmit={handleStep1Submit}
                  isLoading={isLoading}
                  auditId={auditId}
                />
              )}
              {currentStep === 2 && (
                <StepDomainWishlist
                  domains={domains}
                  setDomains={setDomains}
                  onNext={handleStep2Next}
                  onBack={goBack}
                  isLoading={isLoading}
                />
              )}
              {currentStep === 3 && (
                <StepBrandIdentity
                  tenantId={tenantId!}
                  businessName={businessName}
                  primaryColor={primaryColor}
                  setPrimaryColor={setPrimaryColor}
                  secondaryColor={secondaryColor}
                  setSecondaryColor={setSecondaryColor}
                  logoUrl={logoUrl}
                  setLogoUrl={setLogoUrl}
                  onNext={handleStep3Next}
                  onBack={goBack}
                  isLoading={isLoading}
                />
              )}
              {currentStep === 4 && (
                <StepIntegrations
                  form={step4Form}
                  onSubmit={handleStep4Submit}
                  onBack={goBack}
                  isLoading={isLoading}
                />
              )}
            </div>
          </div>

          {/* Trust signals */}
          <div className="flex items-center justify-center gap-6 mt-6">
            {['🔒 Secure & Private', '⚡ Built in 48 Hours', '🎯 Local SEO Optimized'].map(signal => (
              <span key={signal} className="text-white/25 text-xs font-medium">{signal}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}