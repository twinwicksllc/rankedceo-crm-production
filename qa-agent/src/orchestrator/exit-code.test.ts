import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as yaml from "js-yaml";
import { exitCodeFor } from "./exit-code.js";
import type { Finding } from "../types.js";

function finding(stepId: string, severity: Finding["severity"]): Finding {
  return {
    stepId,
    persona: "admin",
    severity,
    stepType: "wait_for_url",
    message: "wait_for_url timeout",
    timestamp: new Date(0).toISOString(),
  } as Finding;
}

test("smoke run with an error finding fails the job", () => {
  const report = {
    status: "pass_with_findings" as const,
    findings: [finding("orchestrator_smoke_fast_fail", "error")],
  };
  assert.equal(exitCodeFor(report, "smoke"), 1);
});

test("smoke run with only warnings and info still passes", () => {
  const report = {
    status: "pass_with_findings" as const,
    findings: [finding("a", "warning"), finding("b", "info")],
  };
  assert.equal(exitCodeFor(report, "smoke"), 0);
});

test("full run keeps exiting 0 on pass_with_findings, even with errors", () => {
  const report = {
    status: "pass_with_findings" as const,
    findings: [finding("x", "error")],
  };
  assert.equal(exitCodeFor(report, "full"), 0);
});

test("critical_halt and error statuses fail in every mode", () => {
  for (const status of ["critical_halt", "error"] as const) {
    assert.equal(exitCodeFor({ status, findings: [] }, "smoke"), 1);
    assert.equal(exitCodeFor({ status, findings: [] }, "full"), 1);
  }
});

test("smoke scenario: admin login steps are error severity, not warning", async () => {
  // A stale QA admin login must fail the PR check, not hide as a warning.
  // Parsed as YAML (not by regex) so CRLF checkouts and reordering don't matter.
  const raw = await readFile(
    new URL("../../scenarios/smoke.yaml", import.meta.url),
    "utf-8",
  );
  const scenario = yaml.load(raw) as {
    steps: Array<{ id: string; severity: string }>;
  };
  for (const id of [
    "admin_assert_dashboard",
    "admin_navigate_dashboard_explicit",
  ]) {
    const step = scenario.steps.find((s) => s.id === id);
    assert.ok(step, `${id} exists in smoke.yaml`);
    assert.equal(step.severity, "error", `${id} severity`);
  }
});
