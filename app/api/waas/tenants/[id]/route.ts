// =============================================================================
// WaaS API: Single Tenant
// GET    /api/waas/tenants/[id] — Get tenant by ID
// PATCH  /api/waas/tenants/[id] — Update tenant
// DELETE /api/waas/tenants/[id] — Soft delete tenant
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getWaasAdminClient, updateTenantRecord, softDeleteTenant } from '@/lib/waas/supabase'
import type { WaasTenantUpdate } from '@/lib/waas/supabase'
import type { UpdateWaasTenantInput } from '@/lib/waas/types'

async function getCrmUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ---------------------------------------------------------------------------
// GET /api/waas/tenants/[id]
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCrmUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const waas = getWaasAdminClient()
    const { data, error } = await waas
      .from('tenants')
      .select('*')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json({ tenant: data })
  } catch (err) {
    console.error('[WaaS API] GET /tenants/[id] exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/waas/tenants/[id]
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCrmUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await req.json()) as UpdateWaasTenantInput

    // Build a typed update — only include known safe fields, never id/slug/created_at
    const update: WaasTenantUpdate = {}
    if (body.domain          !== undefined) update.domain          = body.domain          ?? null
    if (body.subdomain       !== undefined) update.subdomain       = body.subdomain       ?? null
    if (body.brand_config    !== undefined) update.brand_config    = body.brand_config
    if (body.package_tier    !== undefined) update.package_tier    = body.package_tier
    if (body.status          !== undefined) update.status          = body.status
    if (body.target_industry !== undefined) update.target_industry = body.target_industry ?? null
    if (body.target_location !== undefined) update.target_location = body.target_location ?? null
    if (body.crm_account_id  !== undefined) update.crm_account_id  = body.crm_account_id  ?? null

    try {
      const tenant = await updateTenantRecord(params.id, update)
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
      }
      return NextResponse.json({ tenant })
    } catch (updateErr: unknown) {
      const pgErr = updateErr as { message?: string }
      console.error('[WaaS API] PATCH /tenants/[id] error:', updateErr)
      return NextResponse.json({ error: pgErr?.message ?? 'Update failed' }, { status: 500 })
    }
  } catch (err) {
    console.error('[WaaS API] PATCH /tenants/[id] exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/waas/tenants/[id] — Soft delete
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCrmUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ok = await softDeleteTenant(params.id)

    if (!ok) {
      return NextResponse.json({ error: 'Failed to delete tenant' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[WaaS API] DELETE /tenants/[id] exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}