// =============================================================================
// AdvantagePoint — Onboarding Layout
// Glassmorphism dark theme, full-screen immersive experience
// =============================================================================

import type { Metadata } from 'next'
import { AdvantagePointFooter } from '@/components/advantagepoint/footer'
import { OnboardingThemeShell } from './theme-shell'

export const metadata: Metadata = {
  title: 'Get Started | RankedCEO',
  description: 'Set up your RankedCEO website in minutes. Tell us about your business and we\'ll build you a high-converting local SEO website.',
  robots: 'noindex',
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingThemeShell>
      <div className="relative z-10 flex flex-col flex-1">
        {children}
      </div>

      <AdvantagePointFooter />
    </OnboardingThemeShell>
  )
}