'use client'

import { useEffect, useState } from 'react'

export function RecaptchaProvider() {
  const [loaded, setLoaded] = useState(false)

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
      return
    }

    console.log('[RecaptchaProvider] Loading reCAPTCHA with site key:', siteKey)

    // Create and append script WITHOUT onload parameter
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
    script.async = true
    script.defer = true
    script.crossOrigin = "anonymous"
    
    script.onload = () => {
      console.log('[RecaptchaProvider] Script loaded, waiting for grecaptcha...')
      
      // Wait a bit for grecaptcha to initialize
      setTimeout(() => {
        if (window.grecaptcha) {
          console.log('[RecaptchaProvider] grecaptcha is available!')
          setLoaded(true)
        } else {
          console.error('[RecaptchaProvider] grecaptcha not available after script load')
        }
      }, 500)
    }
    
    script.onerror = (e) => {
      console.error('[RecaptchaProvider] Failed to load reCAPTCHA script', e)
      console.error('[RecaptchaProvider] Script URL was:', script.src)
    }
    
    document.head.appendChild(script)

    // Cleanup
    return () => {
      // Don't remove script as it might be needed by other components
    }
  }, [loaded])

  // Render nothing but provide status
  return null
}