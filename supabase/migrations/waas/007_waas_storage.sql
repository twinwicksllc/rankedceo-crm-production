-- =============================================================================
-- WaaS Phase 3: Migration 007 - Supabase Storage Buckets
-- Creates the 'logos' bucket for tenant logo uploads
-- Run AFTER 006_waas_domain_requests.sql
-- NOTE: Supabase Storage buckets are managed via the Dashboard or CLI.
-- This migration documents the required storage setup.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Storage bucket creation (run via Supabase CLI or Dashboard)
-- ---------------------------------------------------------------------------
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'logos',
--   'logos',
--   true,           -- Public bucket (logo URLs are embedded in HTML)
--   5242880,        -- 5MB max file size
--   ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Storage RLS Policies
-- ---------------------------------------------------------------------------

-- Allow public read access to logos
CREATE POLICY "public_read_logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'logos');

-- Allow anon to upload logos (during onboarding)
CREATE POLICY "anon_upload_logos"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] != 'private'
  );

-- Allow service role full access to logos
CREATE POLICY "service_role_logos"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'logos')
  WITH CHECK (bucket_id = 'logos');

-- ---------------------------------------------------------------------------
-- NOTE FOR SETUP
-- ---------------------------------------------------------------------------
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create a new bucket named 'logos'
-- 3. Set it to PUBLIC
-- 4. Set file size limit to 5MB
-- 5. Set allowed MIME types: image/jpeg, image/png, image/svg+xml, image/webp
-- 6. Apply the RLS policies above via SQL Editor
-- ---------------------------------------------------------------------------