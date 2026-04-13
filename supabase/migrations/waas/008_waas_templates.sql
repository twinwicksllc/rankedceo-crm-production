-- =============================================================================
-- WaaS Phase 4: Migration 008 - Template Engine
-- Creates site_templates and tenant_site_config tables
-- Run in the WaaS Supabase project AFTER 007_waas_storage.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SITE TEMPLATES TABLE
-- Stores the master template definitions (Modern, Bold, Trust-First)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS site_templates (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT          NOT NULL,                        -- e.g. 'Modern'
  slug                TEXT          NOT NULL UNIQUE,                 -- e.g. 'modern'
  description         TEXT          NULL,
  preview_image_url   TEXT          NULL,                            -- screenshot of template

  -- Default layout: ordered array of section configs
  -- Schema: [
  --   { section: 'hero',     enabled: true,  order: 1, config: {} },
  --   { section: 'services', enabled: true,  order: 2, config: {} },
  --   { section: 'trust',    enabled: true,  order: 3, config: {} },
  --   { section: 'booking',  enabled: true,  order: 4, config: {} },
  --   { section: 'financing',enabled: false, order: 5, config: {} },
  --   { section: 'reviews',  enabled: true,  order: 6, config: {} }
  -- ]
  default_layout_json JSONB         NOT NULL DEFAULT '[]',

  -- Theme CSS overrides (per-template base styles)
  base_css            TEXT          NULL,

  -- Availability
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  is_default          BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Audit trail
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TENANT SITE CONFIG TABLE
-- Per-tenant customization on top of the template
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tenant_site_config (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  template_id         UUID          NULL REFERENCES site_templates(id) ON DELETE SET NULL,

  -- Active sections (overrides template default_layout_json)
  -- Same schema as default_layout_json but tenant-specific
  active_sections_json JSONB        NOT NULL DEFAULT '[]',

  -- Custom CSS (tenant-level overrides)
  custom_css          TEXT          NULL,

  -- SEO metadata
  meta_title          TEXT          NULL,                            -- defaults to business_name
  meta_description    TEXT          NULL,                            -- defaults to USP
  og_image_url        TEXT          NULL,

  -- Deployment
  deployment_url      TEXT          NULL,                            -- live URL after deploy
  deployed_at         TIMESTAMPTZ   NULL,
  last_preview_at     TIMESTAMPTZ   NULL,

  -- Audit trail
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_site_templates_slug      ON site_templates(slug);
CREATE INDEX IF NOT EXISTS idx_site_templates_is_active ON site_templates(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_tenant_site_config_tenant_id ON tenant_site_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_site_config_template_id ON tenant_site_config(template_id);

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGERS
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS site_templates_updated_at ON site_templates;
CREATE TRIGGER site_templates_updated_at
  BEFORE UPDATE ON site_templates
  FOR EACH ROW
  EXECUTE FUNCTION waas_set_updated_at();

DROP TRIGGER IF EXISTS tenant_site_config_updated_at ON tenant_site_config;
CREATE TRIGGER tenant_site_config_updated_at
  BEFORE UPDATE ON tenant_site_config
  FOR EACH ROW
  EXECUTE FUNCTION waas_set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE site_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_site_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read active templates (needed for renderer)
DROP POLICY IF EXISTS "site_templates_public_read" ON site_templates;
CREATE POLICY "site_templates_public_read"
  ON site_templates FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

-- Admins can manage templates
DROP POLICY IF EXISTS "site_templates_admin_all" ON site_templates;
CREATE POLICY "site_templates_admin_all"
  ON site_templates FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

-- Anon can read tenant site config (needed for renderer)
DROP POLICY IF EXISTS "tenant_site_config_public_read" ON tenant_site_config;
CREATE POLICY "tenant_site_config_public_read"
  ON tenant_site_config FOR SELECT TO anon, authenticated
  USING (TRUE);

-- Admins can manage tenant site configs
DROP POLICY IF EXISTS "tenant_site_config_admin_all" ON tenant_site_config;
CREATE POLICY "tenant_site_config_admin_all"
  ON tenant_site_config FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

-- ---------------------------------------------------------------------------
-- SEED: 3 starter templates
-- ---------------------------------------------------------------------------

INSERT INTO site_templates (name, slug, description, is_default, default_layout_json)
VALUES
(
  'Modern',
  'modern',
  'Clean, minimal design with bold typography and plenty of whitespace. Best for tech-forward trades.',
  TRUE,
  '[
    {"section":"hero",      "enabled":true,  "order":1, "config":{"variant":"centered","showTextmark":true}},
    {"section":"trust",     "enabled":true,  "order":2, "config":{"variant":"badge-row"}},
    {"section":"services",  "enabled":true,  "order":3, "config":{"columns":3,"showIcons":true}},
    {"section":"booking",   "enabled":true,  "order":4, "config":{"variant":"inline"}},
    {"section":"financing", "enabled":false, "order":5, "config":{}},
    {"section":"reviews",   "enabled":true,  "order":6, "config":{"showNFC":true}}
  ]'::jsonb
),
(
  'Bold',
  'bold',
  'High-contrast, aggressive CTAs with dark sections. Best for competitive markets like plumbing and HVAC.',
  FALSE,
  '[
    {"section":"hero",      "enabled":true,  "order":1, "config":{"variant":"split","showTextmark":true}},
    {"section":"services",  "enabled":true,  "order":2, "config":{"columns":2,"showIcons":true}},
    {"section":"trust",     "enabled":true,  "order":3, "config":{"variant":"full-width"}},
    {"section":"financing", "enabled":true,  "order":4, "config":{}},
    {"section":"booking",   "enabled":true,  "order":5, "config":{"variant":"modal-trigger"}},
    {"section":"reviews",   "enabled":true,  "order":6, "config":{"showNFC":true}}
  ]'::jsonb
),
(
  'Trust-First',
  'trust-first',
  'Social proof-heavy layout leading with reviews and credentials. Best for medical, legal, and high-trust trades.',
  FALSE,
  '[
    {"section":"hero",      "enabled":true,  "order":1, "config":{"variant":"centered","showTextmark":true}},
    {"section":"reviews",   "enabled":true,  "order":2, "config":{"showNFC":true,"variant":"prominent"}},
    {"section":"trust",     "enabled":true,  "order":3, "config":{"variant":"badge-row"}},
    {"section":"services",  "enabled":true,  "order":4, "config":{"columns":3,"showIcons":true}},
    {"section":"booking",   "enabled":true,  "order":5, "config":{"variant":"inline"}},
    {"section":"financing", "enabled":false, "order":6, "config":{}}
  ]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- END OF MIGRATION 008
-- =============================================================================