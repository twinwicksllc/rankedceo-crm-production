// =============================================================================
// AdvantagePoint — Onboarding Layout
// Glassmorphism dark theme, full-screen immersive experience
// =============================================================================

import type { Metadata } from 'next'
import { AdvantagePointFooter } from '@/components/advantagepoint/footer'

export const metadata: Metadata = {
  title: 'Get Started | AdvantagePoint',
  description: 'Set up your AdvantagePoint website in minutes. Tell us about your business and we\'ll build you a high-converting local SEO website.',
  robots: 'noindex',
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0F1E] relative overflow-hidden flex flex-col">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-indigo-500/5 blur-[80px]" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1">
        {children}
      </div>

      <AdvantagePointFooter />
    </div>
  )
}