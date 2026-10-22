import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Resolve the signed-in user's account (and profile row)
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
//
// IMPORTANT: when the email fallback matches, the profile row's `id` is NOT
// the auth uid. Callers that address the `users` row itself (select or
// update it) must use the `user_id` returned by `resolveUserProfile`, never
// `user.id` — otherwise the legacy case silently returns no row.
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
          data: { id?: string | null; account_id?: string | null } | null;
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

/** The caller's account plus the `users` row that matched. */
export interface ResolvedUserProfile {
  /** `accounts.id` — the tenant scope. */
  account_id: string;
  /** `users.id` of the matched row. Equals the auth uid except in the legacy case. */
  user_id: string;
}

/**
 * Resolves the caller's `users` row and `account_id`.
 *
 * Looks up `users` by `id` (the auth uid) first, then by `email` for a
 * legacy profile. Throws `Account not found` when neither matches, which is
 * the same error the create paths threw before.
 */
export async function resolveUserProfile(
  client: AccountLookupClient | SupabaseClient,
  user: AccountLookupUser,
): Promise<ResolvedUserProfile> {
  const db = client as AccountLookupClient;

  const byId = await db
    .from("users")
    .select("id, account_id")
    .eq("id", user.id)
    .maybeSingle();

  // A lookup error is a real failure (RLS, network, bad column). Never paper
  // it over with a second query — that would hide the cause.
  if (byId.error) {
    throw new Error(`Account lookup failed: ${byId.error.message}`);
  }

  if (byId.data?.account_id) {
    return {
      account_id: byId.data.account_id,
      user_id: byId.data.id ?? user.id,
    };
  }

  // Legacy fallback: a profile row exists but its id is not the auth uid.
  const email = (user.email ?? "").trim();
  if (email) {
    const byEmail = await db
      .from("users")
      .select("id, account_id")
      .eq("email", email)
      .maybeSingle();

    const emailAccount = byEmail.data?.account_id;
    if (!byEmail.error && emailAccount) {
      // The matched row's own id — NOT the auth uid.
      return { account_id: emailAccount, user_id: byEmail.data?.id ?? user.id };
    }
  }

  throw new Error("Account not found");
}

/**
 * Returns the caller's `account_id`.
 *
 * Thin wrapper over {@link resolveUserProfile} for callers that only need
 * the tenant scope.
 */
export async function resolveAccountId(
  client: AccountLookupClient | SupabaseClient,
  user: AccountLookupUser,
): Promise<string> {
  const { account_id } = await resolveUserProfile(client, user);
  return account_id;
}
