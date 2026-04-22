'use client'

import React from 'react'
import { OnboardingThemeProvider, useOnboardingTheme } from './theme-context'

function ThemedShell({ children }: { children: React.ReactNode }) {
  const { theme } = useOnboardingTheme()

  return (
    <div className={`ap-onboarding ap-theme-${theme} min-h-screen relative overflow-hidden flex flex-col`}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="ap-glow ap-glow-blue absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[120px]" />
        <div className="ap-glow ap-glow-violet absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full blur-[120px]" />
        <div className="ap-glow ap-glow-indigo absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[80px]" />
        <div className="ap-grid absolute inset-0" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        {children}
      </div>
    </div>
  )
}

export function OnboardingThemeShell({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingThemeProvider>
      <ThemedShell>{children}</ThemedShell>
    </OnboardingThemeProvider>
  )
}
