"use server";

import { revalidatePath } from "next/cache";
import {
  resolveClientEditSession,
  hashReviewToken,
} from "@/lib/waas/client-edit/edit-session";
import { getAdminClient } from "./_shared";
import type { ActionResult } from "./_shared";

// =============================================================================
// 5. submitClientApproval
//    Client clicks "Approve & Publish".
//    - Sets client_approval_at, client_approved_by_token_hash, client_approval_note
//    - Sets tenant status to 'pending_deploy' (enters admin deploy queue)
//    - Does NOT lock immediately — admin can lock from their dashboard
// =============================================================================

export interface ApprovalArgs {
  reviewToken: string;
  approvalNote?: string; // optional "anything else?" note from client
}

export interface ApprovalResult {
  approvedAt: string;
  tenantSlug: string;
}

export async function submitClientApproval(
  args: ApprovalArgs,
): Promise<ActionResult<ApprovalResult>> {
  const { reviewToken, approvalNote } = args;

  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message };
  }

  const { session } = sessionResult;

  if (!session.permissions.canApprove) {
    if (session.permissions.isLocked) {
      return {
        success: false,
        error:
          "Your design is already approved and locked. Contact support to make changes.",
      };
    }
    if (session.approvalAt) {
      return {
        success: false,
        error: "You have already approved your design.",
      };
    }
    return { success: false, error: "Approval is not available at this time." };
  }

  const tokenHash = hashReviewToken(reviewToken);
  const now = new Date().toISOString();

  try {
    const supabase = getAdminClient();

    // Update tenant_site_config
    const { error: configErr } = await supabase
      .from("tenant_site_config")
      .update({
        client_approval_at: now,
        client_approved_by_token_hash: tokenHash,
        client_approval_note: approvalNote ?? null,
      })
      .eq("tenant_id", session.tenantId);

    if (configErr) {
      return {
        success: false,
        error: `Failed to record approval: ${configErr.message}`,
      };
    }

    // Advance tenant status to pending_deploy
    const { error: tenantErr } = await supabase
      .from("tenants")
      .update({ status: "pending_deploy" })
      .eq("id", session.tenantId)
      .eq("status", "pending_review"); // Only advance if currently in review; avoid overwriting

    if (tenantErr) {
      // Non-fatal — status update is best-effort; approval is already recorded
      console.error(
        "[client-edit] status update to pending_deploy failed:",
        tenantErr.message,
      );
    }

    // Mark selected variant as approved
    if (session.selectedVariantIndex !== null) {
      await supabase
        .from("tenant_site_variants")
        .update({ status: "selected" })
        .eq("tenant_id", session.tenantId)
        .eq("variant_index", session.selectedVariantIndex);
    }

    // Audit event
    await supabase.from("client_variant_edit_events").insert({
      tenant_id: session.tenantId,
      variant_id: null,
      field_path: "__approval__",
      old_value: null,
      new_value: approvalNote ? approvalNote.slice(0, 500) : "approved",
      edit_type: "text_edit",
      source: "client_approval",
      review_token_hash: tokenHash,
      ai_intent: null,
      created_at: now,
    });

    revalidatePath(`/waas/clients/${session.tenantId}`);
    revalidatePath("/waas/deploy-queue");

    // Phase 6.4: notify admin that client approved (fire-and-forget)
    void import("@/lib/waas/services/notifications")
      .then(({ sendTenantNotification }) => {
        const adminEmail =
          process.env.WAAS_ADMIN_EMAIL ??
          process.env.WAAS_ADMIN_EMAILS?.split(",")[0]?.trim();
        if (adminEmail) {
          void sendTenantNotification({
            type: "approval_received",
            tenantId: session.tenantId,
            recipientEmail: adminEmail,
            data: {
              businessName: session.businessName,
              tenantSlug: session.slug,
              variantIndex: session.selectedVariantIndex ?? undefined,
              variantLabel: session.selectedTemplateSlug ?? undefined,
            },
            dedupKey: `approval_received_${session.tenantId}_${now.slice(0, 10)}`,
          });
        }
      })
      .catch(() => {
        /* never block approval on notification failure */
      });

    return {
      success: true,
      data: {
        approvedAt: now,
        tenantSlug: session.slug,
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unexpected error submitting approval",
    };
  }
}

// =============================================================================
// 6. revokeClientApproval
//    Client un-approves within the 1-hour grace period.
//    Clears approval timestamps; puts tenant back to pending_review.
// =============================================================================

export async function revokeClientApproval(
  reviewToken: string,
): Promise<ActionResult<{ message: string }>> {
  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message };
  }

  const { session } = sessionResult;

  if (!session.permissions.canUnaprove) {
    if (session.permissions.isLocked) {
      return {
        success: false,
        error:
          "Your approval has been locked by the team. Contact support to request changes.",
      };
    }
    if (!session.approvalAt) {
      return { success: false, error: "No active approval to revoke." };
    }
    return {
      success: false,
      error:
        "The grace period for revoking approval has passed. Please contact support.",
    };
  }

  const tokenHash = hashReviewToken(reviewToken);
  const now = new Date().toISOString();

  try {
    const supabase = getAdminClient();

    // Clear approval fields
    const { error: configErr } = await supabase
      .from("tenant_site_config")
      .update({
        client_approval_at: null,
        client_approved_by_token_hash: null,
        client_approval_note: null,
      })
      .eq("tenant_id", session.tenantId);

    if (configErr) {
      return {
        success: false,
        error: `Failed to revoke approval: ${configErr.message}`,
      };
    }

    // Roll tenant status back to pending_review
    await supabase
      .from("tenants")
      .update({ status: "pending_review" })
      .eq("id", session.tenantId)
      .eq("status", "pending_deploy");

    // Audit event
    await supabase.from("client_variant_edit_events").insert({
      tenant_id: session.tenantId,
      variant_id: null,
      field_path: "__approval_revoked__",
      old_value: "approved",
      new_value: "revoked",
      edit_type: "text_edit",
      source: "client_revoke",
      review_token_hash: tokenHash,
      ai_intent: null,
      created_at: now,
    });

    revalidatePath(`/waas/clients/${session.tenantId}`);

    return {
      success: true,
      data: {
        message: "Approval revoked. You can continue editing your design.",
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unexpected error revoking approval",
    };
  }
}
