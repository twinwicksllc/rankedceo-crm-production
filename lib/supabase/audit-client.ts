"use client";

import { createBrowserClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Audit-specific Supabase browser client
//
// Uses implicit flow (not PKCE) to avoid cross-subdomain PKCE mismatch.
//
// IMPORTANT: We do NOT set a custom storageKey here — we use the default
// key so that the session cookie written by this client is readable by
// the server-side createClient() in lib/supabase/server.ts.
//
// The @supabase/ssr createBrowserClient stores sessions in cookies named:
//   sb-<project-ref>-auth-token
// The server client reads the same cookie name, so they must match.
// ---------------------------------------------------------------------------

let _auditClient: SupabaseClient | null = null;

export function createAuditClient(): SupabaseClient {
  if (!_auditClient) {
    _auditClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: "implicit",
          // Do NOT set detectSessionInUrl:true on the login page client.
          // When true, the Supabase browser client calls history.replaceState()
          // to strip tokens from the URL on mount.  In Next.js App Router that
          // triggers a navigation event which re-evaluates useSearchParams(),
          // causing a re-render loop.  Token extraction from the URL is handled
          // exclusively by /audit/auth/confirm (the OAuth callback page).
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: true,
          // No custom storageKey — must match what the server client reads
        },
      },
    );
  }
  return _auditClient;
}
