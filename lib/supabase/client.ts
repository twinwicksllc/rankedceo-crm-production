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

let storageNormalized = false

export function createClient() {
  if (!storageNormalized) {
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