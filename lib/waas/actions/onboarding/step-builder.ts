"use server";

// =============================================================================
// Step 6: Website Builder — save customer-edited block content
// Stores the blocks array as JSON in tenant_site_config.website_blocks AND
// the rendered HTML in tenant_site_config.website_html.
//
// Required columns (already migrated):
//   ALTER TABLE tenant_site_config ADD COLUMN IF NOT EXISTS website_blocks jsonb;
//   ALTER TABLE tenant_site_config ADD COLUMN IF NOT EXISTS website_html   text;
//
// Both columns are schema-gap safe — missing columns won't block onboarding.
// =============================================================================

import { getRawClient, ActionResult } from "./_shared";
import type { Block } from "@/lib/waas/website-builder/blocks";
import { exportHtml } from "@/lib/waas/website-builder/export-html";

export type { Block as BuilderBlock };

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function saveOnboardingStepBuilder(
  tenantId: string,
  blocks: Block[],
  businessName?: string,
): Promise<ActionResult> {
  try {
    const supabase = getRawClient();
    const html = exportHtml(blocks, businessName ?? "My Page");

    const { error } = await supabase.from("tenant_site_config").upsert(
      {
        tenant_id: tenantId,
        website_blocks: blocks,
        website_html: html,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );

    if (error) {
      const msg = error.message ?? "";
      const isMissingCol =
        /could not find.*column.*website_blocks/i.test(msg) ||
        /could not find.*column.*website_html/i.test(msg);
      if (!isMissingCol) return { success: false, error: msg };
      // Schema gap — columns don't exist yet, continue silently
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
