"use server";

import { resolveClientEditSession } from "@/lib/waas/client-edit/edit-session";
import {
  loadTenantLeads,
  type TenantLeadItem,
  type TenantLeadsQueryClient,
} from "@/lib/waas/client-edit/tenant-leads";
import { getAdminClient } from "./_shared";
import type { ActionResult } from "./_shared";

// =============================================================================
// B5: leads sent through the contact form on the tenant's own website.
// Access is the portal review token, exactly like the audit history tab; the
// tenant id comes from the verified session, never from the request.
// =============================================================================

export async function getTenantLeads(
  reviewToken: string,
): Promise<ActionResult<TenantLeadItem[]>> {
  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message };
  }

  try {
    const client = getAdminClient() as unknown as TenantLeadsQueryClient;
    const { items, error } = await loadTenantLeads(
      client,
      sessionResult.session.tenantId,
    );
    if (error) return { success: false, error };
    return { success: true, data: items };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load leads",
    };
  }
}
