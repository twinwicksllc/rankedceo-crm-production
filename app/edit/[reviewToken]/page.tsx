// =============================================================================
// app/edit/[reviewToken]/page.tsx
// Client self-service editor — server entry point.
// Resolves the review token, loads the selected variant, builds the editable
// field list, and hands it off to the EditorShell client component.
// =============================================================================

import { notFound }            from 'next/navigation'
import { createClient }        from '@supabase/supabase-js'
import { resolveClientEditSession } from '@/lib/waas/client-edit/edit-session'
import { buildEditableFields } from '@/lib/waas/client-edit/editable-fields'
import { EditorShell }         from './editor-shell'
import type { SectionConfig }  from '@/lib/waas/templates/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { reviewToken: string }
}

// ---------------------------------------------------------------------------
// Server-only helper: load the sections_json for the currently-selected variant
// ---------------------------------------------------------------------------

async function loadSelectedVariantSections(
  tenantId:       string,
  variantIndex:   number | null,
): Promise<SectionConfig[]> {
  if (variantIndex == null) return []

  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: row } = await supabase
    .from('tenant_site_variants')
    .select('sections_json')
    .eq('tenant_id', tenantId)
    .eq('variant_index', variantIndex)
    .single()

  if (!row) return []

  const sections = (row as { sections_json: unknown }).sections_json
  return Array.isArray(sections) ? (sections as SectionConfig[]) : []
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ClientEditorPage({ params }: PageProps) {
  const reviewToken = params.reviewToken

  const result = await resolveClientEditSession(reviewToken)
  if (!result.ok) {
    // not_found / invalid_token → 404; other errors surface as 404 too
    // so we never leak internals on the client-facing URL.
    notFound()
  }

  const session  = result.session
  const sections = await loadSelectedVariantSections(
    session.tenantId,
    session.selectedVariantIndex,
  )

  const editableFields = buildEditableFields({
    sections,
    brandConfig: session.brandConfig,
  })

  return (
    <EditorShell
      session={{
        tenantId:             session.tenantId,
        slug:                 session.slug,
        businessName:         session.businessName,
        reviewToken:          session.reviewToken,
        selectedVariantIndex: session.selectedVariantIndex,
        selectedTemplateSlug: session.selectedTemplateSlug,
        permissions:          session.permissions,
        approvalAt:           session.approvalAt,
        approvalLocked:       session.approvalLocked,
      }}
      initialFields={editableFields}
    />
  )
}
