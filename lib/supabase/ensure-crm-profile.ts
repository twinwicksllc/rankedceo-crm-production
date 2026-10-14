// ============================================================
// Ensure a CRM profile exists for a signed-in auth user
// ============================================================
// Why this exists
// ---------------
// The CRM project's auth.users and public.users are not linked by any
// trigger that this app controls. The only live trigger on auth.users is
// `on_auth_user_created`, and its function belongs to a different product
// that shares the same Supabase project (it writes `profiles`,
// `organizations` and `org_members`, never `public.users`). So a new
// signup (trade signup page, magic link, Google) lands in auth.users with
// no `public.users` row and no `accounts` row, and the dashboard then
// shows "Account Setup Required".
//
// This helper closes that gap in application code, so no shared database
// object is touched:
//   1. If the user already has a `public.users` row, do nothing.
//   2. Otherwise create one `accounts` row and one `public.users` row with
//      `id = auth.users.id`.
// It is idempotent and safe to call on every dashboard render.
//
// It must run with a service-role client, because `public.users` and
// `accounts` are RLS-protected and the anon/SSR client cannot insert.
//
// Security note: the new profile is created with role `member`, never
// `owner`/`admin`/`super_admin`. `app/admin/layout.tsx` treats
// `role in (admin, super_admin, owner)` as platform admin, so granting
// those here would make every new signup an admin.
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";

export interface EnsureProfileUser {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

export interface EnsureProfileResult {
  /** true when a usable profile exists after the call (created now or already there). */
  ok: boolean;
  /** true only when this call created the profile. */
  created: boolean;
  accountId: string | null;
  /** Present when ok is false, or for logging when a race was resolved. */
  reason?: string;
}

type Row = Record<string, unknown>;
interface SingleResult {
  data: Row | null;
  error: { message: string } | null;
}
interface WriteResult {
  error: { message: string } | null;
}

interface TableBuilder {
  select(columns: string): {
    eq(
      column: string,
      value: string,
    ): {
      maybeSingle(): Promise<SingleResult>;
    };
  };
  insert(values: Row): {
    select(columns: string): {
      maybeSingle(): Promise<SingleResult>;
    };
  };
  delete(): {
    eq(column: string, value: string): PromiseLike<WriteResult>;
  };
}

export interface EnsureProfileClient {
  from(table: "users" | "accounts"): TableBuilder;
}

const DEFAULT_ROLE = "member";
const DEFAULT_STATUS = "active";

/** A human-readable account name: signup company name, else the email local part. */
export function deriveAccountName(user: EnsureProfileUser): string {
  const meta = user.user_metadata ?? {};
  for (const key of ["company_name", "full_name", "name"] as const) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 255);
    }
  }
  const email = (user.email ?? "").trim();
  const local = email.includes("@") ? email.split("@")[0] : email;
  return (local || "My Account").slice(0, 255);
}

/**
 * Make sure `public.users` has a row (and an owning `accounts` row) for this
 * auth user. Never throws: any failure is returned as `{ ok: false, reason }`
 * so a page render can continue.
 */
export async function ensureCrmProfile(
  user: EnsureProfileUser,
  client?: EnsureProfileClient,
): Promise<EnsureProfileResult> {
  if (!user?.id) {
    return {
      ok: false,
      created: false,
      accountId: null,
      reason: "missing user id",
    };
  }

  let db: EnsureProfileClient;
  if (client) {
    db = client;
  } else {
    try {
      db = createAdminClient() as unknown as EnsureProfileClient;
    } catch (error) {
      return {
        ok: false,
        created: false,
        accountId: null,
        reason: `admin client unavailable: ${(error as Error).message}`,
      };
    }
  }

  // 1. Already has a profile?
  const existing = await db
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing.error) {
    return {
      ok: false,
      created: false,
      accountId: null,
      reason: `profile lookup failed: ${existing.error.message}`,
    };
  }
  if (existing.data) {
    return {
      ok: true,
      created: false,
      accountId: asString(existing.data.account_id),
    };
  }

  // 2. Create the owning account.
  const accountName = deriveAccountName(user);
  const accountInsert = await db
    .from("accounts")
    .insert({ name: accountName })
    .select("id")
    .maybeSingle();

  if (accountInsert.error || !accountInsert.data) {
    return {
      ok: false,
      created: false,
      accountId: null,
      reason: `account insert failed: ${
        accountInsert.error?.message ?? "no row returned"
      }`,
    };
  }
  const accountId = String(accountInsert.data.id);

  // 3. Create the profile, keyed by the auth id.
  const profileInsert = await db
    .from("users")
    .insert({
      id: user.id,
      account_id: accountId,
      email: (user.email ?? "").trim().toLowerCase() || null,
      name: accountName,
      role: DEFAULT_ROLE,
      status: DEFAULT_STATUS,
    })
    .select("account_id")
    .maybeSingle();

  if (profileInsert.error || !profileInsert.data) {
    // A concurrent request may have created the profile first. Re-read it and
    // remove the account we just made so we do not leave an orphan.
    const retry = await db
      .from("users")
      .select("account_id")
      .eq("id", user.id)
      .maybeSingle();

    const retryAccountId = retry.data
      ? asString(retry.data.account_id)
      : null;

    if (retryAccountId && retryAccountId !== accountId) {
      await db.from("accounts").delete().eq("id", accountId);
      return {
        ok: true,
        created: false,
        accountId: retryAccountId,
        reason: "profile already created by a concurrent request",
      };
    }
    if (!retryAccountId) {
      // The profile really was not created: clean up and report failure.
      await db.from("accounts").delete().eq("id", accountId);
      return {
        ok: false,
        created: false,
        accountId: null,
        reason: `profile insert failed: ${
          profileInsert.error?.message ?? "no row returned"
        }`,
      };
    }
    // retryAccountId === accountId: our insert did land, treat as success.
    return { ok: true, created: true, accountId };
  }

  return { ok: true, created: true, accountId };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
