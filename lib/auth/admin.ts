// =============================================================================
// Platform-admin detection (shared)
//
// Single source of truth for "is this signed-in user a RankedCEO platform
// admin?". Used by the admin Command Center layout (app/admin/layout.tsx) and
// by the audit report page's access check.
//
// Three independent signals, any of which grants access:
//   1. the email is on the WAAS_ADMIN_EMAILS / WAAS_ADMIN_EMAIL allowlist;
//   2. the user carries a WaaS admin claim in app_metadata;
//   3. the user's public.users.role is one of the admin roles.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The subset of the Supabase `User` we need. A real `User` satisfies this, and
 * tests can pass a plain object.
 */
export interface AdminCandidate {
  id?: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
}

/**
 * Emails allowed to reach the admin area, from WAAS_ADMIN_EMAILS (comma
 * separated) or the single-value WAAS_ADMIN_EMAIL fallback. Lower-cased.
 */
export function parseAdminAllowlist(
  raw: string | undefined = process.env.WAAS_ADMIN_EMAILS ??
    process.env.WAAS_ADMIN_EMAIL ??
    "",
): string[] {
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** True when the user carries a WaaS admin claim in app_metadata. */
export function hasAdminClaim(
  user: AdminCandidate | null | undefined,
): boolean {
  const meta = (user?.app_metadata ?? {}) as Record<string, unknown>;
  return (
    meta.role === "waas_admin" ||
    meta.waas_admin === true ||
    meta.waas_admin === "true"
  );
}

/** True when the user's email is on the admin allowlist. */
export function isAllowlistedAdmin(
  user: AdminCandidate | null | undefined,
  allowlist: string[] = parseAdminAllowlist(),
): boolean {
  const email = user?.email?.trim().toLowerCase() ?? "";
  return email !== "" && allowlist.includes(email);
}

/** Allowlist or claim — the checks that need no database round-trip. */
export function isWaasAdmin(
  user: AdminCandidate | null | undefined,
  allowlist: string[] = parseAdminAllowlist(),
): boolean {
  return isAllowlistedAdmin(user, allowlist) || hasAdminClaim(user);
}

const DB_ADMIN_ROLES = new Set(["admin", "super_admin", "owner"]);

/**
 * Full platform-admin check: allowlist, app_metadata claim, or the user's
 * public.users.role. The database lookup is best-effort — any failure (missing
 * profile row, RLS, network) is treated as "not an admin" so a transient error
 * can never grant access.
 */
export async function isPlatformAdmin(
  client: SupabaseClient,
  user: AdminCandidate | null | undefined,
): Promise<boolean> {
  if (!user) return false;
  if (isWaasAdmin(user)) return true;
  if (!user.id) return false;

  try {
    const { data } = await client
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role =
      typeof (data as { role?: unknown } | null)?.role === "string"
        ? ((data as { role: string }).role).toLowerCase()
        : "";
    return DB_ADMIN_ROLES.has(role);
  } catch {
    return false;
  }
}
