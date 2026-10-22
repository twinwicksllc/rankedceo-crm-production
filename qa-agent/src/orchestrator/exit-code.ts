/**
 * Process exit code for a finished run.
 *
 * Smoke runs gate PRs, so an "error" finding (for example the admin persona
 * never reaching /admin/dashboard, or the smoke fast-fail guard) must fail the
 * job instead of passing as "pass_with_findings". Full runs keep the old rule
 * (only "pass" / "pass_with_findings" exit 0) because their findings are
 * reported by email/issue and a red cron job adds nothing.
 */

import type { RunMode, RunReport } from "../types.js";

export function exitCodeFor(
  report: Pick<RunReport, "status" | "findings">,
  mode: RunMode,
): number {
  if (report.status !== "pass" && report.status !== "pass_with_findings") {
    return 1;
  }
  if (mode === "smoke" && report.findings.some((f) => f.severity === "error")) {
    return 1;
  }
  return 0;
}
