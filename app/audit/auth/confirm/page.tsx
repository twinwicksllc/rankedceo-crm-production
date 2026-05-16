'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuditClient } from '@/lib/supabase/audit-client'

/**
 * Audit Auth Confirm Page
 *
 * This page handles the implicit OAuth flow landing.
 * After Google OAuth with implicit flow, Supabase redirects here with the
 * access token in the URL hash fragment (#access_token=...&refresh_token=...).
 *
 * The Supabase client (with detectSessionInUrl: true) automatically parses
 * the fragment, sets the session in storage, and we then redirect to /audit/start.
 *
 * This intermediate page is necessary because:
 * 1. The hash fragment is only accessible client-side (not on the server)
 * 2. The server component at /audit/start checks for a session via cookies
 * 3. We need to give the client-side Supabase a moment to write the session
 *    to cookies before the server component runs
 */
export default function AuditAuthConfirmPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const supabase = createAuditClient()

    // detectSessionInUrl: true in the audit client means Supabase will
    // automatically parse the hash fragment and set the session.
    // We just need to wait for the auth state change event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setStatus('success')
          // Small delay to ensure cookies are written before server component runs
          setTimeout(() => {
            router.replace('/audit/start')
          }, 500)
        } else if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
          setStatus('error')
          setErrorMsg('Authentication failed. Please try again.')
          setTimeout(() => {
            router.replace('/login')
          }, 2000)
        }
      }
    )

    // Also try getSession directly in case the event already fired
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setStatus('error')
        setErrorMsg(error.message)
        setTimeout(() => router.replace('/login?error=' + encodeURIComponent(error.message)), 2000)
        return
      }
      if (session) {
        setStatus('success')
        setTimeout(() => router.replace('/audit/start'), 500)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020b2c] flex items-center justify-center px-4">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-0 h-80 w-80 rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-emerald-500/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-700/25 blur-[140px]" />
      </div>

      <div className="relative text-center">
        {status === 'loading' && (
          <>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/15">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Signing you in...</h2>
            <p className="mt-2 text-sm text-slate-400">Setting up your audit session</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
              ✓
            </div>
            <h2 className="text-xl font-bold text-white">Signed in!</h2>
            <p className="mt-2 text-sm text-slate-400">Redirecting to your audit dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15 text-3xl">
              ✗
            </div>
            <h2 className="text-xl font-bold text-white">Authentication failed</h2>
            <p className="mt-2 text-sm text-rose-400">{errorMsg}</p>
            <p className="mt-1 text-xs text-slate-500">Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  )
}
