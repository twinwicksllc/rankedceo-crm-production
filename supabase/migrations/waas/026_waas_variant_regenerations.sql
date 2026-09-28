-- =============================================================================
-- WaaS: Migration 026 — Client-facing variant regeneration history (Initiative 12)
--
-- Problem: regenerateSelectedVariantByReviewToken() (client-review.ts) has
-- always overwritten tenant_site_config.active_sections_json in place. Each
-- regeneration replaced the last, so the client could never compare their
-- current direction against what it looked like before they asked for a
-- change — the roadmap gap (docs/waas/AUDIT_TO_WEBSITE_FLOW_RECOMMENDATIONS.md,
-- Initiative 12) is "no client-facing way to regenerate a variant with a
-- different tone" *and be able to see the result next to the original*.
--
-- Fix: persist every regeneration as its own row ("generation") instead of
-- discarding the prior state, capped at a quota (default 3 regens beyond the
-- initial selection = up to 4 comparable generations total), and capture a
-- free-text client note per regeneration so admins know what still needs
-- fixing (colors, fonts, etc.) without a support round-trip.
--
-- Run AFTER 025_waas_lead_optimization_request.sql
-- Safe to re-run (idempotent via IF NOT EXISTS).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Regeneration quota tracking on tenant_site_config
-- ---------------------------------------------------------------------------

ALTER TABLE tenant_site_config
  ADD COLUMN IF NOT EXISTS client_regen_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_regen_quota INTEGER NOT NULL DEFAULT 3;

COMMENT ON COLUMN tenant_site_config.client_regen_count IS
  'Number of client-initiated regenerations used so far (0..client_regen_quota). '
  'Does not include the initial A/B/C selection — only Initiative 12 regen requests.';

COMMENT ON COLUMN tenant_site_config.client_regen_quota IS
  'Max client-initiated regenerations allowed. Defaults to 3 (giving up to 4 '
  'total comparable generations: the initial selection + 3 regens). Per-tenant '
  'override column in case a future package tier needs a different cap.';

-- ---------------------------------------------------------------------------
-- 2. tenant_variant_regenerations — one row per comparable generation
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tenant_variant_regenerations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- 0 = the initial selection snapshot (captured automatically on first
  -- regen request so there is always something to compare against);
  -- 1..client_regen_quota = client-requested regenerations, in order.
  generation_index INTEGER NOT NULL CHECK (generation_index >= 0),
  template_slug TEXT NOT NULL,
  sections_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- What the client asked this attempt to fix/change. NULL for
  -- generation_index = 0 (there was no request yet, it's just the baseline).
  client_note TEXT NULL,
  -- Which generation the client has most recently marked as their pick.
  -- Exactly one row per tenant should have is_selected = TRUE at a time,
  -- enforced in application code (partial unique index would be stricter
  -- than needed here since re-selection is a normal, frequent action).
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, generation_index)
);

CREATE INDEX IF NOT EXISTS idx_tenant_variant_regenerations_tenant_id
  ON tenant_variant_regenerations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_variant_regenerations_selected
  ON tenant_variant_regenerations (tenant_id, is_selected)
  WHERE is_selected = TRUE;

COMMENT ON TABLE tenant_variant_regenerations IS
  'Initiative 12: comparable snapshots of a tenant''s site direction across '
  'client-requested regenerations, so the client can view initial + each '
  'regen side by side instead of each regen silently overwriting the last.';

-- ---------------------------------------------------------------------------
-- 3. RLS — service-role only, same posture as tenant_site_variants /
--    tenant_site_config. All access goes through server actions using the
--    admin (service-role) Supabase client; no anon/public policy is added.
-- ---------------------------------------------------------------------------

ALTER TABLE tenant_variant_regenerations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_variant_regenerations_service_role_all" ON tenant_variant_regenerations;
CREATE POLICY "tenant_variant_regenerations_service_role_all"
  ON tenant_variant_regenerations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- END OF MIGRATION 026
-- =============================================================================
