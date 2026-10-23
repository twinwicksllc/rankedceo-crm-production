import { createClient } from "@supabase/supabase-js";

// ============================================================
// Supabase anon client with no session
// ============================================================
// Use for public intake forms whose RLS policy is TO anon. The cookie-bound
// client from lib/supabase/server.ts runs as `authenticated` whenever the
// visitor happens to be signed in, and an authenticated role cannot use an
// anon-only policy. This client never reads cookies, so it is always anon.
// ============================================================

export function createAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
