// =============================================================================
// AdvantagePoint — Onboarding Entry Page (Server Component)
// Reads auditId + tier from URL params, renders the client flow
// =============================================================================

import type { Metadata } from 'next'
import { OnboardingFlow } from './onboarding-flow'

export const metadata: Metadata = {
  title: 'Get Started | RankedCEO',
  description: 'Build your RankedCEO website in minutes.',
}

interface PageProps {
  searchParams: { auditId?: string; tier?: string }
}

export default function OnboardingPage({ searchParams }: PageProps) {
  const auditId = searchParams.auditId ?? null
  const tier    = (searchParams.tier as 'hosting' | 'standard' | 'premium') ?? 'standard'

  return <OnboardingFlow auditId={auditId} initialTier={tier} />
}