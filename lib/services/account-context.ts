import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Resolve the signed-in user's account
// ============================================================
// `users.id` IS the auth uid in both projects:
//   - WaaS: `handle_new_user()` in 027 inserts `users(id, ...)` from NEW.id.
//   - CRM:  the live `handle_new_user()` belongs to the other product and
//           never writes `public.users`, so the profile is created by
//           `ensureCrmProfile()` with `id = auth.users.id`
//           (app/(dashboard)/layout.tsx calls it on every dashboard render).
//
// `accounts` has never had a `user_id` column, so the old
// `accounts.select("id").eq("user_id", user.id)` always returned zero rows.
//
// The email fallback exists only for a legacy profile whose id does NOT
// match its auth id (the shape `000007_correct_link_auth_users.sql` would
// have produced had that trigger ever been live). It is a no-op in WaaS,
// where `users.email` is NULL, so it can never mask a real mismatch there.
// ============================================================

/** The slice of the Supabase client this helper needs (keeps it testable). */
export interface AccountLookupClient {
  from(table: "users"): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        maybeSingle(): Promise<{
          data: { account_id?: string | null } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

export interface AccountLookupUser {
  id: string;
  email?: string | null;
}

/**
 * Returns the caller's `account_id`.
 *
 * Looks up `users` by `id` (the auth uid) first, then by `email` for a
 * legacy profile. Throws `Account not found` when neither matches, which is
 * the same error the create paths threw before.
 */
export async function resolveAccountId(
  client: AccountLookupClient | SupabaseClient,
  user: AccountLookupUser,
): Promise<string> {
  const db = client as AccountLookupClient;

  const byId = await db
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();

  // A lookup error is a real failure (RLS, network, bad column). Never paper
  // it over with a second query — that would hide the cause.
  if (byId.error) {
    throw new Error(`Account lookup failed: ${byId.error.message}`);
  }

  const idAccount = byId.data?.account_id;
  if (idAccount) {
    return idAccount;
  }

  // Legacy fallback: a profile row exists but its id is not the auth uid.
  const email = (user.email ?? "").trim();
  if (email) {
    const byEmail = await db
      .from("users")
      .select("account_id")
      .eq("email", email)
      .maybeSingle();

    const emailAccount = byEmail.data?.account_id;
    if (!byEmail.error && emailAccount) {
      return emailAccount;
    }
  }

  throw new Error("Account not found");
}
