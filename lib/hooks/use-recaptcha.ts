'use client'

import { useCallback, useEffect, useState } from 'react'

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

export function useRecaptcha() {
  const [isReady, setIsReady] = useState(false)
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

  useEffect(() => {
    if (!siteKey) {
      console.error('[useRecaptcha] No site key configured')
      return
    }

    // Check if grecaptcha is already loaded
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => {
        console.log('[useRecaptcha] reCAPTCHA ready')
        setIsReady(true)
      })
      return
    }

    // Poll for grecaptcha availability
    let attempts = 0
    const maxAttempts = 100 // 10 seconds with 100ms intervals
    
    const checkInterval = setInterval(() => {
      attempts++
      
      if (window.grecaptcha) {
        window.grecaptcha.ready(() => {
          console.log('[useRecaptcha] reCAPTCHA ready after', attempts * 100, 'ms')
          setIsReady(true)
          clearInterval(checkInterval)
        })
      } else if (attempts >= maxAttempts) {
        console.error('[useRecaptcha] Failed to load reCAPTCHA after 10 seconds')
        clearInterval(checkInterval)
      }
    }, 100)

    return () => {
      clearInterval(checkInterval)
    }
  }, [siteKey])

  const executeRecaptcha = useCallback(
    async (action: string): Promise<string | null> => {
      if (!siteKey) {
        console.error('[useRecaptcha] No site key configured')
        return null
      }

      if (!isReady || !window.grecaptcha) {
        console.error('[useRecaptcha] reCAPTCHA not ready')
        return null
      }

      try {
        console.log('[useRecaptcha] Executing reCAPTCHA for action:', action)
        const token = await window.grecaptcha.execute(siteKey, { action })
        console.log('[useRecaptcha] Token received:', token?.substring(0, 20) + '...')
        return token
      } catch (error) {
        console.error('[useRecaptcha] Execute failed:', error)
        return null
      }
    },
    [siteKey, isReady]
  )

  return {
    isReady,
    executeRecaptcha,
  }
}