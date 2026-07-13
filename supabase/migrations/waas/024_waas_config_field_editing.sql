-- =============================================================================
-- WaaS Phase 8.6: Migration 024 — Config-field editing + edit_type fixes
--
-- 1. Adds 'config_change' to the client_variant_edit_events.edit_type CHECK
--    constraint. Part of exposing sections[N].config.<key> fields (dispatch
--    fee, response window, Q&A caps, visual preset, FAQPage JSON-LD toggle)
--    in the client/admin editor UI (audit finding 2.1) — these edits are
--    audited with edit_type = 'config_change'.
--
-- 2. Also adds 'font_change', which the application code
--    (lib/waas/actions/client-edit/history.ts, _shared.ts) has emitted since
--    Phase 7.1 but was never added to this constraint — a pre-existing gap
--    that silently failed font-change audit inserts (non-fatal, but noisy
--    in logs and a gap in the audit trail). Fixed alongside config_change
--    since both require the same ALTER.
--
-- Run AFTER 023_waas_seo_keywords.sql
-- Safe to re-run: drops the constraint if present, then recreates it with
-- the full allowed set (idempotent regardless of starting state).
-- =============================================================================

ALTER TABLE client_variant_edit_events
  DROP CONSTRAINT IF EXISTS client_variant_edit_events_edit_type_check;

ALTER TABLE client_variant_edit_events
  ADD CONSTRAINT client_variant_edit_events_edit_type_check
  CHECK (edit_type IN (
    'text_edit',
    'image_swap',
    'color_change',
    'ai_rewrite',
    'section_toggle',
    'font_change',
    'config_change'
  ));

COMMENT ON COLUMN client_variant_edit_events.edit_type IS
  'Type of edit operation. config_change = sections[N].config.<key> edits '
  '(dispatch fee, response window, Q&A caps, visual preset, JSON-LD toggle). '
  'font_change = brand_config.fonts.* edits.';
