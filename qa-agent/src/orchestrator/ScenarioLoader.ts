/**
 * ScenarioLoader — reads a YAML scenario file and validates it
 * against the Scenario schema using Zod.
 */

import * as fs from "node:fs/promises";
import * as yaml from "js-yaml";
import { z } from "zod";
import type { Scenario } from "../types.js";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const PersonaSchema = z.enum(["client", "admin", "enduser"]);
const SeveritySchema = z.enum(["info", "warning", "error", "critical"]);
const RunModeSchema = z.enum(["smoke", "full"]);

const BaseStepSchema = z.object({
  id: z.string(),
  persona: PersonaSchema,
  description: z.string().optional(),
  severity: SeveritySchema,
  intent: z.string().optional(),
  /** Retry count — 0 means no retry */
  retries: z.number().int().min(0).optional(),
  /** Per-step timeout override in ms */
  timeout_ms: z.number().int().positive().optional(),
});

const NavigateStepSchema = BaseStepSchema.extend({
  type: z.literal("navigate"),
  url: z.string(),
});
const ClickStepSchema = BaseStepSchema.extend({
  type: z.literal("click"),
  selector: z.string(),
});
const FillStepSchema = BaseStepSchema.extend({
  type: z.literal("fill"),
  selector: z.string(),
  value: z.string(),
});
const WaitForStepSchema = BaseStepSchema.extend({
  type: z.literal("wait_for"),
  selector: z.string(),
  timeout_ms: z.number().optional(),
});
const WaitForUrlStepSchema = BaseStepSchema.extend({
  type: z.literal("wait_for_url"),
  pattern: z.string(),
  timeout_ms: z.number().optional(),
});
const AssertTextStepSchema = BaseStepSchema.extend({
  type: z.literal("assert_text"),
  selector: z.string(),
  contains: z.string(),
});
const AssertUrlStepSchema = BaseStepSchema.extend({
  type: z.literal("assert_url"),
  pattern: z.string(),
});
const AssertDbStepSchema = BaseStepSchema.extend({
  type: z.literal("assert_db"),
  table: z.string(),
  where: z.record(z.unknown()),
  expected_count: z.number(),
});
const HandoffStepSchema = BaseStepSchema.extend({
  type: z.literal("handoff"),
  from: PersonaSchema,
  to: PersonaSchema,
  message: z.string(),
  handoff_timeout_ms: z.number().optional(),
});
const PauseStepSchema = BaseStepSchema.extend({
  type: z.literal("pause"),
  duration_ms: z.number(),
});

const StepSchema = z.discriminatedUnion("type", [
  NavigateStepSchema,
  ClickStepSchema,
  FillStepSchema,
  WaitForStepSchema,
  WaitForUrlStepSchema,
  AssertTextStepSchema,
  AssertUrlStepSchema,
  AssertDbStepSchema,
  HandoffStepSchema,
  PauseStepSchema,
]);

const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  modes: z.array(RunModeSchema),
  requires_stripe: z.boolean().optional(),
  requires_email: z.boolean().optional(),
  steps: z.array(StepSchema),
});

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loadScenario(filePath: string): Promise<Scenario> {
  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = yaml.load(raw);
  const result = ScenarioSchema.safeParse(parsed);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Scenario validation failed for "${filePath}":\n${errors}`);
  }

  return result.data as Scenario;
}
