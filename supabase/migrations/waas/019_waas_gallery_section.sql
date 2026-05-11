-- =============================================================================
-- WaaS Phase 7.3: Migration 019 - Gallery Section
--
-- This migration is a documentation artifact only.
-- No schema changes are needed — gallery section items are stored inside
-- the existing sections_json JSONB column on tenant_site_variants.
--
-- This file exists to:
--   1. Document the gallery section data shape for future reference
--   2. Add a Postgres comment on the relevant column listing all known sections
--   3. Maintain a clean migration history
--
-- Safe to re-run (comments are idempotent).
-- Run AFTER 018_waas_notifications_log.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Document the known section types on tenant_site_variants.sections_json
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN tenant_site_variants.sections_json IS
'JSONB array of SectionConfig objects. Known section types (Phase 7.3):
  hero, services, trust, financing, booking, reviews, about, faq,
  how-it-works, gallery

Gallery section shape (items stored in content.items[]):
  {
    "section": "gallery",
    "enabled": false,
    "order": 9,
    "config": { "columns": 3 },
    "content": {
      "eyebrow": "Our Work",
      "headline": "Business Name in Action",
      "items": [
        {
          "image_url": "https://...",
          "caption": "Optional caption text",
          "alt": "Accessibility alt text"
        }
      ]
    }
  }

Gallery items:
  - image_url: required, Supabase Storage public URL
  - caption:   optional, shown on hover overlay
  - alt:       optional, used as <img alt=""> for accessibility

Max items: 8 (soft limit enforced in editor UI)
Storage path: tenants/{tenantId}/gallery/{slot}/
Bucket: waas-assets (already exists from Phase 5.3)
';
