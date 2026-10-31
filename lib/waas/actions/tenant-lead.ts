"use server";

// =============================================================================
// submitTenantLead (B5): server action behind the lead form on a customer's
// website. Public (no login), so all trust decisions live in
// services/tenant-lead-service.ts: signed tenant token, live-tenant check, spam
// signals and a per-hour rate limit. This file only supplies the real database,
// headers and email.
//
// Writes use the WaaS service-role key, which bypasses row-level security; the
// tenant id written is the one the service verified. The rate-limit check and the
// insert happen in one database function (migration 035), so parallel requests
// cannot bypass the limit. No anon INSERT policy is involved.
// =============================================================================

import { headers } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientIpFromHeaders } from "../services/tenant-lead-guard";
import {
  processTenantLead,
  type TenantLeadDeps,
  type TenantLeadResult,
} from "../services/tenant-lead-service";
import { sendTenantNotification } from "../services/notifications";

export type SubmitTenantLeadResult = TenantLeadResult;

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL;
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

function buildDeps(client: SupabaseClient): TenantLeadDeps {
  return {
    now: () => Date.now(),

    loadTenant: async (id) => {
      const { data, error } = await client
        .from("tenants")
        .select("id, status, legal_name, brand_config")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      const brand = (data.brand_config ?? {}) as { business_name?: string };
      return {
        id: data.id as string,
        status: String(data.status),
        businessName:
          brand.business_name ?? (data.legal_name as string | null) ?? "your business",
      };
    },

    // One database step: the limits are checked and the lead inserted under a
    // per-tenant lock (migration 035). See tenant-lead-service.ts.
    submitLimited: async ({ tenantId, row, windowStartIso, limits }) => {
      const { data, error } = await client.rpc("insert_tenant_lead_limited", {
        p_tenant_id: tenantId,
        p_row: row,
        p_window_start: windowStartIso,
        p_per_ip: limits.perIp,
        p_per_email: limits.perEmail,
        p_ip_hash: row.ip_hash,
        p_email: row.email,
      });
      if (error) {
        // Code only: the row holds the visitor's contact details.
        console.error("[tenant-lead] limited insert failed:", error.code ?? "unknown");
        return { status: "error" };
      }
      const result = data as {
        status?: string;
        id?: string;
        tenant_count?: number;
      } | null;
      if (result?.status === "rate_limited") return { status: "rate_limited" };
      if (result?.status === "ok" && typeof result.id === "string") {
        return {
          status: "ok",
          id: result.id,
          tenantCount: Number(result.tenant_count ?? 0),
        };
      }
      return { status: "error" };
    },

    notify: async ({ tenantId, leadId, businessName, lead }) => {
      await sendTenantNotification({
        type: "tenant_lead_received",
        tenantId,
        dedupKey: `lead:${leadId}`,
        data: {
          businessName,
          leadName: lead.name,
          leadEmail: lead.email,
          leadPhone: lead.phone ?? undefined,
          leadMessage: lead.message ?? undefined,
          leadService: lead.service_requested ?? undefined,
          leadPageUrl: lead.page_url ?? undefined,
        },
      });
    },
  };
}

export async function submitTenantLead(
  input: unknown,
): Promise<SubmitTenantLeadResult> {
  const client = getAdminClient();
  if (!client) {
    return {
      ok: false,
      code: "unavailable",
      error: "This form is not available right now. Please call us instead.",
    };
  }

  const requestHeaders = await headers();
  const ip = clientIpFromHeaders((name) => requestHeaders.get(name));

  try {
    return await processTenantLead(input, { ip }, buildDeps(client));
  } catch (err) {
    console.error("[tenant-lead] unexpected error:", String(err).slice(0, 200));
    return {
      ok: false,
      code: "error",
      error: "We could not send your message. Please call us instead.",
    };
  }
}
