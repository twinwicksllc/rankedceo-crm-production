'use client'

// =============================================================================
// app/edit/[reviewToken]/inline-edit-modal.tsx
// Modal that opens when a navigator field is clicked.
// Supports text, long_text, color, and image field kinds.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import type { EditableField } from '@/lib/waas/client-edit/editable-fields'

interface InlineEditModalProps {
  field:       EditableField
  reviewToken: string
  onCancel:    () => void
  onSave:      (field: EditableField, newValue: string) => void
  isSaving:    boolean
}

export function InlineEditModal({ field, onCancel, onSave, isSaving }: InlineEditModalProps) {
  const [value, setValue] = useState(field.value)
  const inputRef  = useRef<HTMLInputElement | null>(null)
  const areaRef   = useRef<HTMLTextAreaElement | null>(null)

  // Auto-focus on open
  useEffect(() => {
    const t = setTimeout(() => {
      if (field.kind === 'long_text') {
        areaRef.current?.focus()
        areaRef.current?.select()
      } else {
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }, 50)
    return () => clearTimeout(t)
  }, [field.kind])

  // ESC to cancel, Cmd/Ctrl+Enter to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        onSave(field, value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [field, value, onCancel, onSave])

  const isDirty   = value !== field.value
  const maxLength = field.maxLength

  // -------------------------------------------------------------------------
  // Input rendering per kind
  // -------------------------------------------------------------------------

  const renderInput = () => {
    switch (field.kind) {
      case 'long_text':
        return (
          <textarea
            ref={areaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            maxLength={maxLength}
            placeholder="Enter text…"
            className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        )

      case 'color':
        return (
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="color"
              value={/^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#000000'}
              onChange={(e) => setValue(e.target.value.toUpperCase())}
              className="h-10 w-14 cursor-pointer rounded border border-slate-300"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="#2563EB"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        )

      case 'image':
        return (
          <div className="space-y-2">
            <input
              ref={inputRef}
              type="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {value && (
              <div className="rounded border border-slate-200 bg-slate-50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value}
                  alt="Preview"
                  className="max-h-32 mx-auto object-contain"
                  onError={(e) => { (e.currentTarget.style.display = 'none') }}
                />
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              Paste a public image URL. Direct upload coming soon.
            </p>
          </div>
        )

      case 'text':
      default:
        return (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={maxLength}
            placeholder="Enter text…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        )
    }
  }

  // -------------------------------------------------------------------------

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-sm pt-24 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xl rounded-lg bg-white shadow-2xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{field.label}</div>
            <div className="text-[11px] text-slate-500">{field.group}</div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {renderInput()}

          {maxLength != null && field.kind !== 'color' && field.kind !== 'image' && (
            <div className="mt-1.5 text-right text-[11px] text-slate-400">
              {value.length} / {maxLength}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <span className="text-[11px] text-slate-500">
            <kbd className="rounded border border-slate-300 bg-white px-1 font-mono text-[10px]">Esc</kbd> to cancel ·{' '}
            <kbd className="rounded border border-slate-300 bg-white px-1 font-mono text-[10px]">⌘↵</kbd> to save
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isDirty || isSaving}
              onClick={() => onSave(field, value)}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save change'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
