"use server";

import { revalidatePath } from "next/cache";
import {
  resolveClientEditSession,
  canClientEditVariant,
  hashReviewToken,
} from "@/lib/waas/client-edit/edit-session";
import {
  validateEditPath,
  getValueAtPath,
  setValueAtPath,
  serializeForHistory,
  type JsonValue,
} from "@/lib/waas/client-edit/content-paths";
import { getAdminClient } from "./_shared";
import type { ActionResult, EditType } from "./_shared";
import { updateClientVariantContent } from "./content-edit";

// =============================================================================
// 7. getClientEditHistory
//    Returns the audit trail of edits for a given variant (admin or self-view).
//    Token-scoped — only returns events for the given review token.
// =============================================================================

export interface EditHistoryEvent {
  id: string;
  fieldPath: string;
  oldValue: string | null;
  newValue: string | null;
  editType: EditType;
  source: string;
  aiIntent: string | null;
  createdAt: string;
  variantIndex: number;
}

export async function getClientEditHistory(
  reviewToken: string,
  variantIndex?: number,
  limit = 50,
): Promise<ActionResult<EditHistoryEvent[]>> {
  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message };
  }

  const { tenantId } = sessionResult.session;
  const tokenHash = hashReviewToken(reviewToken);

  try {
    const supabase = getAdminClient();

    let query = supabase
      .from("client_variant_edit_events")
      .select(
        "id, field_path, old_value, new_value, edit_type, source, ai_intent, created_at, variant_index",
      )
      .eq("tenant_id", tenantId)
      .eq("review_token_hash", tokenHash)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Filter by variant_index when supplied — column exists in migration 016
    if (
      Number.isInteger(variantIndex) &&
      variantIndex! >= 1 &&
      variantIndex! <= 3
    ) {
      query = query.eq("variant_index", variantIndex!);
    }

    const { data: rows, error: fetchErr } = await query;

    if (fetchErr) {
      return {
        success: false,
        error: `Failed to load history: ${fetchErr.message}`,
      };
    }

    const events: EditHistoryEvent[] = (rows ?? []).map((row) => {
      const r = row as {
        id: string;
        field_path: string;
        old_value: string | null;
        new_value: string | null;
        edit_type: EditType;
        source: string;
        ai_intent: string | null;
        created_at: string;
        variant_index: number;
      };
      return {
        id: r.id,
        fieldPath: r.field_path,
        oldValue: r.old_value,
        newValue: r.new_value,
        editType: r.edit_type,
        source: r.source,
        aiIntent: r.ai_intent,
        createdAt: r.created_at,
        variantIndex: r.variant_index,
      };
    });

    return { success: true, data: events };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unexpected error loading edit history",
    };
  }
}

// =============================================================================
// 8. updateClientBrandConfig
//    Convenience wrapper that patches brand_config fields on the tenant row.
//    Validates path against the brand_config allowlist before writing.
// =============================================================================

export interface UpdateBrandConfigArgs {
  reviewToken: string;
  field: string; // e.g. "business_name", "tagline", "colors.primary"
  newValue: string;
}

export async function updateClientBrandConfig(
  args: UpdateBrandConfigArgs,
): Promise<ActionResult<{ brandConfig: Record<string, unknown> }>> {
  const { reviewToken, field, newValue } = args;

  const perm = await canClientEditVariant(reviewToken);
  if (!perm.allowed) {
    return { success: false, error: perm.reason };
  }

  const fullPath = `brand_config.${field}`;
  const pathCheck = validateEditPath(fullPath);
  if (!pathCheck.valid) {
    return { success: false, error: pathCheck.reason };
  }

  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message };
  }

  const { tenantId, brandConfig } = sessionResult.session;
  const tokenHash = hashReviewToken(reviewToken);

  try {
    const supabase = getAdminClient();

    // Use the JSONPath patcher to support nested fields like "colors.primary"
    // Wrap brandConfig under a synthetic root so paths read "brand_config.*"
    const wrapped = { brand_config: brandConfig };
    const oldValue = getValueAtPath(wrapped as JsonValue, fullPath);
    const patchResult = setValueAtPath(
      wrapped as JsonValue,
      fullPath,
      newValue,
    );

    if (!patchResult.ok) {
      return { success: false, error: patchResult.error };
    }

    const patchedWrapped = patchResult.result as {
      brand_config: Record<string, unknown>;
    };
    const updatedConfig = patchedWrapped.brand_config;

    const { error: updateErr } = await supabase
      .from("tenants")
      .update({ brand_config: updatedConfig })
      .eq("id", tenantId);

    if (updateErr) {
      return {
        success: false,
        error: `Failed to update brand config: ${updateErr.message}`,
      };
    }

    // Audit
    const now = new Date().toISOString();
    await supabase.from("client_variant_edit_events").insert({
      tenant_id: tenantId,
      variant_id: null,
      field_path: fullPath,
      old_value: serializeForHistory(oldValue as JsonValue),
      new_value: serializeForHistory(newValue as JsonValue),
      edit_type: fullPath.includes("color")
        ? "color_change"
        : fullPath.includes("fonts")
          ? "font_change"
          : "text_edit",
      source: "client",
      review_token_hash: tokenHash,
      ai_intent: null,
      created_at: now,
    });

    revalidatePath(`/waas/clients/${tenantId}`);

    return { success: true, data: { brandConfig: updatedConfig } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unexpected error updating brand config",
    };
  }
}

// =============================================================================
// 10. undoClientEdit
//     Reverts a single edit event by re-applying the event's old_value to the
//     field path.  Uses the same updateClientVariantContent path so all
//     validation, allowlist checks, and audit-trail writes are consistent.
//     A new audit event is written with source='client_editor' and a note in
//     ai_intent: 'undo:<eventId>' so the history panel can show it correctly.
// =============================================================================

export interface UndoClientEditArgs {
  reviewToken: string;
  eventId: string; // UUID of the client_variant_edit_events row to undo
}

export async function undoClientEdit(
  args: UndoClientEditArgs,
): Promise<ActionResult<void>> {
  const { reviewToken, eventId } = args;

  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message };
  }
  if (sessionResult.session.permissions.isLocked) {
    return {
      success: false,
      error: "Editing is locked — your design has been approved.",
    };
  }

  const { tenantId } = sessionResult.session;
  const tokenHash = hashReviewToken(reviewToken);

  try {
    const supabase = getAdminClient();

    // Fetch the event — verify it belongs to this tenant + token
    const { data: eventRow, error: fetchErr } = await supabase
      .from("client_variant_edit_events")
      .select(
        "id, field_path, old_value, new_value, edit_type, variant_index, tenant_id, review_token_hash",
      )
      .eq("id", eventId)
      .single();

    if (fetchErr || !eventRow) {
      return { success: false, error: "Edit event not found." };
    }

    const ev = eventRow as {
      id: string;
      field_path: string;
      old_value: string | null;
      new_value: string | null;
      edit_type: string;
      variant_index: number;
      tenant_id: string;
      review_token_hash: string;
    };

    // Security: must belong to this tenant and this review token
    if (ev.tenant_id !== tenantId || ev.review_token_hash !== tokenHash) {
      return { success: false, error: "Edit event not found." };
    }

    // Cannot undo if there is no previous value to restore
    if (ev.old_value === null && ev.edit_type !== "section_toggle") {
      return {
        success: false,
        error: "This edit has no previous value to restore.",
      };
    }

    // Reconstruct the old value in the right type
    let restoreValue: string | boolean | null;
    if (ev.edit_type === "section_toggle") {
      // old_value is stored as 'true' / 'false' string
      restoreValue = ev.old_value === "true";
    } else {
      restoreValue = ev.old_value;
    }

    // Re-apply via updateClientVariantContent — this writes its own audit event
    const result = await updateClientVariantContent({
      reviewToken,
      path: ev.field_path,
      newValue: restoreValue as string,
      variantIndex: ev.variant_index,
      aiIntent: `undo:${ev.id}`,
    });

    if (!result.success) return { success: false, error: result.error };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Undo failed",
    };
  }
}
