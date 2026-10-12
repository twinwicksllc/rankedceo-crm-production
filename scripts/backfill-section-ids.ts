// =============================================================================
// scripts/backfill-section-ids.ts
// One-time backfill: give every existing section a stable id (B4+B3 plan, PR 2).
//
//   DRY RUN (default, writes nothing):
//     npx tsx scripts/backfill-section-ids.ts
//   One tenant only:
//     npx tsx scripts/backfill-section-ids.ts --tenant <tenant-uuid>
//   Write the changes (only after reading the dry-run report, on QA first):
//     npx tsx scripts/backfill-section-ids.ts --apply
//
// Needs NEXT_PUBLIC_WAAS_SUPABASE_URL and WAAS_SUPABASE_SERVICE_ROLE_KEY. The
// target database is whatever those point at, so check them before --apply.
//
// What it writes: only `sections_json` (tenant_site_variants) and
// `active_sections_json` (tenant_site_config). Array order, `order` values and
// content are not changed. It is safe to re-run: rows that already have ids are
// skipped. Each update only applies if the row's `updated_at` is unchanged since
// it was read; otherwise it is reported as a conflict and left alone. Client
// edits and admin saves set `updated_at`; tenant_site_config also has a trigger.
//
// History: in the same run that adds ids to a variant, its old position-based
// edit events (`sections[3]...`) are rewritten to id paths (`sections[id=faq]...`)
// using the array position. That is only done in that run; on a later run the
// layout may have been reordered, so numeric events are left alone and show
// read-only in the portal.
// Note: updating tenant_site_config bumps its `updated_at`, which the sitemap
// uses as <lastmod>.
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import {
  planSectionIdBackfill,
  rewriteLegacyPath,
} from "../lib/waas/sections/backfill";

interface Target {
  table: "tenant_site_variants" | "tenant_site_config";
  column: "sections_json" | "active_sections_json";
  /** Extra columns to read. Variants also own the edit history. */
  extra: string;
}

const TARGETS: Target[] = [
  {
    table: "tenant_site_variants",
    column: "sections_json",
    extra: ", variant_index",
  },
  { table: "tenant_site_config", column: "active_sections_json", extra: "" },
];

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const tenantIdx = args.indexOf("--tenant");
  const tenantId = tenantIdx >= 0 ? args[tenantIdx + 1] : undefined;
  if (tenantIdx >= 0 && !tenantId) throw new Error("--tenant needs a value");

  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL;
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Set NEXT_PUBLIC_WAAS_SUPABASE_URL and WAAS_SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  const host = new URL(url).host;
  console.log(
    `${apply ? "APPLY" : "DRY RUN"} against ${host}` +
      (tenantId ? ` (tenant ${tenantId})` : " (all tenants)"),
  );

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const totals = {
    rows: 0,
    update: 0,
    alreadyDone: 0,
    skipped: 0,
    conflicts: 0,
    errors: 0,
    strayEntries: 0,
    eventsRewritten: 0,
    eventsUnresolved: 0,
  };

  /**
   * Rewrite old position-based history paths for ONE variant, using the array
   * positions as they are right now (ids are added in place, so positions do
   * not move). Only called in the same run that adds the ids: on a later run
   * the layout may have been reordered and a position would map to the wrong
   * section. Events that cannot be resolved are left as they are and show
   * read-only in the portal.
   */
  async function rewriteEvents(
    eventTenantId: string,
    variantIndex: number,
    sectionsWithIds: unknown[],
  ) {
    const { data: events, error: readError } = await supabase
      .from("client_variant_edit_events")
      .select("id, field_path")
      .eq("tenant_id", eventTenantId)
      .eq("variant_index", variantIndex)
      .like("field_path", "sections[%");
    if (readError) {
      console.error(`  history read failed: ${readError.message}`);
      totals.errors++;
      return;
    }
    for (const ev of (events ?? []) as Array<{
      id: string;
      field_path: string;
    }>) {
      const next = rewriteLegacyPath(ev.field_path, sectionsWithIds);
      if (next === null) {
        // Already an id path, or the position holds no real section.
        if (/^sections\[\d+\]/.test(ev.field_path)) totals.eventsUnresolved++;
        continue;
      }
      totals.eventsRewritten++;
      if (!apply) continue;
      const { error: updateError } = await supabase
        .from("client_variant_edit_events")
        .update({ field_path: next })
        .eq("id", ev.id)
        .eq("field_path", ev.field_path); // only if unchanged
      if (updateError) {
        console.error(`  history ${ev.id}: ${updateError.message}`);
        totals.errors++;
      }
    }
  }

  for (const { table, column, extra } of TARGETS) {
    let query = supabase
      .from(table)
      .select(`id, tenant_id, updated_at, ${column}${extra}`);
    if (tenantId) query = query.eq("tenant_id", tenantId);
    const { data, error } = await query;
    if (error) {
      console.error(`${table}: read failed: ${error.message}`);
      totals.errors++;
      continue;
    }
    for (const row of (data ?? []) as unknown as Array<
      Record<string, unknown>
    >) {
      totals.rows++;
      const plan = planSectionIdBackfill(row[column]);
      totals.strayEntries += plan.strayEntries;
      if (plan.strayEntries > 0) {
        console.warn(
          `${table} ${row.id}: ${plan.strayEntries} entry/entries in ${column} are not sections (left untouched)`,
        );
      }
      if (plan.action === "skip-already-done") {
        totals.alreadyDone++;
        continue;
      }
      if (plan.action !== "update") {
        totals.skipped++;
        continue;
      }
      totals.update++;
      console.log(
        `${table} ${row.id} (tenant ${row.tenant_id}): add ids ${plan.added.join(", ")}`,
      );
      if (!apply) {
        if (table === "tenant_site_variants") {
          await rewriteEvents(
            row.tenant_id as string,
            row.variant_index as number,
            plan.next ?? [],
          );
        }
        continue;
      }

      let write = supabase
        .from(table)
        .update({ [column]: plan.next })
        .eq("id", row.id as string);
      // Optimistic guard: only write if nobody changed the row since we read it.
      write =
        row.updated_at == null
          ? write.is("updated_at", null)
          : write.eq("updated_at", row.updated_at as string);
      const { data: written, error: writeError } = await write.select("id");
      if (writeError) {
        console.error(
          `${table} ${row.id}: write failed: ${writeError.message}`,
        );
        totals.errors++;
      } else if (!written || written.length === 0) {
        console.warn(
          `${table} ${row.id}: changed since read, skipped (re-run)`,
        );
        totals.conflicts++;
      } else if (table === "tenant_site_variants") {
        await rewriteEvents(
          row.tenant_id as string,
          row.variant_index as number,
          plan.next ?? [],
        );
      }
    }
  }

  console.log(
    `\n${apply ? "Applied" : "Would update"}: ${totals.update} row(s). ` +
      `Already done: ${totals.alreadyDone}. Skipped (empty/not an array): ${totals.skipped}. ` +
      `Stray non-section entries: ${totals.strayEntries}. ` +
      `History events ${apply ? "rewritten" : "to rewrite"}: ${totals.eventsRewritten}; ` +
      `left as is (no matching section, stay read-only): ${totals.eventsUnresolved}. ` +
      `Conflicts: ${totals.conflicts}. Errors: ${totals.errors}. Rows read: ${totals.rows}.`,
  );
  if (!apply) console.log("Nothing was written. Re-run with --apply to write.");
  if (totals.errors > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
