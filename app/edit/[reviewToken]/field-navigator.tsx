'use client'

// =============================================================================
// app/edit/[reviewToken]/field-navigator.tsx
// Left-panel list of editable fields, grouped by section/brand.
// Clicking a field opens the inline edit modal.
// =============================================================================

import { useMemo, useState } from 'react'
import type { EditableField, FieldGroup } from '@/lib/waas/client-edit/editable-fields'

interface FieldNavigatorProps {
  groups:       FieldGroup[]
  onFieldClick: (f: EditableField) => void
  disabled?:    boolean
}

function truncate(s: string, n = 50): string {
  if (!s) return ''
  return s.length > n ? s.slice(0, n).trim() + '…' : s
}

function kindBadge(kind: EditableField['kind']): string {
  switch (kind) {
    case 'text':      return 'Text'
    case 'long_text': return 'Paragraph'
    case 'color':     return 'Color'
    case 'image':     return 'Image'
  }
}

export function FieldNavigator({ groups, onFieldClick, disabled }: FieldNavigatorProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map((g) => ({
        group:  g.group,
        fields: g.fields.filter(
          (f) =>
            f.label.toLowerCase().includes(q) ||
            f.value.toLowerCase().includes(q) ||
            f.group.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.fields.length > 0)
  }, [groups, query])

  const totalFields = groups.reduce((sum, g) => sum + g.fields.length, 0)

  return (
    <>
      {/* Navigator header */}
      <div className="shrink-0 border-b border-slate-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-900">Edit your website</h2>
          <span className="text-[11px] text-slate-500">
            {totalFields} field{totalFields === 1 ? '' : 's'}
          </span>
        </div>
        <input
          type="search"
          placeholder="Search fields…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-8 rounded-md border border-slate-200 px-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        {disabled && (
          <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-2 py-1.5 text-[11px] text-amber-800">
            🔒 Editing locked — your design has been approved.
          </div>
        )}
      </div>

      {/* Scrollable field list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-500">
            No fields match “{query}”.
          </div>
        )}

        {filtered.map((group) => (
          <div key={group.group} className="border-b border-slate-100">
            <div className="sticky top-0 bg-slate-50/95 backdrop-blur px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {group.group}
            </div>
            <ul className="divide-y divide-slate-100">
              {group.fields.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => !disabled && onFieldClick(f)}
                    disabled={disabled}
                    className={`w-full text-left px-3 py-2.5 transition-colors ${
                      disabled
                        ? 'cursor-not-allowed opacity-60'
                        : 'hover:bg-blue-50/60 active:bg-blue-100/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[13px] font-medium text-slate-900 truncate">
                        {f.label}
                      </span>
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {kindBadge(f.kind)}
                      </span>
                    </div>
                    <div className="text-[12px] text-slate-500 truncate">
                      {f.kind === 'color'
                        ? <span className="inline-flex items-center gap-1.5">
                            <span
                              className="inline-block h-3 w-3 rounded border border-slate-300"
                              style={{ backgroundColor: f.value || '#ffffff' }}
                            />
                            <span>{f.value || '—'}</span>
                          </span>
                        : truncate(f.value || '—')}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer help */}
      <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500">
        Need help? Email{' '}
        <a href="mailto:support@rankedceo.com" className="text-blue-600 hover:underline">
          support@rankedceo.com
        </a>
      </div>
    </>
  )
}
