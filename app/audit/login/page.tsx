'use client'

import { Suspense, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { createAuditClient } from '@/lib/supabase/audit-client'

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function AuditLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/audit/start'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(searchParams.get('error') ?? '')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [mode, setMode] = useState<'password' | 'magic'>('password')

  // Hold the client in a ref — createAuditClient() must not be called on
  // every render because the Supabase browser client registers internal
  // auth-state listeners on construction; doing so on re-renders stacks
  // duplicate listeners which can produce a re-render loop.
  const supabaseRef = useRef(createAuditClient())
  const supabase = supabaseRef.current

  const resolveRedirectTarget = (target: string) => {
    if (target.startsWith('/')) {
      return `${window.location.origin}${target}`
    }
    try {
      const parsed = new URL(target)
      if (
        parsed.protocol === 'https:' &&
        (parsed.hostname === 'rankedceo.com' || parsed.hostname.endsWith('.rankedceo.com'))
      ) {
        return parsed.toString()
      }
    } catch {
      // fall through
    }
    return `${window.location.origin}/audit/start`
  }

  const buildAuthCallbackUrl = () => {
    // IMPORTANT: The PKCE flow breaks across subdomains because the code
    // verifier is stored in audit.rankedceo.com storage but the callback
    // lands on crm.rankedceo.com. We use the implicit flow (no PKCE) for
    // cross-domain OAuth so the token is returned directly in the URL fragment
    // and no server-side code exchange is needed.
    //
    // We redirect to /audit/auth/confirm which is a client-side page that
    // reads the hash fragment, establishes the session, then forwards to
    // /audit/start. This is necessary because the server component at
    // /audit/start checks auth via cookies, which aren't set until the
    // client-side Supabase processes the hash fragment first.
    const isProduction = typeof window !== 'undefined' &&
      window.location.hostname.endsWith('.rankedceo.com')

    // The landing page after OAuth — must be on audit.rankedceo.com so
    // the Supabase client there can read the hash fragment
    const confirmUrl = isProduction
      ? 'https://audit.rankedceo.com/audit/auth/confirm'
      : `${window.location.origin}/audit/auth/confirm`

    return confirmUrl
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      router.push(resolveRedirectTarget(redirectTo))
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: buildAuthCallbackUrl() },
      })
      if (otpError) throw otpError
      setMagicSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      // Use implicit flow (not PKCE) to avoid cross-subdomain PKCE verifier
      // mismatch — PKCE stores the verifier on audit.rankedceo.com but the
      // callback runs on crm.rankedceo.com where it can't find the verifier.
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: buildAuthCallbackUrl(),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: false,
        },
      })
      if (oauthError) throw oauthError
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google')
      setGoogleLoading(false)
    }
  }

  if (magicSent) {
    return (
      // Glows use CSS radial-gradient (not filter:blur divs) — see comment
      // on the main return below for why this matters.
      <div className="relative min-h-screen flex items-center justify-center px-4"
        style={{ background: 'radial-gradient(ellipse 65% 55% at 10% 0%, rgba(6,182,212,0.18) 0%, transparent 70%), radial-gradient(ellipse 65% 55% at 90% 30%, rgba(16,185,129,0.14) 0%, transparent 70%), #020b2c' }}>
        <div className="relative w-full max-w-md rounded-2xl border border-cyan-400/20 bg-[#0a1a3b]/90 p-10 text-center shadow-[0_0_50px_rgba(14,165,233,0.08)] backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
            📧
          </div>
          <h2 className="mb-2 text-xl font-bold text-white">Check your email</h2>
          <p className="text-slate-300">
            We sent a magic link to{' '}
            <span className="font-medium text-cyan-300">{email}</span>
          </p>
          <button
            onClick={() => setMagicSent(false)}
            className="mt-6 text-sm text-slate-400 hover:text-white transition-colors"
          >
            ← Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    // IMPORTANT: Decorative glows are CSS radial-gradient on the background
    // property — NOT filter:blur() divs.  Chrome uses software (CPU)
    // rendering for filter:blur() on elements inside overflow:hidden when the
    // radius exceeds ~30px.  At blur-[120px]/blur-[140px] on 320-384px circles
    // this blocks the compositor thread long enough to trigger Chrome's
    // "Page not responding" / "Wait or Exit" dialog.  radial-gradient achieves
    // the same visual at GPU-trivial cost.
    <div className="relative min-h-screen"
      style={{ background: 'radial-gradient(ellipse 55% 45% at 0% 0%, rgba(6,182,212,0.2) 0%, transparent 65%), radial-gradient(ellipse 55% 45% at 100% 25%, rgba(16,185,129,0.15) 0%, transparent 65%), radial-gradient(ellipse 60% 55% at 50% 100%, rgba(29,78,216,0.22) 0%, transparent 65%), #020b2c' }}>

      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500">
            <Search className="h-5 w-5 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white">RankedCEO</span>
            <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
              Audit
            </span>
          </div>
        </Link>

        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-cyan-400/20 bg-[#0a1a3b]/90 p-8 shadow-[0_0_50px_rgba(14,165,233,0.08)] backdrop-blur-xl">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-white">Welcome back</h1>
              <p className="mt-1 text-sm text-slate-400">Sign in to access your audit dashboard</p>
            </div>

            {/* Google OAuth */}
            <button
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {googleLoading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-slate-500">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Password / Magic Link toggle */}
            <div className="mb-5 flex rounded-xl border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setMode('password')}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  mode === 'password'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setMode('magic')}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  mode === 'magic'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Magic Link
              </button>
            </div>

            <form onSubmit={mode === 'password' ? handleEmailLogin : handleMagicLink} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-xl border border-cyan-200/15 bg-[#13284d] px-4 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/20"
                />
              </div>

              {mode === 'password' && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium text-slate-300">
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 w-full rounded-xl border border-cyan-200/15 bg-[#13284d] px-4 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/20"
                  />
                </div>
              )}

              {error && (
                <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {mode === 'magic' ? 'Sending link...' : 'Signing in...'}
                  </span>
                ) : mode === 'magic' ? (
                  'Send Magic Link'
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium text-cyan-400 hover:text-cyan-300 transition-colors">
                Sign up free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuditLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#020b2c] flex items-center justify-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
        </div>
      }
    >
      <AuditLoginForm />
    </Suspense>
  )
}
