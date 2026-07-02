"use server";

import {
  resolveClientEditSession,
  hashReviewToken,
} from "@/lib/waas/client-edit/edit-session";
import { getAdminClient } from "./_shared";
import type { ActionResult } from "./_shared";

// =============================================================================
// 12. submitDomainChangeRequest
//     Phase 6.3: Allows a client to submit a post-onboarding domain change
//     request from /edit/[reviewToken].
//     Writes to client_domain_change_requests table.
// =============================================================================

export interface DomainChangeRequestArgs {
  reviewToken: string;
  requestedDomain: string; // e.g. 'acmeplumbing.com'
  note?: string; // optional client message
}

export interface ClientDomainChangeRequest {
  id: string;
  requestedDomain: string;
  status: string;
  adminResponse: string | null;
  createdAt: string;
}

export async function submitDomainChangeRequest(
  args: DomainChangeRequestArgs,
): Promise<ActionResult<ClientDomainChangeRequest>> {
  const { reviewToken, requestedDomain, note } = args;

  if (!requestedDomain || requestedDomain.trim().length < 4) {
    return { success: false, error: "Please enter a valid domain name." };
  }

  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message };
  }

  const { tenantId } = sessionResult.session;
  const tokenHash = hashReviewToken(reviewToken);

  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("client_domain_change_requests")
      .insert({
        tenant_id: tenantId,
        review_token_hash: tokenHash,
        requested_domain: requestedDomain.trim().toLowerCase(),
        request_note: note?.trim() ?? null,
        status: "pending",
      })
      .select("id, requested_domain, status, admin_response, created_at")
      .single();

    if (error) return { success: false, error: error.message };

    const row = data as {
      id: string;
      requested_domain: string;
      status: string;
      admin_response: string | null;
      created_at: string;
    };

    return {
      success: true,
      data: {
        id: row.id,
        requestedDomain: row.requested_domain,
        status: row.status,
        adminResponse: row.admin_response,
        createdAt: row.created_at,
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to submit domain request",
    };
  }
}

export async function getClientDomainRequests(
  reviewToken: string,
): Promise<ActionResult<ClientDomainChangeRequest[]>> {
  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message };
  }

  const { tenantId } = sessionResult.session;

  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("client_domain_change_requests")
      .select("id, requested_domain, status, admin_response, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: (
        (data ?? []) as Array<{
          id: string;
          requested_domain: string;
          status: string;
          admin_response: string | null;
          created_at: string;
        }>
      ).map((r) => ({
        id: r.id,
        requestedDomain: r.requested_domain,
        status: r.status,
        adminResponse: r.admin_response,
        createdAt: r.created_at,
      })),
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to load domain requests",
    };
  }
}
