# B4 + B3: One builder, client restructure, admin handoff (plan)

Status: **APPROVED by Tommy (2026-10-12). PR 1 merged (#279); PR 2 (stable ids) open as a draft.** Decisions are in section 5.
Decisions this plan serves: DEC-0007 (one consistent builder for the client, final handed to admins for review and upsell), B3 (let the client restructure), DEC-0005/0006/0008 (extra pages, lead form, analytics are team-sold).
Verified against `main` @ `20b5b30` by reading code. Anything not verified is marked **unverified**.

## 1. What exists today (verified)

| Piece | What it is | Where |
|---|---|---|
| Section system (the real one) | A site is a list of `SectionConfig { section, enabled, order, config, content }`. 12 section types. Stored as JSON in `tenant_site_variants.sections_json` (3 variants per tenant) and copied to `tenant_site_config.active_sections_json` for the live site. | `lib/waas/templates/types.ts`, `app/_sites/[site]/page.tsx`, `lib/waas/actions/admin/client-review.ts` |
| Client portal editor | Edits text/color/image/font and on/off per section. Each edit is addressed by a path such as `sections[3].content.headline`. After saving, the action inserts a history event, but that insert is explicitly non-fatal (`content-edit.ts`, "the edit was saved; log but don't fail"), so a saved edit can exist with no history row. Client edits do not write a `tenant_site_versions` snapshot (no reference in `lib/waas/actions/client-edit/`); the admin actions do. | `app/edit/[reviewToken]/`, `lib/waas/client-edit/`, `lib/waas/actions/client-edit/content-edit.ts` |
| Admin reorder | Drag-and-drop reorder panel for the 3 variants, using `@dnd-kit`. Server action `reorderVariantSections` works by section type and rejects duplicates. | `app/admin/dashboard/[tenantId]/section-reorder-panel.tsx`, `lib/waas/actions/admin/variants.ts` |
| Block builder (the second one) | 8 block types (hero, heading, text, image, button, columns, spacer, divider). Only used in onboarding step 6. Saves `website_blocks` and `website_html` on `tenant_site_config`. | `components/waas/website-builder/`, `lib/waas/website-builder/`, `lib/waas/actions/onboarding/step-builder.ts` |

Key fact for B4: a search of `app/`, `lib/` and `components/` found **no code that reads `website_blocks` or `website_html`** outside the save action. So what a client builds in onboarding step 6 does not feed the portal, the admin review, or the live site. It is a dead end today.

Key fact for B3: reorder already exists for admins, and the library for drag and drop is already installed. The client has no reorder, add or duplicate.

## 2. Bug found while planning (verify before fixing)

Edit paths use the section's `order` value as an array index (`sections[${order}]`). Generators write `order` starting at **1** (`order: index + 1` in `templates/registry.ts`, `generate-initial-site/_shared.ts`, `admin/variants.ts` and others), while arrays start at 0.

I ran the real `buildEditableFields` and `setValueAtPath` on sample sections built the way the generators build them (hero=1, about=2, faq=3):

- Editing the **hero** headline wrote the text into the **about** section.
- Editing the **last** section's headline appended a stray extra entry at the end of the array instead of changing the section.

The editor's own label code (`order + 1`, so "1. Hero") assumes `order` starts at 0, which supports that the mismatch is unintended.

**Unverified:** whether live `sections_json` rows use 1-based `order` (as the generators suggest) or 0-based. This needs a read-only look at one real variant row, or a look at what the portal does on a live tenant. Until checked, I will not call it confirmed in production.

**Status: fixed in plan PR 1.** Edit paths, field ids and AI-regeneration paths now use the section's index in the stored `sections_json` array, and `order` is used only for display order. The fix is correct whether live rows are 0-based or 1-based, so the live-data check is no longer needed for the fix. It is still worth one look at a live tenant to see whether past client edits landed in the wrong section (see PR 1 notes). Old history events keep their stored paths; undo re-applies them as stored.

## 3. Recommended design

### 3.1 One model: the section system
Keep the section system as the single source of truth. It already renders the live site, powers the portal, has versions and history, and has the admin tools. The block builder does none of that.

### 3.2 Stable section IDs
Add an `id` to every `SectionConfig` (for example `hero`, `about`, `services-2`). Addressing edits by position breaks the moment sections move; addressing by id does not.

- Edit paths gain an id form: `sections[id=services-2].content.headline`. Numeric paths are still accepted for display only (see "Legacy history and undo" below).
- **Ids are written once and not changed.** A one-time JSON backfill gives every existing section an id (the first of a type gets `id = type`) and saves it. After that the id is permanent: removing a section never renumbers the others, and a newly added section gets a fresh id with a random 6-character suffix (`newSectionId`, for example `services-k3f9a2`) that is checked against the ids in use plus any retired ids the caller supplies (for example ids found in edit history). No counter needs to be stored. This is not a hard guarantee: a deleted id that nobody passes in could be drawn again (about 1 in 2 billion per draw). If a hard guarantee is wanted, PR 3 would store a list of retired ids with the layout (needs a place to keep it, since `sections_json` is a bare array). (Changed from the first draft of this plan, which used a stored counter `nextSectionSeq`.) Computing ids on read is not enough, because deleting the first duplicate would renumber the rest and old history could then point at new content.
- No database schema migration is needed for the ids themselves (it is JSON), but the backfill is a real data write and is its own PR (PR 2), run on QA first.
- This also unlocks duplicate: today identity is the section type, so two "services" sections cannot exist. Note that existing code keyed by section type (`reorderVariantSections` in `admin/variants.ts`, `section-regen.ts`, the sitemap) assumes one section per type, so PR 2 must move each of them to ids before duplicates are allowed.

#### Legacy history and undo
Undo re-applies a stored event's `field_path` as is (`history.ts`). An old event such as `sections[3]...` therefore edits whichever section sits at position 3 after a reorder, which could corrupt a different section. The plan:
- In the same step as the id backfill, each existing event for that variant is rewritten from its numeric path to the id path, resolved by **array position** (because the editor writes the number straight into the array; see section 2), not by the `order` field.
- An event whose position cannot be resolved (for example the stray entry the section 2 bug can append) is marked not undoable, and the history panel shows it as read-only.
- Undo rejects any numeric path once the variant has ids, so it can never apply a position-based path after a reorder.

**Status: implemented in plan PR 2 (draft PR).** What is in it: `lib/waas/sections/section-ids.ts` (id rules, path resolver, undo guard), `lib/waas/sections/backfill.ts` and `scripts/backfill-section-ids.ts` (dry run by default; writes only with `--apply`), id edit paths in the editor, history and regeneration, and the type-keyed code moved to ids (`reorderVariantSections`, the reorder panel, `resolveSections`, the sitemap, `section-regen`). Generation and admin saves now assign ids. Not changed yet: `setSectionConfig` and `upsertSection` still look up a section by type, which is only correct for the first section of a type (that one keeps `id = type`); this must be revisited in PR 3 before the Layout tab can add duplicates. The backfill has not been run against any database.

### 3.3 Client "Layout" tab (B3)
Same pattern as Shopify, Squarespace and Wix, with guardrails:

1. Drag to reorder (reuse the admin panel's `@dnd-kit` code), plus up/down buttons for keyboard and mobile.
2. Show/hide each section.
3. Add a section from a curated library of the 12 types (no blank boxes).
4. Duplicate a section (limited per type, see guardrails).
5. Remove a section the client added.

Guardrails (enforced on the server, not only in the UI):
- Hero is always first and cannot be removed or hidden. **Services and booking also cannot be removed or hidden.** The review and deploy checks already require `hero`, `services` and `booking` to be enabled (`getVariantCoreSectionFailures` in `admin/_validation.ts`, `getCoreSectionFailures` used by `compute-deploy-readiness.ts`). Today the client editor only locks `hero` and `booking` (`REQUIRED_SECTION_IDS` in `editable-fields.ts`), so a client can already hide Services and then fail readiness. PR 3 adds `services` to the locked set so the Layout tab and the existing readiness contract agree. The readiness rules themselves are not changed.
- Maximum copies per section type: **3**, the same number as the client's regeneration limit (DEC-0015). Hero and booking are limited to 1 because they are locked. The limit is one constant in code (`MAX_SECTIONS_PER_TYPE = 3`), not tied to the `client_regen_quota` database column, so changing one does not change the other.
- The reviews section is not offered in the add library until real reviews can be entered (see DEC-0004). Otherwise the client could add the fake placeholder reviews back.
- Every layout change records a version snapshot and a history event, **in the same database transaction as the layout write.** Today's content edits do not do this (the history insert can fail silently), and layout changes are bigger, so they must not copy that behavior.

One server action, `applyLayoutChange`, validates the whole new layout (in code), renumbers `order` consistently, then calls **one Postgres function (RPC)** that updates the variant sections, inserts the version snapshot and inserts the history event atomically: all three succeed or none do. It uses the same permission gate as `updateClientVariantContent` (`canClientEditVariant`). The repo already uses RPCs (`resolve_tenant_by_hostname`, `capture_audit_lead`, and others in `lib/waas/supabase.ts`), so the pattern is not new.

**This needs one new SQL function, so it is a database change.** It ships as a migration file in the repo, is applied by the team (not by me), and is tested on QA first. That cannot happen until a QA database exists, and it is held until the shared Supabase cleanup (DEC-0013) is settled. If that blocks us, the fallback is to write the layout first and the history row second, with a reconciliation job that flags any layout version that has no history row. I do not recommend the fallback.

### 3.4 Onboarding step 6
The block builder stops being a separate product. Onboarding step 6 becomes the same Layout editor the client gets later (DEC-0014). The 8-block editor and its `website_blocks` / `website_html` columns are retired in PR 5 (the columns stay in the database untouched; no migration).

### 3.5 Admin handoff (DEC-0007)
Out of scope for this stage (DEC-0016). The admin already has client review and variant tools. What admins do after a client onboards (review, upsell, add-ons such as extra pages, lead form, analytics, Terms/Privacy) is a separate, larger piece of planning and will get its own plan. This plan only has to make sure the client's finished layout is saved in the same section model the admin tools already read, so the handoff needs no conversion.

## 4. Delivery in small PRs (each reviewed and merged by Tommy)

1. **Fix the order/index mismatch** (small, with tests). Needs the live-data check first (see section 6).
2. **Stable ids, one-time backfill, id-based paths, legacy history rewrite and undo guard**, with tests for the path patcher, backfill, never-reused ids and undo. Moves type-keyed code (`reorderVariantSections`, `section-regen`, sitemap) to ids.
3. **`applyLayoutChange` server action + validation + the transactional RPC migration**, with tests for every guardrail. Locks `services` as well as `hero` and `booking`.
4. **Client Layout tab UI** (reorder, show/hide, add, duplicate, remove).
5. **Onboarding step 6 replacement** with the Layout editor (DEC-0014).

Each PR runs typecheck, tests and lint on the files it changes before pushing (DEC-0012). PR 1 and 2 are the riskiest because they touch how every edit is saved.

## 5. Decisions (Tommy, 2026-10-12)

- **DEC-0014:** Onboarding step 6 becomes the same Layout editor the client gets later. One consistent builder.
- **DEC-0015:** Maximum copies per section type = 3, matching the client regeneration limit (verified: `client_regen_quota` defaults to 3 in `supabase/migrations/waas/026_waas_variant_regenerations.sql`). Hero and booking: 1.
- **DEC-0016:** The admin Add-ons panel is not part of client onboarding. It moves to a separate "what do admins do once a client onboards" plan.

## 6. Not verified

- Whether live rows use 1-based or 0-based `order` (section 2).
- Whether any production tenant relies on a duplicated section type.
- How the portal behaves in production today when editing the last section.
- Production database state (no Supabase access set up; none needed for this plan).
