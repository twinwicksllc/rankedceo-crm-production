'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type OnboardingTheme = 'light' | 'dark'

interface OnboardingThemeContextValue {
  theme: OnboardingTheme
  toggleTheme: () => void
}

const OnboardingThemeContext = createContext<OnboardingThemeContextValue | null>(null)

const STORAGE_KEY = 'ap-onboarding-theme'

export function OnboardingThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<OnboardingTheme>('light')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored)
      }
    } catch {
      // no-op
    }
  }, [])

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === 'light' ? 'dark' : 'light'
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // no-op
      }
      return next
    })
  }

  const value = useMemo(() => ({ theme, toggleTheme }), [theme])

  return (
    <OnboardingThemeContext.Provider value={value}>
      {children}
    </OnboardingThemeContext.Provider>
  )
}

export function useOnboardingTheme() {
  const context = useContext(OnboardingThemeContext)
  return context ?? {
    theme: 'light',
    toggleTheme: () => {},
  }
}
