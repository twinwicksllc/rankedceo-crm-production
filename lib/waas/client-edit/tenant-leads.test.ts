import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TENANT_LEAD_COLUMNS,
  loadTenantLeads,
  toTenantLeadItem,
  type TenantLeadsQueryClient,
} from "./tenant-leads";

function fakeClient(rows: unknown[] | null, error: { message: string } | null = null) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = {
    from(table: string) {
      calls.push(["from", table]);
      return {
        select(columns: string) {
          calls.push(["select", columns]);
          return {
            eq(c1: string, v1: string) {
              calls.push(["eq", c1, v1]);
              return {
                eq(c2: string, v2: string) {
                  calls.push(["eq", c2, v2]);
                  return {
                    order(col: string, opts: { ascending: boolean }) {
                      calls.push(["order", col, opts.ascending]);
                      return {
                        limit: async (n: number) => {
                          calls.push(["limit", n]);
                          return { data: rows, error };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as TenantLeadsQueryClient;
  return { client, calls };
}

describe("loadTenantLeads", () => {
  it("filters by the given tenant and the website-form source, newest first", async () => {
    const { client, calls } = fakeClient([]);
    await loadTenantLeads(client, "tenant-1");
    assert.deepEqual(calls.filter((c) => c[0] === "eq"), [
      ["eq", "tenant_id", "tenant-1"],
      ["eq", "source", "tenant_site"],
    ]);
    assert.deepEqual(calls.find((c) => c[0] === "order"), ["order", "created_at", false]);
    assert.deepEqual(calls.find((c) => c[0] === "limit"), ["limit", 100]);
  });

  it("never selects internal columns", () => {
    for (const forbidden of ["ip_hash", "notes", "audit_id", "utm_", "score"]) {
      assert.ok(!TENANT_LEAD_COLUMNS.includes(forbidden), `${forbidden} must not be selected`);
    }
  });

  it("maps rows to portal items", async () => {
    const { client } = fakeClient([
      {
        id: "l1", name: "Jane", email: "jane@example.com", phone: null, message: "Hi",
        service_requested: "Repipe", page_url: "https://acme.com/", created_at: "2026-10-31T12:00:00Z",
        ip_hash: "should-not-pass-through",
      },
    ]);
    const { items, error } = await loadTenantLeads(client, "tenant-1");
    assert.equal(error, null);
    assert.equal(items.length, 1);
    assert.equal(items[0].service, "Repipe");
    assert.ok(!("ip_hash" in items[0]));
  });

  it("returns the error message and no items on failure", async () => {
    const { client } = fakeClient(null, { message: "boom" });
    assert.deepEqual(await loadTenantLeads(client, "tenant-1"), { items: [], error: "boom" });
  });

  it("toTenantLeadItem renames service_requested", () => {
    const item = toTenantLeadItem({
      id: "1", name: null, email: "a@b.co", phone: null, message: null,
      service_requested: "X", page_url: null, created_at: "t",
    });
    assert.equal(item.service, "X");
  });
});
