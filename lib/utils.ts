import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRecaptchaSiteKey(): string {
  // Get the site key from environment variable
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''
  
  // Log for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[getRecaptchaSiteKey]', {
      hasEnvKey: !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
      siteKeyLength: siteKey.length,
      usingSiteKey: siteKey
    })
  }
  
  return siteKey
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/)
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`
  }
  return phone
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

/**
 * Get Gemini API key from environment
 * SECURITY WARNING: NEVER log this key or commit it to git
 * This function should only be used for secure API calls
 */
export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    console.error('[Security] GEMINI_API_KEY not found in environment')
    return null
  }
  
  // Validate key format (basic check)
  if (key.length < 10) {
    console.error('[Security] GEMINI_API_KEY appears invalid')
    return null
  }
  
  return key
}