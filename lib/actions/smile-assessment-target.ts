import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveAccountId,
  type AccountLookupClient,
} from "../services/account-context";

// ============================================================
// Decide which account a smile assessment belongs to
// ============================================================
// Kept out of the "use server" action so it can be tested with a fake client.
//
// RLS on smile_assessments (waas/030):
//   - anon may INSERT only with account_id = the smile pool account;
//   - authenticated may only write rows whose account_id is their own.
// So a public (anonymous) submission must go to the pool, and a signed-in
// dentist's submission must go to their own account or not be inserted.
// ============================================================

/**
 * Seeded in waas/030; the anon insert policy is hard-coded to this id.
 * Must equal POOL_ACCOUNTS.smile in lib/data/pool-accounts.ts.
 */
export const SMILE_POOL_ACCOUNT_ID = "00000000-0000-4000-a000-000000000004";

/**
 * The dentist id from a public link, or null. Older links carried the pool
 * ACCOUNT id as dentistId; that is not a user id, so treat it as "no dentist".
 */
export function publicDentistId(dentistId?: string | null): string | null {
  return dentistId && dentistId !== SMILE_POOL_ACCOUNT_ID ? dentistId : null;
}

export interface SmileTargetUser {
  id: string;
  email?: string | null;
}

export type SmileTarget =
  | { accountId: string; authUserId: string | null }
  | { error: string };

/**
 * @param dentistId the dentist's auth uid from a public form link, if any.
 * @param user the signed-in user from `auth.getUser()`, or null.
 */
export async function resolveSmileTarget(
  client: AccountLookupClient | SupabaseClient,
  input: { dentistId?: string | null; user: SmileTargetUser | null },
): Promise<SmileTarget> {
  const dentistId = publicDentistId(input.dentistId);
  if (dentistId) {
    // Pool, not the dentist's account: the anon insert policy rejects any other
    // account_id. auth_user_id keeps the dentist so it can be attributed later.
    return { accountId: SMILE_POOL_ACCOUNT_ID, authUserId: dentistId };
  }

  if (!input.user) {
    return { accountId: SMILE_POOL_ACCOUNT_ID, authUserId: null };
  }

  try {
    const accountId = await resolveAccountId(client, input.user);
    return { accountId, authUserId: input.user.id };
  } catch (err) {
    // Either way, do not insert: the pool fallback would fail the
    // authenticated policy. resolveAccountId throws "Account not found" when
    // there is no profile, and "Account lookup failed: ..." on a query error.
    const noProfile =
      err instanceof Error && err.message === "Account not found";
    return {
      error: noProfile
        ? "Your account profile was not found. Please sign out and back in, or contact support."
        : "We could not save your assessment right now. Please try again.",
    };
  }
}
