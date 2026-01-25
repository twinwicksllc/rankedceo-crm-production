'use client'

import { useEffect, useState } from 'react'

export function RecaptchaProvider() {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Don't reload if already loaded
    if (loaded || window.grecaptcha) {
      console.log('[RecaptchaProvider] reCAPTCHA already loaded')
      setLoaded(true)
      return
    }

    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
    
    if (!siteKey) {
      console.error('[RecaptchaProvider] No site key found')
      setError('No site key configured')
      return
    }

    console.log('[RecaptchaProvider] Loading reCAPTCHA with site key:', siteKey)

    // Add global callback for when grecaptcha loads
    ;(window as any).onRecaptchaLoad = () => {
      console.log('[RecaptchaProvider] onRecaptchaLoad callback fired')
      console.log('[RecaptchaProvider] grecaptcha object:', window.grecaptcha)
      setLoaded(true)
    }

    // Create and append script with explicit load callback
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}&onload=onRecaptchaLoad`
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    
    script.onload = () => {
      console.log('[RecaptchaProvider] Script tag onload fired')
    }
    
    script.onerror = () => {
      console.error('[RecaptchaProvider] Script onerror fired')
      console.error('[RecaptchaProvider] Script URL:', script.src)
      setError('Failed to load reCAPTCHA script')
    }
    
    document.head.appendChild(script)

    // Cleanup
    return () => {
      // Don't remove script as it might be needed by other components
      delete (window as any).onRecaptchaLoad
    }
  }, [loaded])

  // Render nothing but provide status
  return null
}