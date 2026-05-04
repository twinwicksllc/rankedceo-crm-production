-- =============================================================================
-- WaaS Phase 15: AI Site Variants
-- Stores 3 generated variant payloads per tenant for admin/client review.
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant_site_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variant_index INTEGER NOT NULL CHECK (variant_index BETWEEN 1 AND 3),
  variant_label TEXT NOT NULL,
  variant_rationale TEXT,
  template_slug TEXT NOT NULL,
  sections_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  generation_notes TEXT,
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'sent_to_review', 'selected')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, variant_index)
);

CREATE INDEX IF NOT EXISTS idx_tenant_site_variants_tenant_id
  ON tenant_site_variants (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_site_variants_status
  ON tenant_site_variants (status);
