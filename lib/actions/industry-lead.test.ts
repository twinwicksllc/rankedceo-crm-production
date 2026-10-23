import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { LEAD_COLUMNS } from "../services/industry-lead-row";
import {
  buildSearchFilter,
  computeLeadStats,
  estimatedValueFromMetadata,
} from "../services/industry-lead-query";

// The action file imports next/cache and the cookie client, which Deno cannot
// load, so the action is checked by reading its source, and the pure helpers
// it relies on are tested directly.

const source = readFileSync(
  new URL("./industry-lead.ts", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

const LIVE = new Set<string>(LEAD_COLUMNS);

/** Names that are NOT columns of the live table but were used by the old code. */
const NON_LIVE = [
  "submitted_at",
  "estimated_value",
  "customer_name",
  "customer_email",
  "customer_phone",
  "service_address",
  "city",
  "state",
  "zip_code",
  "preferred_contact_method",
  "preferred_time",
  "notes",
  "service_details",
  "assigned_to",
];

/** Every string literal argument of a Supabase builder call that names columns. */
function columnStrings(): string[] {
  const out: string[] = [];
  const call =
    /\.(select|order|eq|gte|lte|or|insert|update)\(\s*(["'`])((?:\\.|(?!\2).)*)\2/g;
  for (const m of source.matchAll(call)) out.push(m[3]);
  return out;
}

test("no builder call names a column the live table lacks", () => {
  const strings = columnStrings();
  assert.ok(strings.length > 8, "expected to find the builder calls");
  for (const text of strings) {
    for (const bad of NON_LIVE) {
      assert.ok(
        !new RegExp(`\\b${bad}\\b`).test(text),
        `"${text}" names non-live column ${bad}`,
      );
    }
    if (text === "*") continue;
    // Plain column names in select("a, b") and eq("a", ...) must be live.
    for (const part of text.split(",")) {
      const name = part.trim();
      if (/^[a-z_]+$/.test(name) && !name.includes(" ")) {
        assert.ok(LIVE.has(name), `${name} in "${text}" is not a live column`);
      }
    }
  }
});

test("the old non-live column spellings are gone from the source", () => {
  assert.ok(!/submitted_at/.test(source.replace(/\/\/.*$/gm, "")));
  assert.ok(!/city\.ilike/.test(source));
  assert.ok(!/estimated_value\b/.test(columnStrings().join(" ")));
});

test("rows are written and read through the shared contract", () => {
  assert.match(source, /toLeadInsertRow\(accountId, authUserId, data\)/);
  assert.match(source, /\.map\(fromLeadRow\)/);
  assert.match(source, /fromLeadRow\(lead as LeadRow\)/);
  assert.match(source, /toLeadUpdatePatch\(existing, updates\)/);
  assert.ok(!/\.\.\.updates/.test(source), "updates must not be spread");
});

test("list orders and date-filters on created_at", () => {
  assert.match(source, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(source, /\.gte\("created_at", filters\.date_from\)/);
  assert.match(source, /\.lte\("created_at", filters\.date_to\)/);
});

test("the public insert goes through the session-less anon client", () => {
  assert.match(
    source,
    /import \{ createAnonClient \} from "@\/lib\/supabase\/anon"/,
  );
  const insertAt = source.indexOf(".insert(");
  assert.ok(insertAt > 0);
  const before = source.slice(Math.max(0, insertAt - 120), insertAt);
  assert.match(
    before,
    /createAnonClient\(\)/,
    "insert must follow the anon client",
  );
  assert.equal(source.split(".insert(").length, 2, "exactly one insert");
});

test("the operator lookup stays on the cookie client", () => {
  const submit = source.slice(
    source.indexOf("export async function submitIndustryLead"),
    source.indexOf("export async function getIndustryLeads"),
  );
  assert.match(submit, /const supabase = await createClient\(\)/);
  assert.match(submit, /supabase\s*\n\s*\.from\("users"\)/);
});

test("single read and update are scoped to the caller's account", () => {
  const single = source.slice(
    source.indexOf("export async function getIndustryLead("),
    source.indexOf("export async function updateIndustryLead"),
  );
  assert.match(single, /resolveAccountId\(supabase, user\)/);
  assert.match(single, /\.eq\("account_id", accountId\)/);

  const update = source.slice(
    source.indexOf("export async function updateIndustryLead"),
    source.indexOf("export async function getIndustryLeadStats"),
  );
  assert.match(update, /resolveAccountId\(supabase, user\)/);
  // Both the read and the write filter by account.
  assert.equal(update.split('.eq("account_id", accountId)').length - 1, 2);
  // The read comes before the write.
  assert.ok(
    update.indexOf(".maybeSingle()") < update.indexOf(".update("),
    "existing row must be read before the update",
  );
});

test("stats select metadata, not an estimated_value column", () => {
  assert.match(source, /\.select\("status, urgency, metadata"\)/);
  assert.match(source, /computeLeadStats\(/);
});

// ---------------------------------------------------------------------------
// buildSearchFilter
// ---------------------------------------------------------------------------

test("search filter ORs the three live columns and not city", () => {
  assert.equal(
    buildSearchFilter("ada"),
    "lead_name.ilike.%ada%,lead_email.ilike.%ada%,lead_phone.ilike.%ada%",
  );
});

test("empty or blank search adds no filter", () => {
  assert.equal(buildSearchFilter(undefined), null);
  assert.equal(buildSearchFilter(""), null);
  assert.equal(buildSearchFilter("   "), null);
  assert.equal(buildSearchFilter(",()%*"), null);
});

test("search cannot inject extra conditions through commas or parentheses", () => {
  const filter =
    buildSearchFilter("x%,status.eq.new,account_id.neq.abc)") ?? "";
  // Exactly the three conditions we build, no more.
  assert.equal(filter.split(",").length, 3);
  assert.ok(!filter.includes(")"), filter);
  assert.ok(!filter.includes("("), filter);
  for (const cond of filter.split(",")) {
    assert.match(cond, /^lead_(name|email|phone)\.ilike\.%[^%,()*]*%$/);
  }
});

test("search strips wildcards, quotes and escapes, and caps the length", () => {
  const filter = buildSearchFilter('a*b%c"d\\e') ?? "";
  for (const cond of filter.split(",")) {
    assert.match(cond, /^lead_(name|email|phone)\.ilike\.%a b c d e%$/);
  }
  const long = buildSearchFilter("z".repeat(500)) ?? "";
  assert.equal(long.split(",")[0].length, "lead_name.ilike.%%".length + 100);
});

test("a normal email or phone search keeps its characters", () => {
  const filter = buildSearchFilter("ada@example.com") ?? "";
  assert.ok(filter.includes("lead_email.ilike.%ada@example.com%"));
  assert.ok((buildSearchFilter("555-0100") ?? "").includes("%555-0100%"));
});

// ---------------------------------------------------------------------------
// Stats from metadata
// ---------------------------------------------------------------------------

test("estimated_value is read from metadata as a number only", () => {
  assert.equal(estimatedValueFromMetadata({ estimated_value: 250 }), 250);
  assert.equal(estimatedValueFromMetadata({ estimated_value: "250" }), null);
  assert.equal(estimatedValueFromMetadata({ estimated_value: null }), null);
  assert.equal(estimatedValueFromMetadata({}), null);
  assert.equal(estimatedValueFromMetadata(null), null);
  assert.equal(estimatedValueFromMetadata("text"), null);
  assert.equal(estimatedValueFromMetadata({ estimated_value: NaN }), null);
});

test("stats math: counts, conversion and values come from metadata", () => {
  const stats = computeLeadStats([
    { status: "new", urgency: "emergency", metadata: { estimated_value: 100 } },
    {
      status: "scheduled",
      urgency: "urgent",
      metadata: { estimated_value: 300 },
    },
    { status: "completed", urgency: "scheduled", metadata: {} },
    { status: "completed", urgency: "scheduled", metadata: null },
    {
      status: "lost",
      urgency: "scheduled",
      metadata: { estimated_value: "9" },
    },
  ]);
  assert.deepEqual(stats, {
    total: 5,
    new_count: 1,
    emergency_count: 1,
    urgent_count: 1,
    scheduled_count: 1,
    completed_count: 2,
    lost_count: 1,
    conversion_rate: 67,
    avg_estimated_value: 200,
    total_pipeline_value: 400,
  });
});

test("stats on no leads", () => {
  const stats = computeLeadStats([]);
  assert.equal(stats.total, 0);
  assert.equal(stats.conversion_rate, 0);
  assert.equal(stats.avg_estimated_value, null);
  assert.equal(stats.total_pipeline_value, 0);
});
