#!/bin/bash
# Replays all supabase/migrations/*.sql (excluding waas/) in filename-sorted order
# against a blank Postgres database, stopping at the first error (mimicking
# Supabase's PR preview-branch behavior).
set -uo pipefail

export MAMBA_ROOT_PREFIX=/root/micromamba
MM=/root/.local/bin/micromamba
PSQL="$MM run -n pgtest psql -h 127.0.0.1 -p 5433 -U postgres -v ON_ERROR_STOP=1"

DB=${1:-migtest}
MIGDIR="$(dirname "$0")/../supabase/migrations"

echo "Resetting database $DB ..."
$MM run -n pgtest psql -h 127.0.0.1 -p 5433 -U postgres -c "DROP DATABASE IF EXISTS $DB;" 
$MM run -n pgtest psql -h 127.0.0.1 -p 5433 -U postgres -c "CREATE DATABASE $DB;"

echo "=== Applying supabase_bootstrap.sql (mimics fresh Supabase project) ==="
$MM run -n pgtest psql -h 127.0.0.1 -p 5433 -U postgres -d "$DB" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/supabase_bootstrap.sql" > /tmp/mig_out.txt 2>&1
if [ $? -ne 0 ]; then
  echo "!!! FAILED at supabase_bootstrap.sql !!!"
  cat /tmp/mig_out.txt
  exit 1
fi

cd "$MIGDIR" || exit 1

for f in $(ls -1 | grep -v '^waas$' | sort); do
  echo "=== Applying $f ==="
  $MM run -n pgtest psql -h 127.0.0.1 -p 5433 -U postgres -d "$DB" -v ON_ERROR_STOP=1 -f "$f" > /tmp/mig_out.txt 2>&1
  status=$?
  if [ $status -ne 0 ]; then
    echo "!!! FAILED at $f !!!"
    tail -n 40 /tmp/mig_out.txt
    exit 1
  fi
done

echo "=== ALL MIGRATIONS APPLIED SUCCESSFULLY ==="
