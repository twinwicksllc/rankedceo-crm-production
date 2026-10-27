import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMissingTenantColumn } from "./_shared";

// The admin actions query the `tenants` table. When a column such as deleted_at
// is missing, Postgres reports: column "deleted_at" of relation "tenants" does
// not exist. The parser matched relation "waas_tenants", a name that no query
// uses, so the deleted_at fallbacks in stats.ts and tenants.ts never fired.

test("a missing column on the tenants relation is recognised", () => {
  assert.equal(
    parseMissingTenantColumn(
      'column "deleted_at" of relation "tenants" does not exist',
    ),
    "deleted_at",
  );
});

test("the column name is returned for other columns too", () => {
  assert.equal(
    parseMissingTenantColumn(
      'column "package_tier" of relation "tenants" does not exist',
    ),
    "package_tier",
  );
});

test("a missing column on another relation is not mistaken for a tenant column", () => {
  assert.equal(
    parseMissingTenantColumn(
      'column "deleted_at" of relation "audits" does not exist',
    ),
    null,
  );
  assert.equal(
    parseMissingTenantColumn(
      'column "deleted_at" of relation "tenant_site_config" does not exist',
    ),
    null,
  );
});

test("unrelated errors return null", () => {
  assert.equal(parseMissingTenantColumn("permission denied"), null);
  assert.equal(parseMissingTenantColumn(""), null);
});
