-- 034_waas_leads_tenant_site_columns.sql
-- Project: rankedceo-waas (klgvdvryewykzlumbkei). Apply by hand, AFTER 033 has
-- finished. Idempotent: safe to run twice.
--
-- Why (B5): the tenant-site form records the visitor's message, the page it was
-- sent from and the service they asked about, plus a salted hash of their IP for
-- the per-hour rate limit (the raw IP is never stored). The tenant portal lists
-- a tenant's leads newest first, and the rate limit counts recent rows per
-- (tenant, ip_hash) and (tenant, email), so those lookups get indexes.
--
-- A lead from the tenant-site form must always belong to a tenant. The server
-- action sets tenant_id from the verified site, never from the request; this
-- CHECK is the backstop.
--
-- Not changed: RLS, grants, the existing indexes, existing rows.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS message           TEXT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS page_url          TEXT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS service_requested TEXT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ip_hash           TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_created
  ON leads (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_ip_created
  ON leads (tenant_id, ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_email_created
  ON leads (tenant_id, email, created_at DESC)
  WHERE tenant_id IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE leads
    ADD CONSTRAINT leads_tenant_site_requires_tenant
    CHECK (source <> 'tenant_site' OR tenant_id IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
