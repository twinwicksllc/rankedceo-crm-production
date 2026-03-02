'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IndustryLogo } from '@/components/ui/industry-logo'
import { createClient } from '@/lib/supabase/client'
import { useRecaptcha } from '@/lib/hooks/use-recaptcha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function HvacLoginPage() {
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
      if (!isReady) throw new Error('reCAPTCHA not loaded. Please refresh the page.')

      const token = await executeRecaptcha('hvac_login')
      if (!token) throw new Error('reCAPTCHA verification failed')

      const verifyResponse = await fetch('/api/auth/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'hvac_login' }),
      })
      const verifyData = await verifyResponse.json()
      if (!verifyResponse.ok || !verifyData.valid) {
        throw new Error(verifyData.error || 'reCAPTCHA verification failed')
      }

      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) throw signInError

      // Industry isolation check — ensure this user belongs to HVAC
      const userIndustry = data.user?.user_metadata?.industry
      if (userIndustry && userIndustry !== 'hvac') {
        await supabase.auth.signOut()
        setError(
          `This account is registered for ${userIndustry.charAt(0).toUpperCase() + userIndustry.slice(1)} Pro. Please visit the correct portal.`
        )
        return
      }

      router.push('/')
      router.refresh()
    } catch (err: any) {
      console.error('[HvacLogin] Error:', err.message)
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md border-blue-200 shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <IndustryLogo industry="hvac" height={126} priority />
          </div>
          <CardTitle className="sr-only">HVAC Pro</CardTitle>
          <CardDescription className="text-gray-500">
            Sign in to your operator dashboard
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="border-blue-200 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Your password"
                required
                className="border-blue-200 focus:ring-blue-500"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !isReady}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Signing in...' : 'Sign In to HVAC Pro'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 text-center text-sm text-gray-500">
          <p>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-blue-600 hover:underline">
              Create one
            </Link>
          </p>
          <p className="text-xs text-gray-400">
            HVAC Pro operators only. Wrong portal?{' '}
            <a href="https://smile.rankedceo.com" className="text-blue-500 hover:underline">Smile</a>
            {' · '}
            <a href="https://plumbing.rankedceo.com" className="text-teal-500 hover:underline">Plumbing</a>
            {' · '}
            <a href="https://electrical.rankedceo.com" className="text-amber-500 hover:underline">Electrical</a>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}