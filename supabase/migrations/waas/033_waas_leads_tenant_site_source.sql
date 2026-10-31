-- 033_waas_leads_tenant_site_source.sql
-- Project: rankedceo-waas (klgvdvryewykzlumbkei). Apply by hand, like 030 to 032.
-- Idempotent: safe to run twice.
--
-- Why (B5, native lead form on tenant sites): leads captured by the form on a
-- customer's own website need their own source value. The existing values are
-- audit_tool, email_capture, onboarding, referral and manual.
--
-- RUN THIS FILE ON ITS OWN, and let it finish before running 034. PostgreSQL
-- cannot use a new enum value in the same transaction that adds it, and 034
-- refers to 'tenant_site'. In the Supabase SQL Editor, paste only this
-- statement and press Run.
--
-- No policy is added or changed. Inserts for this source go through the
-- service-role server action (lib/waas/actions/tenant-lead.ts), never the anon
-- key, so leads_anon_insert (audit_tool, email_capture only) stays as it is.

ALTER TYPE waas_lead_source ADD VALUE IF NOT EXISTS 'tenant_site';
