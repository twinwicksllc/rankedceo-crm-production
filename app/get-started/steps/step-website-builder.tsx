'use client'

import { Builder, type OnboardingPrefill } from '@/components/waas/website-builder/builder'
import type { Block } from '@/lib/waas/website-builder/blocks'

export interface StepWebsiteBuilderProps {
  tenantId:             string
  businessName:         string
  primaryTrade:         string | null
  primaryColor:         string
  selectedTemplateSlug: string | null
  tagline:              string | undefined
  servicesOffered:      string | undefined
  targetAudience:       string | undefined
  city:                 string | undefined
  state:                string | undefined
  usp:                  string
  valuePropositions:    string | undefined
  aboutNarrative:       string | undefined
  primaryCta:           string | undefined
  serviceArea:          string | undefined
  financingEnabled:     boolean
  onSubmit:   (blocks: Block[]) => Promise<void>
  onBack:     () => void
  isLoading:  boolean
}

export function StepWebsiteBuilder({
  businessName,
  primaryTrade,
  selectedTemplateSlug,
  tagline,
  servicesOffered,
  usp,
  aboutNarrative,
  primaryCta,
  city,
  state,
  onSubmit,
  onBack,
  isLoading,
}: StepWebsiteBuilderProps) {
  const prefill: OnboardingPrefill = {
    businessName,
    primaryTrade,
    selectedTemplateSlug,
    tagline,
    usp,
    servicesOffered,
    aboutNarrative,
    primaryCta,
    city,
    state,
  }

  return (
    <Builder
      prefill={prefill}
      onSubmit={onSubmit}
      onBack={onBack}
      isLoading={isLoading}
    />
  )
}
