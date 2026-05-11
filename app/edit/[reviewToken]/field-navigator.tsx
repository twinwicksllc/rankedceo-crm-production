'use client'

// =============================================================================
// app/edit/[reviewToken]/field-navigator.tsx
// Left-panel list of editable fields, grouped by section/brand.
// - text / long_text / color / image → clicking opens the inline edit modal
// - toggle → renders as an inline switch; no modal
// =============================================================================

import { useMemo, useState } from 'react'
import type { EditableField, FieldGroup } from '@/lib/waas/client-edit/editable-fields'

interface FieldNavigatorProps {
  groups:       FieldGroup[]
  onFieldClick: (f: EditableField) => void
  onToggle:     (f: EditableField, enabled: boolean) => void
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
    case 'font':      return 'Font'
    case 'toggle':    return ''
  }
}

export function FieldNavigator({ groups, onFieldClick, onToggle, disabled }: FieldNavigatorProps) {
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

  const totalEditableFields = groups.reduce(
    (sum, g) => sum + g.fields.filter((f) => f.kind !== 'toggle').length,
    0,
  )

  return (
    <>
      {/* Navigator header */}
      <div className="shrink-0 border-b border-slate-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-900">Edit your website</h2>
          <span className="text-[11px] text-slate-500">
            {totalEditableFields} field{totalEditableFields === 1 ? '' : 's'}
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
            No fields match &ldquo;{query}&rdquo;.
          </div>
        )}

        {filtered.map((group) => (
          <div key={group.group} className="border-b border-slate-100">
            <div className="sticky top-0 bg-slate-50/95 backdrop-blur px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {group.group}
            </div>
            <ul className="divide-y divide-slate-100">
              {group.fields.map((f) =>
                f.kind === 'toggle'
                  ? <ToggleRow key={f.id} field={f} onToggle={onToggle} disabled={disabled} />
                  : <EditableRow key={f.id} field={f} onFieldClick={onFieldClick} disabled={disabled} />,
              )}
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

// ---------------------------------------------------------------------------
// Editable field row (text / long_text / color / image)
// ---------------------------------------------------------------------------

function EditableRow({
  field, onFieldClick, disabled,
}: {
  field: EditableField
  onFieldClick: (f: EditableField) => void
  disabled?: boolean
}) {
  const badge = kindBadge(field.kind)
  return (
    <li>
      <button
        type="button"
        onClick={() => !disabled && onFieldClick(field)}
        disabled={disabled}
        className={`w-full text-left px-3 py-2.5 transition-colors ${
          disabled
            ? 'cursor-not-allowed opacity-60'
            : 'hover:bg-blue-50/60 active:bg-blue-100/60'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-[13px] font-medium text-slate-900 truncate">
            {field.label}
          </span>
          {badge && (
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {badge}
            </span>
          )}
        </div>
        <div className="text-[12px] text-slate-500 truncate">
          {field.kind === 'color'
            ? <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded border border-slate-300"
                  style={{ backgroundColor: field.value || '#ffffff' }}
                />
                <span>{field.value || '—'}</span>
              </span>
            : field.kind === 'font'
            ? <span
                className="inline-block truncate"
                style={{ fontFamily: `'${field.value}', sans-serif` }}
              >
                {field.value || 'Inter'}
              </span>
            : truncate(field.value || '—')}
        </div>
      </button>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Toggle row — section visibility switch
// maxLength === -1 signals a required section (convention from editable-fields.ts)
// ---------------------------------------------------------------------------

function ToggleRow({
  field, onToggle, disabled,
}: {
  field: EditableField
  onToggle: (f: EditableField, enabled: boolean) => void
  disabled?: boolean
}) {
  const isRequired = field.maxLength === -1
  const isEnabled  = field.value === 'true'
  const isDisabled = disabled || isRequired

  return (
    <li>
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="min-w-0">
          <span className="text-[13px] font-medium text-slate-900 truncate block">
            {field.label}
          </span>
          {isRequired && (
            <span className="text-[11px] text-slate-400">Required — always shown</span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          aria-label={`Toggle ${field.label} section`}
          disabled={isDisabled}
          onClick={() => !isDisabled && onToggle(field, !isEnabled)}
          title={isRequired ? 'This section is required and cannot be hidden' : undefined}
          className={`relative ml-3 inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
            isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          } ${isEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              isEnabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </li>
  )
}
