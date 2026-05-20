import { createClient } from '@supabase/supabase-js'
import type { SectionConfig, SectionId } from '@/lib/waas/templates/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
export const GEMINI_MODEL    = 'gemini-2.5-pro'


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('WaaS Supabase admin env vars not set')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export function extractList(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value
    .split(/[\n,;|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function cloneSections(sections: SectionConfig[]): SectionConfig[] {
  return sections.map((s) => ({
    ...s,
    config:  { ...s.config },
    content: s.content ? { ...s.content } : undefined,
  }))
}

export function upsertSection(
  sections: SectionConfig[],
  id:       SectionId,
  patch:    Partial<SectionConfig>,
): SectionConfig[] {
  const idx = sections.findIndex((s) => s.section === id)
  if (idx >= 0) {
    const existing = sections[idx]
    sections[idx] = {
      ...existing,
      ...patch,
      config:  { ...existing.config,  ...(patch.config  ?? {}) },
      content: patch.content !== undefined ? patch.content : existing.content,
    }
    return sections
  }
  const nextOrder = Math.max(0, ...sections.map((s) => s.order)) + 1
  sections.push({
    section: id,
    enabled: patch.enabled ?? true,
    order:   patch.order   ?? nextOrder,
    config:  patch.config  ?? {},
    content: patch.content,
  })
  return sections
}

export function normalizeOrder(sections: SectionConfig[]): SectionConfig[] {
  return [...sections]
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, order: i + 1 }))
}
