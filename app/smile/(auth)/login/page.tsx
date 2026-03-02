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

export default function SmileLoginPage() {
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

      const token = await executeRecaptcha('smile_login')
      if (!token) throw new Error('reCAPTCHA verification failed')

      const verifyResponse = await fetch('/api/auth/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'smile_login' }),
      })
      const verifyData = await verifyResponse.json()
      if (!verifyResponse.ok || !verifyData.valid) {
        throw new Error(verifyData.error || 'reCAPTCHA verification failed')
      }

      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) throw signInError

      // Industry isolation check — ensure this user belongs to Smile
      const userIndustry = data.user?.user_metadata?.industry
      if (userIndustry && userIndustry !== 'smile') {
        await supabase.auth.signOut()
        setError(
          `This account is registered for ${userIndustry.charAt(0).toUpperCase() + userIndustry.slice(1)} Pro. Please visit the correct portal.`
        )
        return
      }

      router.push('/')
      router.refresh()
    } catch (err: any) {
      console.error('[SmileLogin] Error:', err.message)
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100 p-4">
      <Card className="w-full max-w-md border-purple-200 shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <IndustryLogo industry="smile" height={126} priority />
          </div>
          <CardTitle className="sr-only">Smile MakeOver</CardTitle>
          <CardDescription className="text-gray-500">
            Sign in to your dentist dashboard
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
                placeholder="you@practice.com"
                required
                className="border-purple-200 focus:ring-purple-500"
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
                className="border-purple-200 focus:ring-purple-500"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !isReady}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {loading ? 'Signing in...' : 'Sign In to Smile MakeOver'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 text-center text-sm text-gray-500">
          <p>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-purple-600 hover:underline">
              Create one
            </Link>
          </p>
          <p className="text-xs text-gray-400">
            Smile MakeOver dentists only. Wrong portal?{' '}
            <a href="https://hvac.rankedceo.com" className="text-blue-500 hover:underline">HVAC</a>
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