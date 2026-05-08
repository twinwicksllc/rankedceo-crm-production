import { createBrowserClient } from '@supabase/ssr'
import {
  type Session,
  type AuthChangeEvent,
  type SupabaseClient,
} from '@supabase/supabase-js'
import * as React from 'react'

// ---------------------------------------------------------------------------
// One-time auth storage/cookie normalization
// Runs once per browser session via a sessionStorage flag so it never
// blocks the main thread on subsequent page loads or React re-renders.
// ---------------------------------------------------------------------------

function runStorageNormalization() {
  if (typeof window === 'undefined') return

  // Guard: only run once per browser tab session
  const FLAG = '__sb_norm_done'
  if (window.sessionStorage.getItem(FLAG) === '1') return
  window.sessionStorage.setItem(FLAG, '1')

  // --- 1. Fix malformed localStorage auth tokens ---
  try {
    const ls = window.localStorage
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i)
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue
      const raw = ls.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw)
        if (typeof parsed === 'string') {
          const reparsed = JSON.parse(parsed)
          if (reparsed && typeof reparsed === 'object') {
            ls.setItem(key, JSON.stringify(reparsed))
            continue
          }
        }
        if (!parsed || typeof parsed !== 'object') {
          ls.removeItem(key)
        }
      } catch {
        ls.removeItem(key)
      }
    }
  } catch {
    // localStorage may be blocked (private browsing, etc.) — safe to ignore
  }

  // --- 2. Clear stale PKCE / OAuth transient keys from both storages ---
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      const toRemove: string[] = []
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (!key || !key.startsWith('sb-')) continue
        const lower = key.toLowerCase()
        if (lower.includes('code-verifier') || lower.includes('pkce') || lower.includes('oauth')) {
          toRemove.push(key)
        }
      }
      toRemove.forEach((k) => storage.removeItem(k))
    }
  } catch {
    // Safe to ignore
  }

  // --- 3. Fix malformed cookies (single-pass, no reflows) ---
  try {
    const cookieStr = document.cookie // single read
    const entries = cookieStr.split(';').map((c) => c.trim()).filter(Boolean)

    for (const entry of entries) {
      const eqIdx = entry.indexOf('=')
      if (eqIdx < 0) continue
      const key = entry.slice(0, eqIdx).trim()
      const rawValue = entry.slice(eqIdx + 1)

      if (!key.startsWith('sb-') || !key.includes('-auth-token')) continue
      if (key.match(/\.\d+$/)) continue

      const decoded = decodeURIComponent(rawValue || '')
      try {
        const parsed = JSON.parse(decoded)
        if (typeof parsed === 'string') {
          try {
            const reparsed = JSON.parse(parsed)
            if (reparsed && typeof reparsed === 'object') {
              document.cookie = `${key}=${encodeURIComponent(JSON.stringify(reparsed))}; Path=/; SameSite=Lax`
            }
          } catch { /* inner JSON invalid — leave it */ }
        } else if (!parsed || typeof parsed !== 'object') {
          expireCookie(key)
        }
      } catch {
        expireCookie(key)
        if (window.location.hostname.endsWith('.rankedceo.com')) {
          expireCookie(key, '.rankedceo.com')
        }
      }
    }
  } catch {
    // document.cookie access blocked — safe to ignore
  }
}

function expireCookie(name: string, domain?: string) {
  const domainPart = domain ? `; domain=${domain}` : ''
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax${domainPart}`
}

// ---------------------------------------------------------------------------
// Supabase browser client
// createClient() is intentionally lightweight — normalization runs separately
// at app boot (see below) and is guarded to run at most once per tab session.
// ---------------------------------------------------------------------------

// Typed alias so callers and hooks have a stable, explicit return type
type BrowserSupabaseClient = SupabaseClient

let _client: BrowserSupabaseClient | null = null

export function createClient(): BrowserSupabaseClient {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}

// Run normalization once at module load time (browser only).
if (typeof window !== 'undefined') {
  setTimeout(runStorageNormalization, 0)
}

// ---------------------------------------------------------------------------
// useSession hook
// ---------------------------------------------------------------------------

export function useSession() {
  const [session, setSession] = React.useState<Session | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const supabase: BrowserSupabaseClient = createClient()

    // Explicit void to satisfy no-floating-promises; typed via getSession return
    void supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        setSession(data.session)
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, s: Session | null) => {
        setSession(s)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { data: session, loading }
}
