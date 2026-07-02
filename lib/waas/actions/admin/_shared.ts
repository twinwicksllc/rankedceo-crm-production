// RankedCEO WaaS — Shared admin utilities (no 'use server' — helpers only)
import { createClient } from "@supabase/supabase-js";

export function getAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "WaaS admin credentials not fully set (NEXT_PUBLIC_WAAS_SUPABASE_URL and WAAS_SUPABASE_SERVICE_ROLE_KEY are required)",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
