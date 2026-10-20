import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// The Supabase CLI applies migrations from `supabase/migrations/<version>_<name>.sql`
// (regexp `^([0-9]+)_(.*)\.sql$`, supabase/cli apps/cli-go/pkg/migration/file.go).
// `supabase db push` — which is what the hosted "Supabase Preview" check runs —
// merges two lists in `FindPendingMigrations` (apps/cli-go/pkg/migration/apply.go):
//   - remote versions, from `SELECT version FROM supabase_migrations.schema_migrations
//     ORDER BY version` (pure lexicographic string order), and
//   - local files, from `fs.ReadDir` (full *filename* order, ListLocalMigrations).
// If those two orders disagree the merge cannot line them up and the CLI fails with
// "Remote migration versions not found in local migrations directory."
//
// The orders disagree whenever one version string is a *prefix* of another, e.g.
// "000008" vs "0000085": in filename order the extra digit sorts before the "_"
// separator ("0000085_baseline" < "000008_fix", because '5' < '_'), but in version
// order "000008" < "0000085". That single inversion is what made the check red on
// every PR that touched `supabase/`. This test fails first, naming the files.
//
// A separate failure mode: two files sharing one version (e.g. the old
// `20240301000001_create_agent_conversations` / `..._normalize_calendly_uris` pair).
// `schema_migrations.version` is a primary key, so the second insert fails. The two
// files have identical versions, so the ordering/prefix checks above cannot see it;
// this test checks duplicates explicitly.
//
// Fix by renaming files so every version is unique and none is a prefix of another
// (keep versions the same length, or at least never let one be a prefix of another).

const MIGRATIONS_DIR = join("supabase", "migrations");
const FILE_RE = /^([0-9]+)_.*\.sql$/;

export interface MigrationEntry {
  file: string;
  version: string;
}

/** Top-level migration files in filename order, exactly as the CLI sees them. */
export function localMigrations(dir = MIGRATIONS_DIR): MigrationEntry[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && FILE_RE.test(e.name))
    .map((e) => ({ file: e.name, version: e.name.match(FILE_RE)![1] }))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

export function orderingProblems(entries: MigrationEntry[]): string[] {
  const problems: string[] = [];

  // 1. Every version must be unique (`schema_migrations.version` is a primary key).
  const byVersionMap = new Map<string, string[]>();
  for (const e of entries) {
    const files = byVersionMap.get(e.version) ?? [];
    files.push(e.file);
    byVersionMap.set(e.version, files);
  }
  for (const [version, files] of byVersionMap) {
    if (files.length > 1) {
      problems.push(`duplicate version "${version}" used by ${files.join(", ")}`);
    }
  }

  // 2. No version may be a prefix of another (that is the only way the CLI's
  //    lexicographic version sort and filename sort can disagree).
  for (const a of entries) {
    for (const b of entries) {
      if (a.version !== b.version && b.version.startsWith(a.version)) {
        problems.push(
          `version "${a.version}" (${a.file}) is a prefix of "${b.version}" (${b.file})`,
        );
      }
    }
  }

  // 3. Filename order must equal lexicographic version order.
  const byFile = entries.map((e) => e.version);
  const byVersion = [...byFile].sort();
  for (let i = 0; i < byFile.length; i++) {
    if (byFile[i] !== byVersion[i]) {
      problems.push(
        `filename order != version order at position ${i}: "${byFile[i]}" (filename) vs "${byVersion[i]}" (version-sorted)`,
      );
      break;
    }
  }

  return problems;
}

test("supabase migrations are ordered so `supabase db push` can merge local and remote", () => {
  const entries = localMigrations();
  assert.ok(entries.length > 10, "expected to find the migration files");
  assert.deepEqual(
    orderingProblems(entries),
    [],
    "Rename the file so every migration version is unique and none is a prefix of another; the Supabase CLI sorts local files by filename but remote versions lexicographically, and a duplicate or prefix pair makes them disagree.",
  );
});
