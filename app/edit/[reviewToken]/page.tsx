// =============================================================================
// app/edit/[reviewToken]/page.tsx
// Client self-service editor — server entry point.
//
// Phase 6.1: Added portal home (Overview tab).
//   ?tab=overview  → PortalHome (default when tab is absent or 'overview')
//   ?tab=edit      → EditorShell (full editor)
//   ?tab=history   → EditorShell with history panel open (?tab=history&history=1)
//
// Resolves the review token, loads the selected variant, builds the editable
// field list, and hands the data to the appropriate shell component.
// =============================================================================

import { notFound }                from 'next/navigation'
import { createClient }            from '@supabase/supabase-js'
import { resolveClientEditSession } from '@/lib/waas/client-edit/edit-session'
import { buildEditableFields }     from '@/lib/waas/client-edit/editable-fields'
import { getTenantPortalData }     from '@/lib/waas/actions/client-edit'
import { PortalShell }             from './portal-shell'
import type { SectionConfig }      from '@/lib/waas/templates/types'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params:      { reviewToken: string }
  searchParams: { tab?: string }
}

// ---------------------------------------------------------------------------
// Server-only helper: load the sections_json for the currently-selected variant
// ---------------------------------------------------------------------------

async function loadSelectedVariantSections(
  tenantId:     string,
  variantIndex: number | null,
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

export default async function ClientEditorPage({ params, searchParams }: PageProps) {
  const reviewToken = params.reviewToken
  const tab         = searchParams?.tab ?? 'overview'

  const result = await resolveClientEditSession(reviewToken)
  if (!result.ok) {
    notFound()
  }

  const session = result.session

  // ------------------------------------------------------------------
  // Tab: overview — load portal data (lightweight) and show portal home
  // ------------------------------------------------------------------
  if (tab === 'overview') {
    const portalResult = await getTenantPortalData(reviewToken)

    return (
      <PortalShell
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
        portalData={portalResult.success ? (portalResult.data ?? null) : null}
        activeTab="overview"
      />
    )
  }

  // ------------------------------------------------------------------
  // Tab: edit or history — load sections and show the editor shell
  // ------------------------------------------------------------------
  const sections = await loadSelectedVariantSections(
    session.tenantId,
    session.selectedVariantIndex,
  )

  const editableFields = buildEditableFields({
    sections,
    brandConfig: session.brandConfig,
  })

  return (
    <PortalShell
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
      portalData={null}
      activeTab={tab === 'history' ? 'history' : 'edit'}
      editorProps={{ initialFields: editableFields }}
    />
  )
}
