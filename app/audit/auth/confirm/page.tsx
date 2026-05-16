'use client'

import { useEffect, useState } from 'react'
import { createAuditClient } from '@/lib/supabase/audit-client'

/**
 * Audit Auth Confirm Page
 *
 * Handles the implicit OAuth landing. After Google OAuth, Supabase redirects
 * here with tokens in the URL hash fragment:
 *   audit.rankedceo.com/audit/auth/confirm#access_token=...&refresh_token=...
 *
 * Steps:
 * 1. Parse the hash fragment manually
 * 2. Call supabase.auth.setSession() explicitly to write session cookies
 * 3. Hard navigate (window.location.href) to /audit/start so the server
 *    component gets a fresh request and reads the newly-written cookies
 *
 * We use window.location.href (not router.push) because router.push is
 * a client-side navigation that reuses the same server render — the server
 * component won't re-run its auth check. A full page load forces the server
 * to re-read cookies.
 */
export default function AuditAuthConfirmPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function handleAuthCallback() {
      const supabase = createAuditClient()

      try {
        // --- Step 1: Parse hash fragment ---
        const hash = window.location.hash.substring(1) // remove leading #
        const params = new URLSearchParams(hash)
        const accessToken  = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const errorCode    = params.get('error')
        const errorDesc    = params.get('error_description')

        // Handle OAuth error in hash
        if (errorCode) {
          throw new Error(errorDesc || errorCode)
        }

        if (accessToken && refreshToken) {
          // --- Step 2: Explicitly set the session ---
          // This writes the session to cookies (domain=.rankedceo.com)
          // so the server component can read it on the next request
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (error) throw error
          if (!data.session) throw new Error('Session could not be established')

          setStatus('success')

          // --- Step 3: Hard navigate to /audit/start ---
          // Full page load so server component re-runs auth check with new cookies
          setTimeout(() => {
            window.location.href = '/audit/start'
          }, 600)

        } else {
          // No tokens in hash — maybe session already exists, try getSession
          const { data: { session }, error } = await supabase.auth.getSession()

          if (error) throw error

          if (session) {
            setStatus('success')
            setTimeout(() => {
              window.location.href = '/audit/start'
            }, 600)
          } else {
            // Let detectSessionInUrl handle it via onAuthStateChange
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
              async (event, session) => {
                if (event === 'SIGNED_IN' && session) {
                  setStatus('success')
                  setTimeout(() => {
                    window.location.href = '/audit/start'
                  }, 600)
                  subscription.unsubscribe()
                } else if (event === 'SIGNED_OUT') {
                  throw new Error('Sign in failed')
                }
              }
            )

            // Timeout fallback — if no event after 5s, redirect to login
            setTimeout(() => {
              subscription.unsubscribe()
              if (status === 'loading') {
                window.location.href = '/login?error=timeout'
              }
            }, 5000)
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Authentication failed'
        console.error('[AuditAuthConfirm] Error:', msg)
        setStatus('error')
        setErrorMsg(msg)
        setTimeout(() => {
          window.location.href = '/login?error=' + encodeURIComponent(msg)
        }, 2500)
      }
    }

    void handleAuthCallback()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
              <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Signed in!</h2>
            <p className="mt-2 text-sm text-slate-400">Redirecting to your audit dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15">
              <svg className="h-8 w-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
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
