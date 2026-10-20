-- =============================================================================
-- 029_waas_client_edit_tables
--
-- Creates, in the rankedceo-waas project, the seven WaaS tables that the code
-- already calls but that do not exist there (live audit, 2026-10-19):
--   tenant_site_versions, tenant_site_variants, tenant_site_deployments,
--   client_uploaded_assets, client_domain_change_requests, notification_log,
--   tenant_variant_regenerations.
-- Six were only ever created in the CRM project; the seventh (migration 026)
-- exists in neither project. Without them the client editor (/edit/[reviewToken])
-- loads with no sections and a save returns "Variant not found."
--
-- Also adds, if missing, the tenant_site_config columns the editor reads. The
-- live column list of rankedceo-waas.tenant_site_config was NOT audited, so
-- every column is ADD COLUMN IF NOT EXISTS (a no-op where it already exists).
--
-- Safe properties:
--   - Additive only. No DROP, no data changes, no existing object is altered
--     except tenant_site_config (new nullable/defaulted columns only).
--   - Idempotent. Safe to run twice.
--   - Every new table has RLS enabled. tenant_site_variants and
--     tenant_variant_regenerations are service-role only; the rest keep the
--     policies they have in the CRM project.
--   - Does NOT touch handle_new_user() or any auth trigger.
--
-- Order matters: tenants (already live) -> versions -> deployments (FK to versions).
-- Run in the SQL editor of rankedceo-waas ONLY (ref klgvdvryewykzlumbkei).
-- Rollback is at the bottom of this file.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Guard: refuse to run where `tenants` is missing (wrong project).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL
     OR to_regclass('public.tenant_site_config') IS NULL THEN
    RAISE EXCEPTION
      '029: public.tenants / public.tenant_site_config not found. Wrong project? Run this in rankedceo-waas only.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. tenant_site_config: client-edit columns (no-op where already present)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenant_site_config
  ADD COLUMN IF NOT EXISTS client_review_token              TEXT        NULL,
  ADD COLUMN IF NOT EXISTS client_selected_template_slug    TEXT        NULL,
  ADD COLUMN IF NOT EXISTS client_selected_at               TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS client_edit_session_started_at   TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS client_approval_at               TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS client_approved_by_token_hash    TEXT        NULL,
  ADD COLUMN IF NOT EXISTS client_approval_note             TEXT        NULL,
  ADD COLUMN IF NOT EXISTS client_approval_locked           BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS client_feedback_tone             TEXT        NULL,
  ADD COLUMN IF NOT EXISTS client_feedback_cta_intensity    TEXT        NULL,
  ADD COLUMN IF NOT EXISTS client_feedback_layout_preference TEXT       NULL,
  ADD COLUMN IF NOT EXISTS client_feedback_notes            TEXT        NULL,
  ADD COLUMN IF NOT EXISTS client_feedback_submitted_at     TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS client_mix_source_templates      JSONB       NULL,
  ADD COLUMN IF NOT EXISTS client_mix_submitted_at          TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS client_regen_count               INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_regen_quota               INTEGER     NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS initial_build_completed_at       TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS ai_enhancement_status            TEXT        NULL;

-- The editor looks a session up by token with .single(), so the token must be
-- unique. Create the unique index only if no unique index already covers the
-- column (the original migration may have created one), to avoid a duplicate.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
    WHERE i.indrelid = 'public.tenant_site_config'::regclass
      AND i.indisunique
      AND i.indnatts = 1
      AND a.attname = 'client_review_token'
  ) THEN
    CREATE UNIQUE INDEX idx_tenant_site_config_client_review_token
      ON public.tenant_site_config (client_review_token)
      WHERE client_review_token IS NOT NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. tenant_site_versions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_site_versions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  change_source TEXT        NOT NULL,
  summary       TEXT        NULL,
  template_slug TEXT        NULL,
  snapshot_json JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_site_versions_tenant_created
  ON public.tenant_site_versions (tenant_id, created_at DESC);

ALTER TABLE public.tenant_site_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_site_versions_admin_all" ON public.tenant_site_versions;
CREATE POLICY "tenant_site_versions_admin_all"
  ON public.tenant_site_versions FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

-- ---------------------------------------------------------------------------
-- 3. tenant_site_deployments (FK to tenant_site_versions, so it comes after)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_site_deployments (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  deployed_by             TEXT        NOT NULL DEFAULT 'admin_console',
  source_version_id       UUID        NULL REFERENCES public.tenant_site_versions(id) ON DELETE SET NULL,
  deployment_payload_json JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_site_deployments_tenant_created
  ON public.tenant_site_deployments (tenant_id, created_at DESC);

ALTER TABLE public.tenant_site_deployments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_site_deployments_admin_all" ON public.tenant_site_deployments;
CREATE POLICY "tenant_site_deployments_admin_all"
  ON public.tenant_site_deployments FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

-- ---------------------------------------------------------------------------
-- 4. tenant_site_variants (includes the client-edit columns from migration 016)
--    Migration 015 never enabled RLS on this table. Here it is enabled with a
--    service-role-only policy, matching the live CRM-project posture
--    (deny-all for everyone else).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_site_variants (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  variant_index          INTEGER     NOT NULL CHECK (variant_index BETWEEN 1 AND 3),
  variant_label          TEXT        NOT NULL,
  variant_rationale      TEXT        NULL,
  template_slug          TEXT        NOT NULL,
  sections_json          JSONB       NOT NULL DEFAULT '[]'::jsonb,
  generation_notes       TEXT        NULL,
  status                 TEXT        NOT NULL DEFAULT 'generated'
                         CHECK (status IN ('generated', 'sent_to_review', 'selected')),
  generated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_last_edited_at  TIMESTAMPTZ NULL,
  client_edit_count      INTEGER     NOT NULL DEFAULT 0,
  approved_sections_json JSONB       NULL,
  UNIQUE (tenant_id, variant_index)
);

CREATE INDEX IF NOT EXISTS idx_tenant_site_variants_tenant_id
  ON public.tenant_site_variants (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_site_variants_status
  ON public.tenant_site_variants (status);

ALTER TABLE public.tenant_site_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_site_variants_service_role_all" ON public.tenant_site_variants;
CREATE POLICY "tenant_site_variants_service_role_all"
  ON public.tenant_site_variants FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. client_uploaded_assets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_uploaded_assets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  storage_path      TEXT        NOT NULL,
  cdn_url           TEXT        NOT NULL,
  original_filename TEXT        NULL,
  mime_type         TEXT        NULL,
  file_size_bytes   INTEGER     NULL,
  variant_index     INTEGER     NULL CHECK (variant_index BETWEEN 1 AND 3),
  asset_slot        TEXT        NULL,
  review_token_hash TEXT        NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_uploaded_assets_tenant
  ON public.client_uploaded_assets (tenant_id, created_at DESC);

ALTER TABLE public.client_uploaded_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_uploaded_assets_admin_all" ON public.client_uploaded_assets;
CREATE POLICY "client_uploaded_assets_admin_all"
  ON public.client_uploaded_assets FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

-- ---------------------------------------------------------------------------
-- 6. client_domain_change_requests (+ its updated_at trigger, as in migration 017)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_domain_change_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  review_token_hash TEXT        NOT NULL,
  requested_domain  TEXT        NOT NULL,
  request_note      TEXT        NULL,
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'acknowledged', 'actioned', 'rejected')),
  admin_response    TEXT        NULL,
  actioned_by       TEXT        NULL,
  actioned_at       TIMESTAMPTZ NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_domain_change_requests_tenant_id
  ON public.client_domain_change_requests (tenant_id);

CREATE INDEX IF NOT EXISTS idx_client_domain_change_requests_status
  ON public.client_domain_change_requests (status)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.update_client_domain_change_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_domain_change_requests_updated_at
  ON public.client_domain_change_requests;

CREATE TRIGGER trg_client_domain_change_requests_updated_at
  BEFORE UPDATE ON public.client_domain_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_client_domain_change_requests_updated_at();

ALTER TABLE public.client_domain_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_cdcr" ON public.client_domain_change_requests;
CREATE POLICY "service_role_full_access_cdcr"
  ON public.client_domain_change_requests FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 7. notification_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NULL REFERENCES public.tenants(id) ON DELETE SET NULL,
  recipient_email     TEXT        NOT NULL,
  notification_type   TEXT        NOT NULL,
  subject             TEXT        NOT NULL,
  template_data       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status              TEXT        NOT NULL DEFAULT 'sent'
                      CHECK (status IN ('sent', 'failed', 'skipped')),
  provider            TEXT        NULL,
  provider_message_id TEXT        NULL,
  error_message       TEXT        NULL,
  dedup_key           TEXT        NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_tenant_id
  ON public.notification_log (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_log_type_created
  ON public.notification_log (notification_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_log_dedup_key
  ON public.notification_log (dedup_key)
  WHERE dedup_key IS NOT NULL;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_notification_log" ON public.notification_log;
CREATE POLICY "service_role_full_access_notification_log"
  ON public.notification_log FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 8. tenant_variant_regenerations (migration 026; exists in neither project)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_variant_regenerations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  generation_index INTEGER     NOT NULL CHECK (generation_index >= 0),
  template_slug    TEXT        NOT NULL,
  sections_json    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  client_note      TEXT        NULL,
  is_selected      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, generation_index)
);

CREATE INDEX IF NOT EXISTS idx_tenant_variant_regenerations_tenant_id
  ON public.tenant_variant_regenerations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_variant_regenerations_selected
  ON public.tenant_variant_regenerations (tenant_id, is_selected)
  WHERE is_selected = TRUE;

ALTER TABLE public.tenant_variant_regenerations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_variant_regenerations_service_role_all" ON public.tenant_variant_regenerations;
CREATE POLICY "tenant_variant_regenerations_service_role_all"
  ON public.tenant_variant_regenerations FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- ROLLBACK (run only if needed; the seven tables are new and empty on day one).
-- Reverse order of creation. The tenant_site_config columns are left in place on
-- purpose: dropping them could destroy data the app has since written.
--
--   DROP TABLE IF EXISTS public.tenant_variant_regenerations;
--   DROP TABLE IF EXISTS public.notification_log;
--   DROP TABLE IF EXISTS public.client_domain_change_requests;
--   DROP FUNCTION IF EXISTS public.update_client_domain_change_requests_updated_at();
--   DROP TABLE IF EXISTS public.client_uploaded_assets;
--   DROP TABLE IF EXISTS public.tenant_site_variants;
--   DROP TABLE IF EXISTS public.tenant_site_deployments;
--   DROP TABLE IF EXISTS public.tenant_site_versions;
-- =============================================================================
