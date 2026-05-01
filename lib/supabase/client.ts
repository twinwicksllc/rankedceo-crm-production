import { createBrowserClient } from '@supabase/ssr'
import * as React from 'react'

function normalizeSupabaseAuthStorage() {
  if (typeof window === 'undefined') return

  const storage = window.localStorage
  const authTokenKeys: string[] = []

  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (!key) continue
    if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
      authTokenKeys.push(key)
    }
  }

  for (const key of authTokenKeys) {
    const raw = storage.getItem(key)
    if (!raw) continue

    try {
      const parsed = JSON.parse(raw)

      // Some broken states store JSON as a JSON-encoded string.
      if (typeof parsed === 'string') {
        const reparsed = JSON.parse(parsed)
        if (reparsed && typeof reparsed === 'object') {
          storage.setItem(key, JSON.stringify(reparsed))
          continue
        }
      }

      if (!parsed || typeof parsed !== 'object') {
        storage.removeItem(key)
      }
    } catch {
      // Invalid token payload can cause auth recovery crashes; drop it.
      storage.removeItem(key)
    }
  }
}

function expireCookie(name: string, domain?: string) {
  const domainPart = domain ? `; domain=${domain}` : ''
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax${domainPart}`
}

function normalizeSupabaseAuthCookies() {
  if (typeof document === 'undefined') return

  const entries = document.cookie
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)

  for (const entry of entries) {
    const idx = entry.indexOf('=')
    const key = idx >= 0 ? entry.slice(0, idx) : entry
    const rawValue = idx >= 0 ? entry.slice(idx + 1) : ''

    if (!key.startsWith('sb-') || !key.includes('-auth-token')) {
      continue
    }

    const decoded = decodeURIComponent(rawValue || '')

    try {
      const parsed = JSON.parse(decoded)

      if (typeof parsed === 'string') {
        const reparsed = JSON.parse(parsed)
        if (reparsed && typeof reparsed === 'object') {
          document.cookie = `${key}=${encodeURIComponent(JSON.stringify(reparsed))}; Path=/; SameSite=Lax`
          continue
        }
      }

      if (!parsed || typeof parsed !== 'object') {
        expireCookie(key)
      }
    } catch {
      // Ignore chunk cookies and only delete obvious malformed single-value payloads.
      if (!key.match(/\.\d+$/)) {
        expireCookie(key)

        if (typeof window !== 'undefined' && window.location.hostname.endsWith('.rankedceo.com')) {
          expireCookie(key, '.rankedceo.com')
        }
      }
    }
  }
}

let storageNormalized = false

export function createClient() {
  if (!storageNormalized) {
    normalizeSupabaseAuthCookies()
    normalizeSupabaseAuthStorage()
    storageNormalized = true
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Hook to get current session
export function useSession() {
  const [session, setSession] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const supabase = createClient()

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { data: session, loading }
}