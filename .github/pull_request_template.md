## What changed and why
<!-- Write this from `git diff --stat` after your last commit. -->

## Before you push (see docs/engineering/COPILOT_FINDINGS_CATALOG.md)
- [ ] `npm run check` passes (typecheck, lint, tests)
- [ ] Every claim in docs or this description was checked against the code with a command
- [ ] This description matches the final diff
- [ ] New inputs or flags are validated (no `!!value` on request flags) and added to cache keys where relevant
- [ ] Loading and error states reset in `finally`; storage access is in try/catch
- [ ] UI: labels on inputs, `aria-hidden` on decorative icons, visible focus, no status by color or emoji alone
- [ ] New route or action: who can call it is stated and enforced; no PII in URLs; HTML values escaped
- [ ] New enum values added to every type, schema and switch that lists them
- [ ] SQL: boolean columns are `NOT NULL DEFAULT`, migrations are idempotent
