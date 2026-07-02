# Phase 5.4 — Admin Section Reorder (Drag-and-Drop)

**Branch:** `feature/phase5.4-section-reorder`  
**Builds on:** PR #35 (Phase 5.3)  
**Scope:** Replace the primitive Up/Down buttons + order number input in the
admin AI-Variants panel with a proper drag-and-drop section reorder UI per
variant, powered by `@dnd-kit/sortable` (already in package.json).

---

## 1. What exists today (Phase 5.3 state)

In `app/admin/dashboard/[tenantId]/ai-variants-panel.tsx`:

- Each section row shows: section name, Enabled checkbox, Order number input,
  "Up" button, "Down" button.
- `moveSection(variantIndex, sectionIndex, 'up'|'down')` swaps adjacent items
  and calls `normalizeSectionOrders()`.
- `updateSiteVariant` server action accepts `input.sections: SectionConfig[]`
  and writes to `sections_json` in Supabase.

**Problems with current approach:**

- Number input allows nonsense values (0, negative, duplicate orders).
- Up/Down buttons are slow for large reorders (e.g. moving section 1 to 7).
- No visual affordance — hard to understand current order at a glance.

---

## 2. What Phase 5.4 builds

### 2A — `SectionReorderPanel` component (new file)

A self-contained `'use client'` component:

```
app/admin/dashboard/[tenantId]/section-reorder-panel.tsx
```

**Props:**

```ts
interface SectionReorderPanelProps {
  variantIndex: number; // 1 | 2 | 3
  sections: SectionConfig[]; // current ordered list
  disabled?: boolean; // true when locked / saving
  onChange: (reordered: SectionConfig[]) => void; // called with new order
}
```

**Behaviour:**

- Uses `@dnd-kit/core` `DndContext` + `@dnd-kit/sortable` `SortableContext`
  with `verticalListSortingStrategy`.
- Each row is a `useSortable` item keyed by `section.section` (the SectionId
  string — guaranteed unique per variant).
- Drag handle: a `⠿` grip icon on the left of each row (only the handle
  triggers drag, not the whole row, so the enabled-checkbox row remains
  clickable).
- Row also shows: section name (title-cased), enabled badge (green dot / grey
  dot), order number pill (auto-updated as user drags).
- `onDragEnd`: recomputes `order` values (1-based, contiguous) and calls
  `onChange(reordered)`.
- When `disabled=true`: renders rows as static list (no drag handles), subtle
  opacity reduction.
- Accessibility: `KeyboardSensor` + `PointerSensor` both wired; screen reader
  announces "Moved [section] from position N to position M".

### 2B — Wire into `AIVariantsPanel`

Replace the section header row (name + checkbox + order input + Up/Down
buttons) with:

1. The section **enabled toggle** stays inline in the content area header (no
   change to its handler).
2. A new **"Reorder sections ⠿"** collapsible button above the sections list
   that reveals the `SectionReorderPanel` for that variant.
   - Collapsed by default; one open at a time (accordion pattern — opening one
     closes the others).
   - When open, the panel shows the drag list; when the user drops a row,
     `onChange` fires `moveSection`-equivalent logic then immediately closes the
     accordion.
3. Remove the `Order` number `<input>` and the `Up` / `Down` buttons from each
   section row (they are replaced by the drag panel).

### 2C — New server action `reorderVariantSections`

```
lib/waas/actions/admin.ts  (append)
```

A thin, intent-specific wrapper around `updateSiteVariant` that:

- Accepts `(tenantId, variantIndex, orderedSectionIds: SectionId[])`.
- Reconstructs the `SectionConfig[]` in the given order (preserving all other
  fields — enabled, config, content).
- Calls `updateSiteVariant` internally.
- Returns `ActionResult<void>`.

This keeps the client component clean: it never passes raw `SectionConfig[]`
over the wire — only the ordered array of `SectionId` strings.

---

## 3. Files

| File                                                       | Status     | Description                                          |
| ---------------------------------------------------------- | ---------- | ---------------------------------------------------- |
| `app/admin/dashboard/[tenantId]/section-reorder-panel.tsx` | **NEW**    | DnD sortable list component                          |
| `app/admin/dashboard/[tenantId]/ai-variants-panel.tsx`     | **MODIFY** | Wire SectionReorderPanel, remove Up/Down/order-input |
| `lib/waas/actions/admin.ts`                                | **MODIFY** | Append `reorderVariantSections` action               |

---

## 4. Commit & PR plan

Single branch, 2 atomic commits:

1. `feat(waas): Phase 5.4a — SectionReorderPanel with @dnd-kit/sortable`
2. `feat(waas): Phase 5.4b — wire reorder panel + reorderVariantSections action into admin`

**PR #36:** "Phase 5.4: Admin — Drag-and-drop section reorder"

---

## 5. Out-of-scope

- Client-side drag reorder (client editor) — deferred; client only toggles
  visibility (Phase 5.3c). Reorder is admin-only by design.
- Multi-variant simultaneous reorder — each variant panel is independent.
- Undo/redo UI — audit trail exists; UI comes in Phase 5.5.
