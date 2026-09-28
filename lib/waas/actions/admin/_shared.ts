// RankedCEO WaaS — Shared admin utilities (no 'use server' — helpers only)
import { createClient } from "@supabase/supabase-js";

/**
 * Max client-initiated regenerations per tenant (beyond the initial
 * selection). Lives here (not in client-review.ts) because that file has a
 * top-level "use server" directive, which only allows exporting async
 * functions — exporting a plain const from a server-actions module breaks
 * the module's client/SSR bundling under Turbopack.
 */
export const CLIENT_REGEN_DEFAULT_QUOTA = 3;

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export interface ActionResult<T = null> {
  success: boolean;
  data?: T;
  error?: string;
}

export function parseMissingTenantColumn(msg: string): string | null {
  const match = msg.match(/column "([^"]+)" of relation "waas_tenants"/);
  return match ? match[1] : null;
}

export function isPendingReviewEnumError(msg: string): boolean {
  return (
    msg.includes("invalid input value for enum") &&
    msg.includes("pending_review")
  );
}

export function isMissingSchemaTable(
  msg: string,
  _tableOrColumn?: string,
): boolean {
  return (
    msg.includes("relation") &&
    (msg.includes("does not exist") || msg.includes("undefined")) &&
    msg.includes("waas")
  );
}
