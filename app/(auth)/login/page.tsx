'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getRecaptchaSiteKey } from '@/lib/utils'

declare global {
  interface Window {
    grecaptcha?: {
      execute: (siteKey: string, options: { action: string }) => Promise<string>
      ready: (callback: () => void) => void
    }
  }
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const executeRecaptcha = async () => {
    console.log('[Login] Executing reCAPTCHA...', {
      hasGrecaptcha: !!window.grecaptcha,
      timestamp: new Date().toISOString()
    })

    // Wait for grecaptcha to be available with retry logic
    const waitForRecaptcha = (maxRetries = 10, delay = 200): Promise<boolean> => {
      return new Promise((resolve) => {
        let retries = 0
        
        const checkRecaptcha = () => {
          retries++
          console.log(`[Login] Checking for grecaptcha... Attempt ${retries}/${maxRetries}`)
          
          if (window.grecaptcha) {
            console.log('[Login] grecaptcha found!')
            resolve(true)
            return
          }
          
          if (retries >= maxRetries) {
            console.error('[Login] grecaptcha not found after retries')
            resolve(false)
            return
          }
          
          setTimeout(checkRecaptcha, delay)
        }
        
        checkRecaptcha()
      })
    }

    const isRecaptchaReady = await waitForRecaptcha()
    
    if (!isRecaptchaReady || !window.grecaptcha) {
      console.error('[Login] Error: grecaptcha not loaded')
      setError('reCAPTCHA not loaded. Please refresh the page and try again.')
      return null
    }

    const grecaptcha = window.grecaptcha
    return new Promise<string | null>((resolve) => {
      grecaptcha.ready(async () => {
        try {
          console.log('[Login] grecaptcha.ready called, executing token...')
          const token = await grecaptcha.execute(
            getRecaptchaSiteKey(),
            { action: 'login' }
          )
          console.log('[Login] Token received:', {
            hasToken: !!token,
            tokenLength: token?.length || 0,
            timestamp: new Date().toISOString()
          })
          resolve(token)
        } catch (err) {
          console.error('[Login] reCAPTCHA execution error:', {
            error: err,
            message: (err as any)?.message,
            timestamp: new Date().toISOString()
          })
          setError('reCAPTCHA verification failed')
          resolve(null)
        }
      })
    })
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Execute reCAPTCHA Enterprise
      const token = await executeRecaptcha()
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

      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
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
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
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
                disabled={loading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
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