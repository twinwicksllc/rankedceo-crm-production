-- =============================================================================
-- WaaS Foundation: Migration 001 - Tenants Table
-- Project: RankedCEO Website-as-a-Service (WaaS)
-- Supabase Project: NEW standalone WaaS project (separate from CRM)
-- =============================================================================
-- IMPORTANT: Run this in the NEW dedicated WaaS Supabase project, NOT the CRM project.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

CREATE TYPE waas_package_tier AS ENUM (
  'hosting',    -- Basic hosting only, no SEO tools
  'standard',   -- Hosting + SEO audit tool + basic reporting
  'premium'     -- Hosting + full SEO suite + AI insights + white-label
);

CREATE TYPE waas_tenant_status AS ENUM (
  'onboarding',   -- Tenant created, setup not complete
  'active',       -- Live and serving traffic
  'suspended',    -- Temporarily disabled (e.g., payment lapsed)
  'cancelled'     -- Permanently deactivated
);

-- ---------------------------------------------------------------------------
-- TENANTS TABLE
-- Core multi-tenant isolation unit. One row = one client website.
-- ---------------------------------------------------------------------------

CREATE TABLE tenants (
  -- Identity
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Domain routing (used by middleware for tenant resolution)
  -- At least one of domain or subdomain must be set.
  domain              TEXT          UNIQUE,                          -- e.g. 'client-a.com' (custom domain)
  subdomain           TEXT          UNIQUE,                          -- e.g. 'client-a' (→ client-a.rankedceo.com)

  -- Slug is the internal identifier used in /_sites/[site] routing
  -- Must be URL-safe: lowercase letters, numbers, hyphens only
  slug                TEXT          NOT NULL UNIQUE,                 -- e.g. 'client-a'

  -- Branding & personalization (stored as JSONB for flexibility)
  -- Schema: {
  --   business_name: string,
  --   tagline:       string,
  --   logo_url:      string | null,
  --   favicon_url:   string | null,
  --   colors: {
  --     primary:     string,   -- hex, e.g. '#2563EB'
  --     secondary:   string,
  --     accent:      string,
  --     background:  string,
  --     text:        string
  --   },
  --   fonts: {
  --     heading:     string,   -- e.g. 'Inter'
  --     body:        string
  --   },
  --   contact: {
  --     phone:       string | null,
  --     email:       string | null,
  --     address:     string | null,
  --     city:        string | null,
  --     state:       string | null,
  --     zip:         string | null
  --   },
  --   social: {
  --     facebook:    string | null,
  --     instagram:   string | null,
  --     google:      string | null,
  --     yelp:        string | null
  --   }
  -- }
  brand_config        JSONB         NOT NULL DEFAULT '{}',

  -- Billing & plan
  package_tier        waas_package_tier  NOT NULL DEFAULT 'hosting',

  -- Lifecycle
  status              waas_tenant_status NOT NULL DEFAULT 'onboarding',

  -- CRM linkage (optional: links this WaaS tenant to a CRM account)
  -- This is a soft reference — no FK since it's a different Supabase project
  crm_account_id      UUID          NULL,                            -- account.id from CRM Supabase

  -- Vercel domain verification token (for custom domain CNAME setup)
  vercel_project_id   TEXT          NULL,
  domain_verified     BOOLEAN       NOT NULL DEFAULT FALSE,
  domain_verified_at  TIMESTAMPTZ   NULL,

  -- SEO / analytics targets
  target_industry     TEXT          NULL,                            -- e.g. 'plumbing', 'hvac', 'real_estate'
  target_location     TEXT          NULL,                            -- e.g. 'Chicago, IL'

  -- Audit trail
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ   NULL                             -- soft delete
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Primary lookup path: middleware resolves tenant by hostname
CREATE INDEX idx_tenants_domain    ON tenants (domain)    WHERE domain IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_tenants_subdomain ON tenants (subdomain) WHERE subdomain IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_tenants_slug      ON tenants (slug)      WHERE deleted_at IS NULL;

-- Admin queries
CREATE INDEX idx_tenants_status       ON tenants (status);
CREATE INDEX idx_tenants_package_tier ON tenants (package_tier);
CREATE INDEX idx_tenants_crm_account  ON tenants (crm_account_id) WHERE crm_account_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION waas_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION waas_set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Platform admins (service role) can do anything — handled via service_role key
-- Anon/public: can only read active tenants (for middleware lookup)
CREATE POLICY "tenants_public_read_active"
  ON tenants
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active' AND deleted_at IS NULL);

-- Authenticated platform admins can manage all tenants
-- (In production, lock this to a specific admin role/claim)
CREATE POLICY "tenants_admin_all"
  ON tenants
  FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'waas_admin'
    OR auth.jwt() -> 'app_metadata' ->> 'waas_admin' = 'true'
  );

-- ---------------------------------------------------------------------------
-- HELPER FUNCTION: Resolve tenant by hostname
-- Used by middleware via RPC call for efficient single-query lookup
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION resolve_tenant_by_hostname(p_hostname TEXT)
RETURNS TABLE (
  id            UUID,
  slug          TEXT,
  domain        TEXT,
  subdomain     TEXT,
  brand_config  JSONB,
  package_tier  waas_package_tier,
  status        waas_tenant_status,
  target_industry TEXT,
  target_location TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_subdomain TEXT;
BEGIN
  -- Extract subdomain from hostname (e.g., 'client-a.rankedceo.com' → 'client-a')
  -- Handles: sub.rankedceo.com, sub.rankedceo.com:3000, custom-domain.com
  
  -- Try exact custom domain match first (strip port if present)
  RETURN QUERY
    SELECT 
      t.id, t.slug, t.domain, t.subdomain,
      t.brand_config, t.package_tier, t.status,
      t.target_industry, t.target_location
    FROM tenants t
    WHERE t.domain = split_part(p_hostname, ':', 1)
      AND t.status = 'active'
      AND t.deleted_at IS NULL
    LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Try subdomain match (extract first segment before first dot)
  v_subdomain := split_part(p_hostname, '.', 1);
  
  RETURN QUERY
    SELECT 
      t.id, t.slug, t.domain, t.subdomain,
      t.brand_config, t.package_tier, t.status,
      t.target_industry, t.target_location
    FROM tenants t
    WHERE t.subdomain = v_subdomain
      AND t.status = 'active'
      AND t.deleted_at IS NULL
    LIMIT 1;
END;
$$;

-- Grant execution to anon (middleware uses anon key for tenant lookup)
GRANT EXECUTE ON FUNCTION resolve_tenant_by_hostname(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- SEED: Example tenant for local dev/testing
-- ---------------------------------------------------------------------------

INSERT INTO tenants (slug, subdomain, domain, brand_config, package_tier, status, target_industry, target_location)
VALUES (
  'demo',
  'demo',
  NULL,
  '{
    "business_name": "Demo Plumbing Co.",
    "tagline": "Fast, Reliable, Trusted",
    "logo_url": null,
    "colors": {
      "primary": "#2563EB",
      "secondary": "#1E40AF",
      "accent": "#DBEAFE",
      "background": "#FFFFFF",
      "text": "#111827"
    },
    "contact": {
      "phone": "(555) 123-4567",
      "email": "info@demoplumbing.com",
      "city": "Chicago",
      "state": "IL"
    }
  }',
  'standard',
  'active',
  'plumbing',
  'Chicago, IL'
)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- END OF MIGRATION 001
-- =============================================================================