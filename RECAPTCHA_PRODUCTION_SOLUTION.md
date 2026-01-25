# Production-Grade reCAPTCHA v3 Implementation for Next.js 14

## Critical Issue: Domain Whitelist

**MOST LIKELY ROOT CAUSE:** Your domain `crm.rankedceo.com` is probably not whitelisted in Google reCAPTCHA admin console.

### Immediate Action Required:

1. Go to https://www.google.com/recaptcha/admin
2. Find your site key: `6LcCmVUsAAAAAAvcQlUG4eUEJ5NxwNLXFju-vVoA`
3. Check the **Domains** section
4. Add these domains if not present:
   - `crm.rankedceo.com`
   - `localhost` (for local development)
   - `vercel.app` (for preview deployments)

**Without proper domain whitelisting, Google will silently reject the script load with no specific error message - exactly what you're experiencing.**

---

## Production-Ready Implementation

### 1. Use Next.js Script Component (Best Practice)

The `next/script` component is the recommended way to load third-party scripts in Next.js 14.

**File: `app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RankedCEO CRM',
  description: 'Multi-tenant CRM with AI-powered lead scoring',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

  return (
    <html lang="en">
      <head>
        {siteKey && (
          <Script
            src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

**Why this is better:**
- ✅ Next.js optimizes script loading
- ✅ `strategy="afterInteractive"` loads after page is interactive
- ✅ Automatic error handling
- ✅ Better performance
- ✅ No manual DOM manipulation

---

### 2. Create a Custom Hook for reCAPTCHA

**File: `lib/hooks/use-recaptcha.ts`**

```typescript
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
        setIsReady(true)
      })
      return
    }

    // Poll for grecaptcha availability
    const checkInterval = setInterval(() => {
      if (window.grecaptcha) {
        window.grecaptcha.ready(() => {
          setIsReady(true)
          clearInterval(checkInterval)
        })
      }
    }, 100)

    // Cleanup after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(checkInterval)
      if (!isReady) {
        console.error('[useRecaptcha] Failed to load reCAPTCHA after 10 seconds')
      }
    }, 10000)

    return () => {
      clearInterval(checkInterval)
      clearTimeout(timeout)
    }
  }, [siteKey, isReady])

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
        const token = await window.grecaptcha.execute(siteKey, { action })
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
```

---

### 3. Update Login Page

**File: `app/(auth)/login/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRecaptcha } from '@/lib/hooks/use-recaptcha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function LoginPage() {
  const router = useRouter()
  const { isReady, executeRecaptcha } = useRecaptcha()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!isReady) {
        throw new Error('reCAPTCHA not loaded. Please refresh the page.')
      }

      // Execute reCAPTCHA
      const token = await executeRecaptcha('login')
      if (!token) {
        throw new Error('reCAPTCHA verification failed')
      }

      // Verify token on server
      const verifyResponse = await fetch('/api/auth/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'login' }),
      })

      const verifyData = await verifyResponse.json()
      if (!verifyResponse.ok || !verifyData.valid) {
        throw new Error(verifyData.error || 'reCAPTCHA verification failed')
      }

      // Sign in with Supabase
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      console.error('[Login] Error:', err)
      setError(err.message || 'Failed to login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your RankedCEO CRM account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!isReady && (
              <Alert>
                <AlertDescription>Loading security verification...</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || !isReady}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || !isReady}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading || !isReady}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
```

---

### 4. Update Signup Page (Similar Pattern)

Apply the same pattern to `app/(auth)/signup/page.tsx` using the `useRecaptcha` hook.

---

## Why This Solution is Production-Grade

### 1. **Uses Next.js Best Practices**
- ✅ `next/script` component for optimal loading
- ✅ `strategy="afterInteractive"` for performance
- ✅ Proper TypeScript types
- ✅ Custom hooks for reusability

### 2. **Robust Error Handling**
- ✅ Checks for script availability
- ✅ Polling with timeout
- ✅ Clear error messages
- ✅ Loading states for UX

### 3. **Performance Optimized**
- ✅ Script loads after page is interactive
- ✅ No blocking operations
- ✅ Efficient polling mechanism
- ✅ Proper cleanup

### 4. **Maintainable**
- ✅ Separation of concerns (hook vs component)
- ✅ Reusable across login/signup
- ✅ Easy to test
- ✅ Clear documentation

### 5. **Security**
- ✅ Environment variables for keys
- ✅ Server-side verification
- ✅ Action-based scoring
- ✅ No exposed secrets

---

## Troubleshooting Checklist

1. ✅ **Domain Whitelist**: Add `crm.rankedceo.com` to Google reCAPTCHA admin
2. ✅ **Environment Variables**: Verify `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` in Vercel
3. ✅ **Secret Key**: Verify `RECAPTCHA_SECRET_KEY` in Vercel
4. ✅ **Network**: Check browser network tab for script load
5. ✅ **Console**: Check for any JavaScript errors
6. ✅ **API Key**: Create new Gemini API key (current one is leaked)

---

## Next Steps

1. **Immediately**: Add domain to reCAPTCHA whitelist
2. **Implement**: Use the code above (Next.js Script + custom hook)
3. **Test**: Use the test page at `/recaptcha-test.html`
4. **Verify**: Check console logs for successful load
5. **Deploy**: Push changes and test in production

This is the enterprise-grade, production-ready solution that follows Next.js 14 best practices.