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

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const executeRecaptcha = async () => {
    console.log('[Signup] Executing reCAPTCHA...', {
      hasGrecaptcha: !!window.grecaptcha,
      timestamp: new Date().toISOString()
    })

    if (!window.grecaptcha) {
      console.error('[Signup] Error: grecaptcha not loaded')
      setError('reCAPTCHA not loaded. Please try again.')
      return null
    }

    const grecaptcha = window.grecaptcha
    return new Promise<string | null>((resolve) => {
      grecaptcha.ready(async () => {
        try {
          console.log('[Signup] grecaptcha.ready called, executing token...')
          const token = await grecaptcha.execute(
            getRecaptchaSiteKey(),
            { action: 'signup' }
          )
          console.log('[Signup] Token received:', {
            hasToken: !!token,
            tokenLength: token?.length || 0,
            timestamp: new Date().toISOString()
          })
          resolve(token)
        } catch (err) {
          console.error('[Signup] reCAPTCHA execution error:', {
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      // Execute reCAPTCHA
      console.log('[Signup] Starting signup flow...')
      
      const token = await executeRecaptcha()
      if (!token) {
        console.error('[Signup] Error: No token received from reCAPTCHA')
        throw new Error('reCAPTCHA verification failed')
      }

      console.log('[Signup] Token received, verifying with server...')

      // Verify token on server
      const verifyResponse = await fetch('/api/auth/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'signup' }),
      })

      const verifyData = await verifyResponse.json()
      console.log('[Signup] Verification response:', {
        status: verifyResponse.status,
        statusText: verifyResponse.statusText,
        data: verifyData
      })

      if (!verifyResponse.ok || !verifyData.valid) {
        console.error('[Signup] Verification failed:', {
          status: verifyResponse.status,
          data: verifyData
        })
        throw new Error(verifyData.error || 'reCAPTCHA verification failed')
      }

      console.log('[Signup] Verification successful, proceeding with signup...')

      const supabase = createClient()

      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Failed to create user')

      // 2. Create account
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .insert({
          name: companyName || `${email.split('@')[0]}'s Workspace`,
        })
        .select()
        .single()

      if (accountError) throw accountError

      // 3. Create user record
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          account_id: account.id,
          email: authData.user.email!,
          full_name: email.split('@')[0],
          role: 'owner',
        })

      if (userError) throw userError

      // 4. Create default pipeline
      const { error: pipelineError } = await supabase
        .from('pipelines')
        .insert({
          account_id: account.id,
          name: 'Sales Pipeline',
          is_default: true,
        })

      if (pipelineError) throw pipelineError

      router.push('/onboarding')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Create an account</CardTitle>
          <CardDescription className="text-center">
            Get started with RankedCEO CRM
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                type="text"
                placeholder="Acme Inc"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={loading}
              />
            </div>
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}