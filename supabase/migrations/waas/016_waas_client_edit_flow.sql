-- =============================================================================
-- WaaS Phase 5: Migration 016 - Client Self-Service Edit Flow
-- Adds columns and tables required for the client editor route
-- (/edit/[reviewToken]) and the post-approval deploy queue.
--
-- Run AFTER 015_waas_site_variants.sql
-- Safe to re-run (all statements are idempotent via IF NOT EXISTS / IF EXISTS)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend waas_tenant_status enum with new lifecycle states
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TYPE waas_tenant_status ADD VALUE IF NOT EXISTS 'pending_deploy'
    AFTER 'pending_review';
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others          THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE waas_tenant_status ADD VALUE IF NOT EXISTS 'deploying'
    AFTER 'pending_deploy';
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others          THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Add client-editor audit columns to tenant_site_config
-- ---------------------------------------------------------------------------

ALTER TABLE tenant_site_config
  -- When the client first opened /edit/[token]
  ADD COLUMN IF NOT EXISTS client_edit_session_started_at  TIMESTAMPTZ NULL,
  -- When the client clicked "Approve & Publish"
  ADD COLUMN IF NOT EXISTS client_approval_at              TIMESTAMPTZ NULL,
  -- SHA-256 hash of the review token used for approval (non-reversible audit log)
  ADD COLUMN IF NOT EXISTS client_approved_by_token_hash   TEXT        NULL,
  -- Free-text note captured at approval (optional "anything else?" prompt)
  ADD COLUMN IF NOT EXISTS client_approval_note            TEXT        NULL,
  -- Whether the client approval is locked (admin can unlock for re-edit)
  ADD COLUMN IF NOT EXISTS client_approval_locked          BOOLEAN     NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tenant_site_config_client_approval_at
  ON tenant_site_config(client_approval_at)
  WHERE client_approval_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_site_config_pending_deploy
  ON tenant_site_config(client_approval_at, client_approval_locked)
  WHERE client_approval_at IS NOT NULL AND client_approval_locked = TRUE;

-- ---------------------------------------------------------------------------
-- 3. Extend tenant_site_variants with client-edit support columns
-- ---------------------------------------------------------------------------

ALTER TABLE tenant_site_variants
  -- When was the last client-initiated edit to this variant
  ADD COLUMN IF NOT EXISTS client_last_edited_at   TIMESTAMPTZ NULL,
  -- How many times has the client edited this variant
  ADD COLUMN IF NOT EXISTS client_edit_count        INTEGER     NOT NULL DEFAULT 0,
  -- Snapshot of sections_json at point of client approval
  ADD COLUMN IF NOT EXISTS approved_sections_json   JSONB       NULL;

-- Allow 'client_editing' and 'client_approved' in variant status
-- We do this via a new table rather than altering the CHECK constraint
-- (altering CHECK on existing tables with data requires DROP + recreate in PG)

-- ---------------------------------------------------------------------------
-- 4. Client variant edit events log
-- Fine-grained per-field audit trail for client edits.
-- Separate from tenant_site_versions (which snapshots entire variant JSON).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS client_variant_edit_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variant_index     INTEGER     NOT NULL CHECK (variant_index BETWEEN 1 AND 3),
  -- JSONPath to the field that was edited (e.g. "sections[0].content.headline")
  field_path        TEXT        NOT NULL,
  -- Value before the edit (truncated to 2000 chars for storage efficiency)
  old_value         TEXT        NULL,
  -- Value after the edit
  new_value         TEXT        NULL,
  -- Type of edit operation
  edit_type         TEXT        NOT NULL DEFAULT 'text_edit'
                    CHECK (edit_type IN (
                      'text_edit',
                      'image_swap',
                      'color_change',
                      'ai_rewrite',
                      'section_toggle'
                    )),
  -- Source of the edit
  source            TEXT        NOT NULL DEFAULT 'client_editor'
                    CHECK (source IN (
                      'client_editor',
                      'ai_assist',
                      'admin_override'
                    )),
  -- Hashed review token for the client session (non-reversible)
  review_token_hash TEXT        NULL,
  -- Optional: which AI intent was used (for ai_rewrite type)
  ai_intent         TEXT        NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_variant_edit_events_tenant
  ON client_variant_edit_events(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_variant_edit_events_variant
  ON client_variant_edit_events(tenant_id, variant_index, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Client asset uploads table
-- Tracks images uploaded by clients during the edit session.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS client_uploaded_assets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Storage path within the WaaS Supabase bucket
  storage_path      TEXT        NOT NULL,
  -- Public CDN URL
  cdn_url           TEXT        NOT NULL,
  -- Original filename (sanitized)
  original_filename TEXT        NULL,
  -- MIME type
  mime_type         TEXT        NULL,
  -- File size in bytes
  file_size_bytes   INTEGER     NULL,
  -- Which variant + section slot this is assigned to (nullable until assigned)
  variant_index     INTEGER     NULL CHECK (variant_index BETWEEN 1 AND 3),
  asset_slot        TEXT        NULL,
  -- Hashed review token of the uploading client session
  review_token_hash TEXT        NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_uploaded_assets_tenant
  ON client_uploaded_assets(tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. RLS Policies
-- Client edit actions run via service-role key (server actions use admin client)
-- so no public RLS needed for mutations. Read-only public access is restricted.
-- ---------------------------------------------------------------------------

ALTER TABLE client_variant_edit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_uploaded_assets     ENABLE ROW LEVEL SECURITY;

-- Admin full access
DROP POLICY IF EXISTS "client_variant_edit_events_admin_all" ON client_variant_edit_events;
CREATE POLICY "client_variant_edit_events_admin_all"
  ON client_variant_edit_events FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

DROP POLICY IF EXISTS "client_uploaded_assets_admin_all" ON client_uploaded_assets;
CREATE POLICY "client_uploaded_assets_admin_all"
  ON client_uploaded_assets FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

-- =============================================================================
-- END OF MIGRATION 016
-- =============================================================================
