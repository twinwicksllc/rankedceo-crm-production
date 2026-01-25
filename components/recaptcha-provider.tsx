'use client'

import { useEffect } from 'react'

export function RecaptchaProvider() {
  useEffect(() => {
    // Load reCAPTCHA script dynamically on client side
    const loadRecaptcha = () => {
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
      
      if (!siteKey) {
        console.error('[RecaptchaProvider] No site key found')
        return
      }

      console.log('[RecaptchaProvider] Loading reCAPTCHA with site key:', siteKey)

      // Check if script is already loaded
      if (window.grecaptcha) {
        console.log('[RecaptchaProvider] reCAPTCHA already loaded')
        return
      }

      // Create and append script
      const script = document.createElement('script')
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
      script.async = true
      script.defer = true
      
      script.onload = () => {
        console.log('[RecaptchaProvider] reCAPTCHA script loaded successfully')
      }
      
      script.onerror = () => {
        console.error('[RecaptchaProvider] Failed to load reCAPTCHA script')
      }
      
      document.head.appendChild(script)
    }

    // Load script
    loadRecaptcha()
  }, [])

  return null // This component doesn't render anything
}