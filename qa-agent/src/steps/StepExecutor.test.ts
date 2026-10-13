import test from "node:test";
import assert from "node:assert/strict";
import { StepExecutor } from "./StepExecutor.js";
import type { PersonaRouter } from "../personas/PersonaRouter.js";
import type { SupabaseAdapter } from "../adaptors/supabase/SupabaseAdapter.js";

test("stepWaitForUrl waits on pathname matcher and preserves timeout", async () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const page = {
    waitForFunction: async (...args: unknown[]) => {
      calls.push({ method: "waitForFunction", args });
    },
    waitForLoadState: async (...args: unknown[]) => {
      calls.push({ method: "waitForLoadState", args });
    },
  };

  const router = {
    getPage: async () => page,
  };

  const executor = new StepExecutor(
    router as unknown as PersonaRouter,
    {} as unknown as SupabaseAdapter,
    "evidence",
    "run",
  );

  // stepWaitForUrl is private; reach it through a minimal structural view.
  const internals = executor as unknown as {
    stepWaitForUrl(
      persona: string,
      pattern: string,
      timeoutMs: number,
    ): Promise<void>;
  };
  await internals.stepWaitForUrl("admin", "/admin/dashboard", 30_000);

  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.method, "waitForFunction");
  assert.equal(calls[0]?.args[1], new RegExp("/admin/dashboard").source);
  assert.deepEqual(calls[0]?.args[2], { timeout: 30_000 });

  assert.equal(calls[1]?.method, "waitForLoadState");
  assert.deepEqual(calls[1]?.args, ["load", { timeout: 30_000 }]);
});
