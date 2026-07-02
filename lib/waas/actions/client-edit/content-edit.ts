"use server";

import { revalidatePath } from "next/cache";
import {
  resolveClientEditSession,
  canClientEditVariant,
  hashReviewToken,
  type ClientEditSession,
} from "@/lib/waas/client-edit/edit-session";
import {
  validateEditPath,
  getValueAtPath,
  setValueAtPath,
  serializeForHistory,
  type JsonValue,
} from "@/lib/waas/client-edit/content-paths";
import { getAdminClient, classifyEditType } from "./_shared";
import type { ActionResult, EditType } from "./_shared";

// =============================================================================
// 1. getClientEditSession
//    Returns the full session object so the editor page can render correctly.
// =============================================================================

export async function getClientEditSession(
  reviewToken: string,
): Promise<ActionResult<ClientEditSession>> {
  const result = await resolveClientEditSession(reviewToken);

  if (!result.ok) {
    return { success: false, error: result.message };
  }

  return { success: true, data: result.session };
}

// =============================================================================
// 2. updateClientVariantContent
//    JSONPath-based patch of sections_json in tenant_site_variants.
//    Writes an audit event to client_variant_edit_events.
//    Returns the new sections array on success.
//
//    IMPORTANT: sections_json is stored as a top-level array — but our path
//    convention reads naturally as "sections[N].content.headline". We wrap
//    the array in { sections: [...] } for pathing, then unwrap before save.
// =============================================================================

export interface UpdateContentArgs {
  reviewToken: string;
  variantIndex: number;
  path: string; // e.g. "sections[0].content.headline"
  newValue: JsonValue;
  aiIntent?: string; // set if the edit was AI-assisted
}

export async function updateClientVariantContent(
  args: UpdateContentArgs,
): Promise<ActionResult<{ sections: JsonValue }>> {
  const { reviewToken, variantIndex, path, newValue, aiIntent } = args;

  // --- Permission gate ---
  const perm = await canClientEditVariant(reviewToken);
  if (!perm.allowed) {
    return { success: false, error: perm.reason };
  }

  // --- Validate path ---
  const pathCheck = validateEditPath(path);
  if (!pathCheck.valid) {
    return { success: false, error: pathCheck.reason };
  }

  // --- Validate value is not undefined ---
  if (newValue === undefined) {
    return { success: false, error: "newValue must not be undefined" };
  }

  // --- Resolve session for tenant context ---
  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message };
  }
  const { tenantId } = sessionResult.session;
  const tokenHash = hashReviewToken(reviewToken);

  try {
    const supabase = getAdminClient();

    // Fetch current variant sections_json
    const { data: variantRow, error: fetchErr } = await supabase
      .from("tenant_site_variants")
      .select("id, sections_json, client_edit_count")
      .eq("tenant_id", tenantId)
      .eq("variant_index", variantIndex)
      .single();

    if (fetchErr || !variantRow) {
      return { success: false, error: "Variant not found." };
    }

    const variant = variantRow as {
      id: string;
      sections_json: JsonValue;
      client_edit_count: number | null;
    };

    // Wrap the array in { sections: [...] } so path semantics read naturally
    const wrapped = {
      sections: Array.isArray(variant.sections_json)
        ? variant.sections_json
        : [],
    };

    const oldValue = getValueAtPath(wrapped as JsonValue, path);
    const patchResult = setValueAtPath(wrapped as JsonValue, path, newValue);

    if (!patchResult.ok) {
      return { success: false, error: patchResult.error };
    }

    const patchedWrapped = patchResult.result as { sections: JsonValue[] };
    const newSections = patchedWrapped.sections;
    const editType = classifyEditType(path);
    const now = new Date().toISOString();

    // Write patched sections back to variant
    const { error: updateErr } = await supabase
      .from("tenant_site_variants")
      .update({
        sections_json: newSections,
        client_last_edited_at: now,
        client_edit_count: (variant.client_edit_count ?? 0) + 1,
      })
      .eq("id", variant.id);

    if (updateErr) {
      return {
        success: false,
        error: `Failed to save edit: ${updateErr.message}`,
      };
    }

    // Write audit event
    const { error: auditErr } = await supabase
      .from("client_variant_edit_events")
      .insert({
        tenant_id: tenantId,
        variant_id: variant.id,
        field_path: path,
        old_value: serializeForHistory(oldValue),
        new_value: serializeForHistory(newValue),
        edit_type: editType,
        source: aiIntent ? "ai_assisted" : "client",
        review_token_hash: tokenHash,
        ai_intent: aiIntent ?? null,
        created_at: now,
      });

    if (auditErr) {
      // Non-fatal — the edit was saved; log but don't fail
      console.error("[client-edit] audit insert failed:", auditErr.message);
    }

    // Revalidate admin review path so changes are visible immediately
    revalidatePath(`/waas/clients/${tenantId}`);

    return { success: true, data: { sections: newSections } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Unexpected error saving edit",
    };
  }
}

// =============================================================================
// 3. uploadClientAsset
//    Registers a client-uploaded asset (image/logo/etc.) after it has been
//    stored in Supabase Storage.  The caller is responsible for the actual
//    upload to the bucket; this action just records the metadata row.
// =============================================================================

export interface UploadAssetArgs {
  reviewToken: string;
  variantIndex: number;
  storagePath: string; // path inside the Supabase Storage bucket
  cdnUrl: string; // public CDN URL for the asset
  assetSlot: string; // logical slot name, e.g. "hero_image" or "logo"
  mimeType?: string;
  fileSizeBytes?: number;
}

export async function uploadClientAsset(
  args: UploadAssetArgs,
): Promise<ActionResult<{ assetId: string; cdnUrl: string }>> {
  const {
    reviewToken,
    variantIndex,
    storagePath,
    cdnUrl,
    assetSlot,
    mimeType,
    fileSizeBytes,
  } = args;

  const perm = await canClientEditVariant(reviewToken);
  if (!perm.allowed) {
    return { success: false, error: perm.reason };
  }

  const sessionResult = await resolveClientEditSession(reviewToken);
  if (!sessionResult.ok) {
    return { success: false, error: sessionResult.message };
  }
  const { tenantId } = sessionResult.session;
  const tokenHash = hashReviewToken(reviewToken);

  try {
    const supabase = getAdminClient();

    const { data: assetRow, error: insertErr } = await supabase
      .from("client_uploaded_assets")
      .insert({
        tenant_id: tenantId,
        storage_path: storagePath,
        cdn_url: cdnUrl,
        variant_index: variantIndex,
        asset_slot: assetSlot,
        mime_type: mimeType ?? null,
        file_size_bytes: fileSizeBytes ?? null,
        review_token_hash: tokenHash,
        created_at: new Date().toISOString(),
      })
      .select("id, cdn_url")
      .single();

    if (insertErr || !assetRow) {
      return {
        success: false,
        error: `Failed to register asset: ${insertErr?.message ?? "unknown"}`,
      };
    }

    const row = assetRow as { id: string; cdn_url: string };
    return { success: true, data: { assetId: row.id, cdnUrl: row.cdn_url } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unexpected error registering asset",
    };
  }
}
