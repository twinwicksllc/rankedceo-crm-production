"use server";

// =============================================================================
// submitTenantLead (B5): server action behind the lead form on a customer's
// website. Public (no login), so all trust decisions live in
// services/tenant-lead-service.ts: signed tenant token, live-tenant check, spam
// signals and a per-hour rate limit. This file only supplies the real database,
// headers and email.
//
// Writes use the WaaS service-role key, which bypasses row-level security; the
// tenant id written is the one the service verified. No anon INSERT policy is
// involved (leads_anon_insert still allows only audit_tool and email_capture).
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
  const countWhere = async (
    tenantId: string,
    sinceIso: string,
    extra?: { column: "ip_hash" | "email"; value: string },
  ): Promise<number> => {
    let query = client
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("source", "tenant_site")
      .gte("created_at", sinceIso);
    if (extra) query = query.eq(extra.column, extra.value);
    const { count, error } = await query;
    if (error) throw new Error(`count failed: ${error.code ?? "unknown"}`);
    return count ?? 0;
  };

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

    countRecent: async (tenantId, keys, sinceIso) => {
      const [ip, email, tenant] = await Promise.all([
        keys.ipHash
          ? countWhere(tenantId, sinceIso, { column: "ip_hash", value: keys.ipHash })
          : Promise.resolve(0),
        countWhere(tenantId, sinceIso, { column: "email", value: keys.email }),
        countWhere(tenantId, sinceIso),
      ]);
      return { ip, email, tenant };
    },

    insertLead: async (row) => {
      const { data, error } = await client
        .from("leads")
        .insert(row)
        .select("id")
        .single();
      if (error || !data) {
        // Code only: the row holds the visitor's contact details.
        console.error("[tenant-lead] insert failed:", error?.code ?? "no row");
        return null;
      }
      return { id: data.id as string };
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
