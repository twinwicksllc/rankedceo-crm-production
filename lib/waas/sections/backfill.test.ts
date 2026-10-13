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

// Deploy and snapshot restore call assignMissingIds on a copy of the variant's
// sections before the variant itself is backfilled. These tests show both
// routes give the same ids, so the live layout and the variant agree.
const mkSection = (section: string, order: number) => ({
  section,
  order,
  enabled: true,
  config: {},
  content: {},
});
const idsOf = (list: unknown[] | undefined) =>
  (list ?? []).map((s) => (s as { id: string }).id);

test("deploy/restore ids equal the backfill ids for the same sections", () => {
  const legacy = [
    mkSection("hero", 1),
    mkSection("services", 2),
    mkSection("faq", 3),
  ];
  const viaDeploy = assignMissingIds(legacy);
  const viaBackfill = planSectionIdBackfill(legacy).next;
  assert.deepEqual(idsOf(viaDeploy), idsOf(viaBackfill));
  assert.deepEqual(idsOf(viaDeploy), ["hero", "services", "faq"]);
});

test("with one section per type, an id does not depend on array position", () => {
  const a = [mkSection("hero", 1), mkSection("faq", 2), mkSection("about", 3)];
  const b = [a[2], a[0], a[1]];
  const idByType = (list: unknown[]) =>
    Object.fromEntries(
      (list as Array<{ section: string; id: string }>).map((s) => [
        s.section,
        s.id,
      ]),
    );
  assert.deepEqual(
    idByType(assignMissingIds(a)),
    idByType(assignMissingIds(b)),
  );
});

test("assignMissingIds is idempotent: running it twice changes nothing", () => {
  const once = assignMissingIds([
    mkSection("hero", 1),
    mkSection("services", 2),
    mkSection("services", 3),
  ]);
  assert.deepEqual(assignMissingIds(once), once);
  assert.deepEqual(idsOf(once), ["hero", "services", "services-2"]);
});

test("a variant that already has ids is not renumbered by deploy/restore", () => {
  const withIds = [
    { ...mkSection("services", 1), id: "services-k3f9a2" },
    { ...mkSection("services", 2), id: "services" },
  ];
  assert.deepEqual(idsOf(assignMissingIds(withIds)), [
    "services-k3f9a2",
    "services",
  ]);
});
