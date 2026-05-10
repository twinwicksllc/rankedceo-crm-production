'use client'

// =============================================================================
// app/admin/dashboard/[tenantId]/section-reorder-panel.tsx
//
// Drag-and-drop section reorder panel for the admin AI-Variants panel.
//
// Props:
//   variantIndex  — 1 | 2 | 3 (display only; used for aria labels)
//   sections      — current SectionConfig[] already sorted by .order
//   disabled      — true when the variant is locked or a save is in flight
//   onChange      — called with the new SectionConfig[] after a drop
//
// Uses @dnd-kit/core + @dnd-kit/sortable (verticalListSortingStrategy).
// Drag is initiated only via the grip handle, so the enabled-toggle row
// remains fully clickable without accidentally starting a drag.
// =============================================================================

import React, { useId } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { SectionConfig, SectionId } from '@/lib/waas/templates/types'

// ---------------------------------------------------------------------------
// Section display labels (mirrors editable-fields.ts SECTION_LABELS)
// ---------------------------------------------------------------------------

const SECTION_LABELS: Record<string, string> = {
  hero:           'Hero',
  services:       'Services',
  trust:          'Trust Badges',
  financing:      'Financing',
  booking:        'Booking',
  reviews:        'Reviews',
  about:          'About',
  faq:            'FAQ',
  'how-it-works': 'How It Works',
}

function sectionDisplayName(id: SectionId | string): string {
  return SECTION_LABELS[id] ?? id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// GripIcon — the drag handle affordance
// ---------------------------------------------------------------------------

function GripIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      className={className}
      fill="currentColor"
    >
      {/* 3×2 dot grid — classic drag handle */}
      <circle cx="5"  cy="4"  r="1.4" />
      <circle cx="11" cy="4"  r="1.4" />
      <circle cx="5"  cy="8"  r="1.4" />
      <circle cx="11" cy="8"  r="1.4" />
      <circle cx="5"  cy="12" r="1.4" />
      <circle cx="11" cy="12" r="1.4" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// SortableRow — one draggable section row
// ---------------------------------------------------------------------------

interface SortableRowProps {
  section:   SectionConfig
  position:  number   // 1-based display position
  total:     number
  disabled:  boolean
}

function SortableRow({ section, position, total, disabled }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.section, disabled })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity:   isDragging ? 0.45 : 1,
    zIndex:    isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 select-none ${
        isDragging
          ? 'border-blue-500/60 bg-slate-700 shadow-xl'
          : 'border-white/10 bg-slate-800/60 hover:border-white/20'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...(disabled ? {} : { ...listeners, ...attributes })}
        aria-label={`Drag to reorder ${sectionDisplayName(section.section)}, currently position ${position} of ${total}`}
        className={`shrink-0 rounded p-0.5 text-white/30 transition-colors ${
          disabled
            ? 'cursor-not-allowed'
            : 'cursor-grab active:cursor-grabbing hover:text-white/70 hover:bg-white/10'
        }`}
        tabIndex={disabled ? -1 : 0}
      >
        <GripIcon />
      </button>

      {/* Position pill */}
      <span className="w-6 shrink-0 text-center text-[11px] font-semibold text-white/40">
        {position}
      </span>

      {/* Section name */}
      <span className="flex-1 text-sm font-medium text-white/85">
        {sectionDisplayName(section.section)}
      </span>

      {/* Enabled indicator */}
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          section.enabled
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-white/5 text-white/30'
        }`}
      >
        {section.enabled ? 'on' : 'off'}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SectionReorderPanel — public component
// ---------------------------------------------------------------------------

export interface SectionReorderPanelProps {
  variantIndex: number
  sections:     SectionConfig[]
  disabled?:    boolean
  onChange:     (reordered: SectionConfig[]) => void
}

export function SectionReorderPanel({
  variantIndex,
  sections,
  disabled = false,
  onChange,
}: SectionReorderPanelProps) {
  const dndId   = useId()
  const ordered = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const ids     = ordered.map((s) => s.section)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require 6px movement before dragging starts — avoids accidental drags
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = ordered.findIndex((s) => s.section === active.id)
    const newIndex = ordered.findIndex((s) => s.section === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const next = arrayMove(ordered, oldIndex, newIndex)
      .map((section, index) => ({ ...section, order: index + 1 }))

    onChange(next)
  }

  return (
    <div
      role="region"
      aria-label={`Section order for variant ${variantIndex}`}
      className="rounded-xl border border-white/10 bg-slate-900/60 p-3"
    >
      {/* Header */}
      <div className="mb-2.5 flex items-center gap-2">
        <GripIcon className="text-white/30" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
          Drag to reorder
        </span>
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {ordered.map((section, index) => (
              <SortableRow
                key={section.section}
                section={section}
                position={index + 1}
                total={ordered.length}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {disabled && (
        <p className="mt-2 text-center text-[11px] text-white/30">
          Unlock variants to reorder sections
        </p>
      )}
    </div>
  )
}
