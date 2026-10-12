#!/usr/bin/env python3
"""
Scans supabase/migrations/*.sql (excluding waas/) in filename-sorted order
and, for every table, records:
  - the index (sort position) of the file where it is first CREATE TABLE'd
  - the index of the file where it is first REFERENCED (via `ON <table>`,
    `REFERENCES <table>`, or `ALTER TABLE <table>`)
Then reports any table referenced before it is created (or never created
at all within supabase/migrations/).
"""
import re
import os
import sys
import csv

MIGDIR = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations")
DUMP = os.path.join(os.path.dirname(__file__), "live_schema_dump.csv")

with open(DUMP) as f:
    reader = csv.DictReader(f)
    KNOWN_LIVE_TABLES = {r['table_name'].lower() for r in reader}

files = sorted(
    f for f in os.listdir(MIGDIR)
    if f.endswith(".sql") and os.path.isfile(os.path.join(MIGDIR, f))
)

create_re = re.compile(r'CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?', re.IGNORECASE)
ref_on_re = re.compile(r'\bON\s+(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?', re.IGNORECASE)
ref_alter_re = re.compile(r'\bALTER TABLE\s+(?:IF EXISTS\s+)?(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?', re.IGNORECASE)
ref_references_re = re.compile(r'\bREFERENCES\s+(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?', re.IGNORECASE)
ref_from_re = re.compile(r'\bFROM\s+(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?', re.IGNORECASE)
ref_into_re = re.compile(r'\bINTO\s+(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?', re.IGNORECASE)
ref_trigger_re = re.compile(r'\bON\s+(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?', re.IGNORECASE)

known_non_tables = {
    'auth', 'public', 'select', 'information_schema', 'pg_policies', 'pg_tables',
    'pg_constraint', 'pg_roles', 'pg_indexes', 'pg_class',
}

created_at = {}
referenced_at = {}  # table -> (file_idx, filename, snippet)

for idx, fname in enumerate(files):
    path = os.path.join(MIGDIR, fname)
    with open(path, 'r', errors='ignore') as f:
        content = f.read()

    for m in create_re.finditer(content):
        t = m.group(1).lower()
        if t in known_non_tables or t not in KNOWN_LIVE_TABLES:
            continue
        if t not in created_at:
            created_at[t] = (idx, fname)

    for pattern in (ref_on_re, ref_alter_re, ref_references_re, ref_from_re, ref_into_re):
        for m in pattern.finditer(content):
            t = m.group(1).lower()
            if t in known_non_tables or t not in KNOWN_LIVE_TABLES:
                continue
            if t not in referenced_at:
                referenced_at[t] = (idx, fname)

all_tables = set(created_at) | set(referenced_at)
problems = []
for t in sorted(all_tables):
    c = created_at.get(t)
    r = referenced_at.get(t)
    if r is None:
        continue
    if c is None:
        problems.append((t, None, r))
    elif r[0] < c[0]:
        problems.append((t, c, r))

print(f"Scanned {len(files)} files.\n")
print("=== Tables referenced before creation (or never created) ===")
for t, c, r in problems:
    created_str = f"created in {c[1]} (#{c[0]})" if c else "NEVER CREATED in supabase/migrations/"
    print(f"  {t}: first referenced in {r[1]} (#{r[0]}), {created_str}")

print(f"\nTotal problem tables: {len(problems)}")
