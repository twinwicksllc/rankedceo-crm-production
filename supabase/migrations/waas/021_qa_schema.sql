-- =============================================================================
-- Migration 021: QA Agent schema
-- Creates the `qa` schema for all QA agent data.
-- All records are tagged with run_tag = 'qa_agent_YYYYMMDD_HHMMSS_<hex>'
-- for easy identification and purge (never mixed with real client data).
--
-- Tables:
--   qa.qa_runs        — one row per agent run, stores HTML report + findings
--   qa.qa_scenarios   — admin-authored test scenarios (Sprint 3 / Q7)
-- =============================================================================

-- ── Schema ───────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS qa;

-- ── qa.qa_runs ────────────────────────────────────────────────────────────────
-- One row per QA agent run. Stores the full report for the dashboard widget.

CREATE TABLE IF NOT EXISTS qa.qa_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          text NOT NULL UNIQUE,
  run_tag         text NOT NULL,           -- e.g. qa_agent_20260511_120000_abcd1234
  scenario        text NOT NULL,
  mode            text NOT NULL CHECK (mode IN ('smoke', 'full')),
  status          text NOT NULL CHECK (status IN ('pass', 'pass_with_findings', 'error', 'critical_halt', 'running')),
  started_at      timestamptz NOT NULL,
  completed_at    timestamptz NOT NULL,
  total_steps     integer NOT NULL DEFAULT 0,
  passed_steps    integer NOT NULL DEFAULT 0,
  finding_steps   integer NOT NULL DEFAULT 0,
  findings        jsonb NOT NULL DEFAULT '[]',
  report_html     text,                    -- full standalone HTML report
  critical_step   text,                    -- step_id of critical halt, if any
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for dashboard listing (most recent first)
CREATE INDEX IF NOT EXISTS qa_runs_created_at_idx ON qa.qa_runs (created_at DESC);
-- Index for run_tag prefix purge
CREATE INDEX IF NOT EXISTS qa_runs_run_tag_idx ON qa.qa_runs (run_tag);

-- ── qa.qa_scenarios ───────────────────────────────────────────────────────────
-- Admin-authored test scenarios, managed via the /admin/qa-scenarios UI.
-- Stored as YAML text + parsed metadata for display.

CREATE TABLE IF NOT EXISTS qa.qa_scenarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     text NOT NULL UNIQUE,    -- e.g. "smoke", "full_lifecycle", "custom_01"
  name            text NOT NULL,
  description     text,
  modes           text[] NOT NULL DEFAULT ARRAY['smoke'],  -- ['smoke'] | ['full'] | ['smoke','full']
  requires_stripe boolean NOT NULL DEFAULT false,
  requires_email  boolean NOT NULL DEFAULT false,
  yaml_content    text NOT NULL,           -- raw YAML — validated on save
  step_count      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      text,                    -- admin email
  updated_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION qa.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_scenarios_updated_at ON qa.qa_scenarios;
CREATE TRIGGER qa_scenarios_updated_at
  BEFORE UPDATE ON qa.qa_scenarios
  FOR EACH ROW EXECUTE FUNCTION qa.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Service role key bypasses RLS. Enable RLS but allow service role full access.

ALTER TABLE qa.qa_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa.qa_scenarios ENABLE ROW LEVEL SECURITY;

-- Service role (used by QA agent + server actions) has full access
CREATE POLICY "service_role_all_qa_runs"
  ON qa.qa_runs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_qa_scenarios"
  ON qa.qa_scenarios FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON SCHEMA qa IS 'QA agent data — all records tagged qa_agent_* for easy purge. Never mixed with production data.';
COMMENT ON TABLE qa.qa_runs IS 'One row per QA agent run. Purge by deleting rows WHERE run_tag LIKE ''qa_agent_%''.';
COMMENT ON TABLE qa.qa_scenarios IS 'Admin-authored test scenarios managed via /admin/qa-scenarios UI.';
