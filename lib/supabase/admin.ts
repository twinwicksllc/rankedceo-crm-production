// ============================================================
// Supabase Admin Client - Uses Service Role Key to bypass RLS
// ============================================================
// IMPORTANT: Only use this in server-side code (API routes, webhooks)
// NEVER expose this client to the browser or client components
// The service role key bypasses ALL Row Level Security policies
// ============================================================

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
        "Add this to your Vercel environment variables. " +
        "Find it in Supabase Dashboard → Settings → API → service_role key",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
