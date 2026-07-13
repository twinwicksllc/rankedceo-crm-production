/**
 * Orchestrator — the central execution engine.
 *
 * Sequence:
 *   1. Check restart gate (open `qa-critical-halt` GitHub Issues)
 *   2. Load scenario YAML
 *   3. Init PersonaRouter (both browser contexts)
 *   4. Execute steps one-by-one
 *   5. On finding: pass to EscalationEngine
 *      - info/warning/error → record, continue
 *      - critical → EscalationEngine fires notifications, throws CriticalHaltError
 *   6. On completion: build RunReport
 *   7. Hand off report to ReportDispatcher (Sprint 3)
 */

import * as path from "node:path";
import * as fs from "node:fs/promises";
import { PersonaRouter } from "../personas/PersonaRouter.js";
import { EscalationEngine, CriticalHaltError } from "./EscalationEngine.js";
import { StepExecutor } from "../steps/StepExecutor.js";
import { loadScenario } from "./ScenarioLoader.js";
import { SupabaseAdapter } from "../adaptors/supabase/SupabaseAdapter.js";
import { ReportDispatcher } from "../reporting/ReportDispatcher.js";
import type {
  RunConfig,
  RunReport,
  RunStatus,
  Finding,
  ScenarioStep,
} from "../types.js";

export class Orchestrator {
  private readonly evidenceDir: string;

  constructor(private readonly config: RunConfig) {
    this.evidenceDir = path.join("evidence", config.runId);
  }

  async run(): Promise<RunReport> {
    const startedAt = new Date().toISOString();
    console.log(`\n🤖 QA Agent — Run ${this.config.runId}`);
    console.log(`   Mode:     ${this.config.mode}`);
    console.log(`   Scenario: ${this.config.scenarioPath}`);
    console.log(`   Base URL: ${this.config.baseUrl}`);
    console.log(`   Started:  ${startedAt}\n`);

    // ── 1. Restart gate ───────────────────────────────────────────────────
    const escalation = new EscalationEngine(this.config, this.evidenceDir);
    await escalation.checkRestartGate();

    // ── 2. Load scenario ──────────────────────────────────────────────────
    const scenario = await loadScenario(this.config.scenarioPath);
    console.log(
      `📋 Scenario: "${scenario.name}" (${scenario.steps.length} steps)\n`,
    );

    // Filter steps to current run mode
    const steps = scenario.steps;

    // ── 3. Init infrastructure ────────────────────────────────────────────
    await fs.mkdir(this.evidenceDir, { recursive: true });
    const router = new PersonaRouter();
    const db = new SupabaseAdapter();

    try {
      await router.init(this.config);
    } catch (initErr) {
      // Capture a screenshot of what the page looks like on init failure
      try {
        const screenshotPath = path.join(
          this.evidenceDir,
          "init-failure-admin.png",
        );
        await router.screenshot("admin", screenshotPath);
        console.error(`📸 Init failure screenshot saved: ${screenshotPath}`);
      } catch {
        /* screenshot may fail if browser didn't launch */
      }
      await router.teardown();
      throw initErr;
    }
    console.log("✅ Browser contexts initialised (client + admin)\n");

    const executor = new StepExecutor(
      router,
      db,
      this.evidenceDir,
      this.config.runId,
    );

    // ── 4. Execute steps ──────────────────────────────────────────────────
    let passedSteps = 0;
    let findingSteps = 0;
    let status: RunStatus = "running";
    let consecutiveUiFailures = 0;
    let lastFailurePersona: string | null = null;
    let fastFailTriggered = false;

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const prefix = `[${String(i + 1).padStart(3, "0")}/${steps.length}]`;
        console.log(
          `${prefix} ${step.type.padEnd(12)} ${step.persona.padEnd(6)} ${step.id}`,
        );

        const finding = await executor.execute(step);

        if (finding) {
          findingSteps++;
          // EscalationEngine handles logging + throwing on critical
          await escalation.record(finding);

          if (this.config.mode === "smoke") {
            const isUiFailure = this.isUiFailureSignal(step, finding);
            if (isUiFailure && lastFailurePersona === finding.persona) {
              consecutiveUiFailures += 1;
            } else if (isUiFailure) {
              consecutiveUiFailures = 1;
              lastFailurePersona = finding.persona;
            } else {
              consecutiveUiFailures = 0;
              lastFailurePersona = null;
            }

            if (consecutiveUiFailures >= 2) {
              const fastFailFinding: Finding = {
                stepId: "orchestrator_smoke_fast_fail",
                persona: finding.persona,
                severity: "error",
                stepType: step.type,
                message:
                  `Smoke fast-fail triggered after ${consecutiveUiFailures} consecutive UI failures for persona "${finding.persona}". ` +
                  "Stopping remaining steps to avoid long timeout cascades from a likely page-load/auth state failure.",
                timestamp: new Date().toISOString(),
              };
              await escalation.record(fastFailFinding);
              findingSteps++;
              status = "error";
              fastFailTriggered = true;
              console.warn(
                "[Orchestrator] Smoke fast-fail guard engaged; aborting remaining steps.",
              );
              break;
            }
          }
        } else {
          passedSteps++;
          consecutiveUiFailures = 0;
          lastFailurePersona = null;
        }
      }

      if (!fastFailTriggered) {
        // All steps complete without critical halt
        const allFindings = escalation.getFindings();
        const hasErrors = allFindings.some((f) => f.severity === "error");
        status = hasErrors
          ? "pass_with_findings"
          : allFindings.length > 0
            ? "pass_with_findings"
            : "pass";
      }
    } catch (err) {
      if (err instanceof CriticalHaltError) {
        status = "critical_halt";
        console.error(
          `\n🚨 Run ${this.config.runId} halted at step ${err.finding.stepId}`,
        );
      } else {
        // Unexpected error — treat as critical
        status = "critical_halt";
        console.error(`\n💥 Unexpected orchestrator error:`, err);
      }
    } finally {
      await router.teardown();
    }

    // ── 5. Build report ───────────────────────────────────────────────────
    const completedAt = new Date().toISOString();
    const findings = escalation.getFindings();
    const criticalFinding = findings.find((f) => f.severity === "critical");

    const report: RunReport = {
      runId: this.config.runId,
      scenario: scenario.name,
      mode: this.config.mode,
      startedAt,
      completedAt,
      status,
      findings,
      totalSteps: steps.length,
      passedSteps,
      findingSteps,
      criticalFinding,
    };

    // Save raw report JSON to evidence dir
    await fs.writeFile(
      path.join(this.evidenceDir, "report.json"),
      JSON.stringify(report, null, 2),
      "utf-8",
    );

    // Summary
    console.log(`\n${"─".repeat(60)}`);
    console.log(`Status:  ${this.statusEmoji(status)} ${status.toUpperCase()}`);
    console.log(`Passed:  ${passedSteps}/${steps.length} steps`);
    console.log(
      `Findings: ${findings.length} (${findings.filter((f) => f.severity === "critical").length} critical, ${findings.filter((f) => f.severity === "error").length} error, ${findings.filter((f) => f.severity === "warning").length} warning)`,
    );
    console.log(`Duration: ${this.formatDuration(startedAt, completedAt)}`);
    console.log(`Evidence: ${this.evidenceDir}/`);
    console.log(`${"─".repeat(60)}\n`);

    // ── 6. Dispatch report ────────────────────────────────────────────────
    const dispatcher = new ReportDispatcher();
    await dispatcher.dispatch(report, this.evidenceDir);

    return report;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private statusEmoji(status: RunStatus): string {
    switch (status) {
      case "pass":
        return "✅";
      case "pass_with_findings":
        return "⚠️ ";
      case "error":
        return "❌";
      case "critical_halt":
        return "🚨";
      case "running":
        return "🔄";
    }
  }

  private formatDuration(start: string, end: string): string {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }

  private isUiFailureSignal(step: ScenarioStep, finding: Finding): boolean {
    const uiStepTypes: Array<ScenarioStep["type"]> = [
      "navigate",
      "wait_for",
      "wait_for_url",
      "assert_text",
      "assert_url",
      "click",
      "fill",
    ];

    if (!uiStepTypes.includes(step.type)) return false;

    const msg = finding.message.toLowerCase();
    return (
      msg.includes("timeout") ||
      msg.includes("did not match pathname") ||
      msg.includes("/login?next=/admin/dashboard") ||
      msg.includes("wait_for") ||
      msg.includes("wait_for_url")
    );
  }
}
