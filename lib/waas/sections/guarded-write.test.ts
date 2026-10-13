import test from "node:test";
import assert from "node:assert/strict";
import { updateIfUnchanged, type GuardedClient } from "./guarded-write";

type Row = { id: string; updated_at: string | null; sections_json: unknown };

/** Fake table that applies the filters like the database would. */
function fakeClient(rows: Row[], opts: { error?: string } = {}) {
  const log: string[] = [];
  const client: GuardedClient = {
    from(table) {
      return {
        update(values) {
          const filters: Array<[string, string | null, "eq" | "is"]> = [];
          const q = {
            eq(col: string, val: string) {
              filters.push([col, val, "eq"]);
              return q;
            },
            is(col: string, val: null) {
              filters.push([col, val, "is"]);
              return q;
            },
            async select() {
              log.push(`${table}:${JSON.stringify(filters)}`);
              if (opts.error)
                return { data: null, error: { message: opts.error } };
              const hit = rows.filter((r) =>
                filters.every(
                  ([c, v]) =>
                    (r as unknown as Record<string, unknown>)[c] === v,
                ),
              );
              for (const r of hit) Object.assign(r, values);
              return { data: hit.map((r) => ({ id: r.id })), error: null };
            },
          };
          return q;
        },
      };
    },
  };
  return { client, log };
}

test("writes when the row is unchanged since it was read", async () => {
  const rows: Row[] = [{ id: "a", updated_at: "t1", sections_json: [] }];
  const { client } = fakeClient(rows);
  const res = await updateIfUnchanged(
    client,
    "v",
    "a",
    { sections_json: [1] },
    "t1",
    "t2",
  );
  assert.deepEqual(res, { status: "written" });
  assert.deepEqual(rows[0], { id: "a", updated_at: "t2", sections_json: [1] });
});

test("reports a conflict and leaves the row alone when it changed (stale writer)", async () => {
  const rows: Row[] = [{ id: "a", updated_at: "t2", sections_json: ["new"] }];
  const { client } = fakeClient(rows);
  const res = await updateIfUnchanged(
    client,
    "v",
    "a",
    { sections_json: ["stale"] },
    "t1",
    "t3",
  );
  assert.deepEqual(res, { status: "conflict" });
  assert.deepEqual(rows[0], {
    id: "a",
    updated_at: "t2",
    sections_json: ["new"],
  });
});

test("a backfill write makes an earlier reader fail its own check", async () => {
  const rows: Row[] = [
    { id: "a", updated_at: "t1", sections_json: ["legacy"] },
  ];
  const { client } = fakeClient(rows);
  // Client edit and backfill both read the row at t1.
  const backfill = await updateIfUnchanged(
    client,
    "v",
    "a",
    { sections_json: ["with ids"] },
    "t1",
    "t2",
  );
  const edit = await updateIfUnchanged(
    client,
    "v",
    "a",
    { sections_json: ["stale edit"] },
    "t1",
    "t3",
  );
  assert.equal(backfill.status, "written");
  assert.equal(edit.status, "conflict");
  assert.deepEqual(rows[0].sections_json, ["with ids"]);
});

test("a row whose updated_at was null is matched with IS NULL, not = null", async () => {
  const rows: Row[] = [{ id: "a", updated_at: null, sections_json: [] }];
  const { client, log } = fakeClient(rows);
  const res = await updateIfUnchanged(client, "v", "a", {}, null, "t2");
  assert.equal(res.status, "written");
  assert.match(log[0], /"updated_at",null,"is"/);
});

test("a null-updated_at row is not matched when someone already set updated_at", async () => {
  const rows: Row[] = [{ id: "a", updated_at: "t1", sections_json: [] }];
  const { client } = fakeClient(rows);
  const res = await updateIfUnchanged(client, "v", "a", {}, null, "t2");
  assert.equal(res.status, "conflict");
});

test("a database error is reported as an error, not a conflict", async () => {
  const { client } = fakeClient([], { error: "boom" });
  const res = await updateIfUnchanged(client, "v", "a", {}, "t1", "t2");
  assert.deepEqual(res, { status: "error", message: "boom" });
});

test("only the row with the given id is touched", async () => {
  const rows: Row[] = [
    { id: "a", updated_at: "t1", sections_json: [] },
    { id: "b", updated_at: "t1", sections_json: [] },
  ];
  const { client } = fakeClient(rows);
  await updateIfUnchanged(client, "v", "a", { sections_json: [1] }, "t1", "t2");
  assert.equal(rows[1].updated_at, "t1");
});
