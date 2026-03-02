'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Smile } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRecaptcha } from '@/lib/hooks/use-recaptcha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function SmileSignupPage() {
  const router = useRouter()
  const { isReady, executeRecaptcha } = useRecaptcha()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [practiceName, setPracticeName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      if (!isReady) throw new Error('reCAPTCHA not loaded. Please refresh the page.')

      const token = await executeRecaptcha('smile_signup')
      if (!token) throw new Error('reCAPTCHA verification failed')

      const verifyResponse = await fetch('/api/auth/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'smile_signup' }),
      })
      const verifyData = await verifyResponse.json()
      if (!verifyResponse.ok || !verifyData.valid) {
        throw new Error(verifyData.error || 'reCAPTCHA verification failed')
      }

      const supabase = createClient()
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            industry: 'smile',
            product: 'smile_makeover',
            company_name: practiceName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      })

      if (signUpError) throw signUpError

      router.push('/onboarding')
      router.refresh()
    } catch (err: any) {
      console.error('[SmileSignup] Error:', err.message)
      setError(err.message || 'Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100 p-4">
      <Card className="w-full max-w-md border-purple-200 shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-purple-100 p-3">
              <Smile className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Smile MakeOver</CardTitle>
          <CardDescription className="text-gray-500">
            Create your dentist account to start qualifying patients
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="practiceName">Practice Name</Label>
              <Input
                id="practiceName"
                value={practiceName}
                onChange={e => setPracticeName(e.target.value)}
                placeholder="Smith Family Dentistry"
                className="border-purple-200 focus:ring-purple-500"
              />
            </div>
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
                placeholder="Min. 8 characters"
                required
                className="border-purple-200 focus:ring-purple-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                required
                className="border-purple-200 focus:ring-purple-500"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !isReady}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {loading ? 'Creating account...' : 'Create Smile MakeOver Account'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 text-center text-sm text-gray-500">
          <p>
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-purple-600 hover:underline">
              Sign in
            </Link>
          </p>
          <p className="text-xs text-gray-400">
            This account is for Smile MakeOver dentists only.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}