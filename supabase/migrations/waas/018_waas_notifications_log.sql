-- =============================================================================
-- WaaS Phase 6.4: Migration 018 - Notification Log
--
-- Adds notification_log table to audit all outbound email notifications
-- sent by the system. This provides:
--   - Audit trail of every notification sent
--   - Deduplication (prevent duplicate sends)
--   - Status tracking (sent | failed | skipped)
--
-- Safe to re-run (all statements are idempotent via IF NOT EXISTS)
-- Run AFTER 017_waas_domain_request_workflow.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who was notified
  tenant_id       UUID        NULL REFERENCES tenants(id) ON DELETE SET NULL,
  recipient_email TEXT        NOT NULL,

  -- What was sent
  notification_type TEXT      NOT NULL,   -- see NotificationType enum in notifications.ts
  subject         TEXT        NOT NULL,
  template_data   JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Delivery status
  status          TEXT        NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'skipped')),
  provider        TEXT        NULL,       -- 'resend' | 'sendgrid' | 'log_only'
  provider_message_id TEXT    NULL,       -- message ID returned by provider
  error_message   TEXT        NULL,       -- if status = 'failed'

  -- Deduplication key (prevents resending same notification within dedup_window_hours)
  dedup_key       TEXT        NULL,

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_tenant_id
  ON notification_log(tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_log_type_created
  ON notification_log(notification_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_log_dedup_key
  ON notification_log(dedup_key)
  WHERE dedup_key IS NOT NULL;

-- RLS
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_notification_log" ON notification_log;
CREATE POLICY "service_role_full_access_notification_log"
  ON notification_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- END OF MIGRATION 018
-- =============================================================================
