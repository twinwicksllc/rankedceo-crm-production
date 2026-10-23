import type { SupabaseClient } from "@supabase/supabase-js";
import { POOL_ACCOUNTS, type PoolIndustry } from "../data/pool-accounts";

// ============================================================
// Which account a public lead is filed under
// ============================================================
// The share link (/lead?operatorId=<user id>) is how an operator receives leads.
// The insert uses the admin client, which bypasses row-level security, so the id
// from the URL must not choose the account on its own. It is accepted only when
// it is a real user whose account exists and is not a pool account. Anything
// else, including any lookup error, files the lead under the industry pool.
//
// This is a capability link: whoever holds it can file leads to that operator,
// which is what the link is for. It stops a made-up or pool id from reaching
// another account; it does not authenticate the visitor.
// ============================================================

export interface LeadTarget {
  accountId: string;
  authUserId: string | null;
}

export async function resolveLeadTarget(
  admin: SupabaseClient,
  industry: PoolIndustry,
  operatorId: string | null | undefined,
): Promise<LeadTarget> {
  const pool: LeadTarget = {
    accountId: POOL_ACCOUNTS[industry],
    authUserId: null,
  };
  if (!operatorId) return pool;

  const { data: user, error: userError } = await admin
    .from("users")
    .select("account_id")
    .eq("id", operatorId)
    .maybeSingle();
  if (userError || !user?.account_id) return pool;

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .select("is_pool_account")
    .eq("id", user.account_id)
    .maybeSingle();
  if (accountError || !account || account.is_pool_account === true) return pool;

  return { accountId: user.account_id, authUserId: operatorId };
}
