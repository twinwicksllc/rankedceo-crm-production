import test from "node:test";
import assert from "node:assert/strict";
import { planSectionIdBackfill, rewriteLegacyPath } from "./backfill";
import { assignMissingIds } from "./section-ids";

const sec = (section: string, order: number, id?: string) => ({
  section,
  enabled: true,
  order,
  config: {},
  ...(id ? { id } : {}),
});

test("backfill adds ids without touching order, content or array position", () => {
  const input = [
    { ...sec("hero", 1), content: { headline: "H" } },
    sec("services", 2),
    sec("services", 3),
  ];
  const plan = planSectionIdBackfill(input);
  assert.equal(plan.action, "update");
  assert.deepEqual(
    (plan.next as Array<{ id: string }>).map((s) => s.id),
    ["hero", "services", "services-2"],
  );
  assert.deepEqual(plan.added, ["hero", "services", "services-2"]);
  // same positions, order values and content
  for (let i = 0; i < input.length; i++) {
    const rest = { ...(plan.next as Array<Record<string, unknown>>)[i] };
    delete rest.id;
    assert.deepEqual(rest, input[i]);
  }
  // input not mutated
  assert.equal((input[0] as Record<string, unknown>).id, undefined);
});

test("backfill is idempotent: a second run is a no-op", () => {
  const first = planSectionIdBackfill([sec("hero", 1), sec("faq", 2)]);
  const second = planSectionIdBackfill(first.next);
  assert.equal(second.action, "skip-already-done");
});

test("backfill keeps ids that exist and only fills the gaps", () => {
  const plan = planSectionIdBackfill([sec("faq", 1, "faq-zz"), sec("faq", 2)]);
  assert.deepEqual(
    (plan.next as Array<{ id: string }>).map((s) => s.id),
    ["faq-zz", "faq"],
  );
  assert.deepEqual(plan.added, ["faq"]);
});

test("backfill leaves stray non-section entries alone and reports them", () => {
  const stray = { content: { headline: "stray" } };
  const plan = planSectionIdBackfill([sec("hero", 1), stray, null]);
  assert.equal(plan.action, "update");
  assert.equal(plan.strayEntries, 2);
  const next = plan.next as unknown[];
  assert.equal(next[1], stray);
  assert.equal(next[2], null);
});

test("backfill skips empty, non-array and all-stray values", () => {
  assert.equal(planSectionIdBackfill([]).action, "skip-empty");
  assert.equal(planSectionIdBackfill([null]).action, "skip-empty");
  assert.equal(planSectionIdBackfill(null).action, "skip-not-array");
  assert.equal(planSectionIdBackfill({}).action, "skip-not-array");
});

test("rewriteLegacyPath maps array position to the section's id", () => {
  const sections = assignMissingIds([
    sec("hero", 1),
    sec("services", 2),
    sec("services", 3),
  ]);
  assert.equal(
    rewriteLegacyPath("sections[0].content.headline", sections),
    "sections[id=hero].content.headline",
  );
  assert.equal(
    rewriteLegacyPath("sections[2].content.items[1].title", sections),
    "sections[id=services-2].content.items[1].title",
  );
  assert.equal(
    rewriteLegacyPath("sections[1].enabled", sections),
    "sections[id=services].enabled",
  );
});

test("rewriteLegacyPath resolves by position, not by the order field", () => {
  // order values are 1-based and out of step with the array position
  const sections = assignMissingIds([sec("about", 2), sec("hero", 1)]);
  assert.equal(
    rewriteLegacyPath("sections[1].content.headline", sections),
    "sections[id=hero].content.headline",
  );
});

test("rewriteLegacyPath returns null for stray, missing, id and brand paths", () => {
  const sections = assignMissingIds([sec("hero", 1), { content: {} }]);
  assert.equal(
    rewriteLegacyPath("sections[1].content.headline", sections),
    null,
  );
  assert.equal(
    rewriteLegacyPath("sections[9].content.headline", sections),
    null,
  );
  assert.equal(
    rewriteLegacyPath("sections[id=hero].content.headline", sections),
    null,
  );
  assert.equal(rewriteLegacyPath("brand_config.tagline", sections), null);
  // sections without ids yet: nothing to map to
  assert.equal(
    rewriteLegacyPath("sections[0].enabled", [sec("hero", 1)]),
    null,
  );
});
