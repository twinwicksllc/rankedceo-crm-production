import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ActionResult<T = null> {
  success: boolean;
  data?: T;
  error?: string;
}

export type EditType =
  | "text_edit"
  | "image_swap"
  | "color_change"
  | "ai_rewrite"
  | "section_toggle"
  | "font_change"
  | "config_change"; // Phase 8.6 — sections[N].config.<key> edits

// ---------------------------------------------------------------------------
// Internal: service-role admin client (same pattern as admin.ts)
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL;
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("WaaS Supabase admin env vars not set");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Internal: classify which EditType a path maps to
// ---------------------------------------------------------------------------

function classifyEditType(path: string): EditType {
  if (/\.enabled$/.test(path)) return "section_toggle";
  if (/image_url$|logo_url$/.test(path)) return "image_swap";
  if (/color$/.test(path)) return "color_change";
  if (/\.config\.[a-zA-Z0-9_]+$/.test(path)) return "config_change";
  return "text_edit";
}

export { getAdminClient, classifyEditType };
