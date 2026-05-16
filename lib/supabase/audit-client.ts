'use client'

import { createBrowserClient } from '@supabase/ssr'
import { type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Audit-specific Supabase browser client
//
// Uses implicit flow (not PKCE) to avoid cross-subdomain PKCE mismatch.
//
// The problem: when OAuth starts on audit.rankedceo.com, Supabase stores
// the PKCE code verifier in audit's localStorage. But the OAuth callback
// lands on crm.rankedceo.com (the Supabase Site URL), which can't find
// the verifier → "PKCE code verifier not found in storage" error.
//
// Solution: use flowType: 'implicit' so no verifier is stored or needed.
// The access token is returned directly in the URL fragment and handled
// client-side after the cross-domain redirect.
// ---------------------------------------------------------------------------

let _auditClient: SupabaseClient | null = null

export function createAuditClient(): SupabaseClient {
  if (!_auditClient) {
    _auditClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: 'implicit',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'sb-audit-auth-token',
        },
      }
    )
  }
  return _auditClient
}
