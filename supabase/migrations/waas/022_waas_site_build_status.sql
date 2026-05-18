-- =============================================================================
-- Migration 022 — Site build status columns on tenant_site_config
-- PR #96 (plan PR #95): generateInitialSiteFromTemplate()
--
-- Adds 4 new columns to track the two-tier generation lifecycle:
--
--   template_browse_history  — JSONB array of slug strings the user opened in
--                              the TemplateLibraryModal before confirming.
--                              Useful for analytics + future "you almost picked…"
--                              personalisation.
--
--   initial_build_completed_at — ISO timestamp set by Tier 1 (deterministic)
--                              once the site variant is persisted in
--                              tenant_site_variants with status='selected'.
--
--   ai_enhancement_completed_at — ISO timestamp set by Tier 2 (Gemini) once
--                              the enhanced copy is written back to the variant.
--
--   ai_enhancement_status    — text enum tracking Tier 2 progress.
--                              Values: 'in_progress' | 'completed' | 'failed' | NULL
--                              NULL means Tier 2 has not started yet.
--
-- All columns are nullable so existing rows are unaffected.
-- Each ALTER TABLE uses IF NOT EXISTS to be idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. template_browse_history
--    JSONB array of template slugs the client browsed before confirming.
--    Default: empty array.
-- ---------------------------------------------------------------------------
ALTER TABLE tenant_site_config
  ADD COLUMN IF NOT EXISTS template_browse_history JSONB NOT NULL DEFAULT '[]'::JSONB;

COMMENT ON COLUMN tenant_site_config.template_browse_history IS
  'Ordered list of template slugs the client browsed during template selection. '
  'Used for analytics and personalisation. Populated by the onboarding frontend.';

-- ---------------------------------------------------------------------------
-- 2. initial_build_completed_at
--    Timestamp set when Tier 1 (deterministic) variant generation completes.
-- ---------------------------------------------------------------------------
ALTER TABLE tenant_site_config
  ADD COLUMN IF NOT EXISTS initial_build_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN tenant_site_config.initial_build_completed_at IS
  'Set when the Tier 1 deterministic site variant is persisted to '
  'tenant_site_variants. NULL means the build has not run yet.';

-- ---------------------------------------------------------------------------
-- 3. ai_enhancement_completed_at
--    Timestamp set when Tier 2 (Gemini AI) enhancement completes.
-- ---------------------------------------------------------------------------
ALTER TABLE tenant_site_config
  ADD COLUMN IF NOT EXISTS ai_enhancement_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN tenant_site_config.ai_enhancement_completed_at IS
  'Set when the Tier 2 Gemini enhancement rewrites the variant copy. '
  'NULL means AI enhancement has not run or was skipped.';

-- ---------------------------------------------------------------------------
-- 4. ai_enhancement_status
--    Tracks Tier 2 state machine.
--    Values: 'in_progress' | 'completed' | 'failed' | NULL (not started)
-- ---------------------------------------------------------------------------
ALTER TABLE tenant_site_config
  ADD COLUMN IF NOT EXISTS ai_enhancement_status TEXT;

COMMENT ON COLUMN tenant_site_config.ai_enhancement_status IS
  'Tier 2 Gemini enhancement lifecycle: NULL (not started), '
  '''in_progress'', ''completed'', or ''failed''.';

-- Constrain to known values (non-blocking on existing rows)
ALTER TABLE tenant_site_config
  DROP CONSTRAINT IF EXISTS chk_ai_enhancement_status;

ALTER TABLE tenant_site_config
  ADD CONSTRAINT chk_ai_enhancement_status
  CHECK (
    ai_enhancement_status IS NULL OR
    ai_enhancement_status IN ('in_progress', 'completed', 'failed')
  );

-- ---------------------------------------------------------------------------
-- Index: fast lookup of tenants where AI enhancement is still pending
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tenant_site_config_ai_status
  ON tenant_site_config (ai_enhancement_status)
  WHERE ai_enhancement_status IN ('in_progress', 'failed');

-- ---------------------------------------------------------------------------
-- Index: fast lookup of tenants where initial build is complete but AI
-- enhancement has not yet run (useful for background retry jobs)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tenant_site_config_build_pending_ai
  ON tenant_site_config (initial_build_completed_at)
  WHERE initial_build_completed_at IS NOT NULL
    AND ai_enhancement_completed_at IS NULL;
