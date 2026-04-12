// =============================================================================
// WaaS API: Single Tenant
// GET    /api/waas/tenants/[id] — Get tenant by ID
// PATCH  /api/waas/tenants/[id] — Update tenant
// DELETE /api/waas/tenants/[id] — Soft delete tenant
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getWaasAdminClient } from '@/lib/waas/supabase'
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

    // Prevent direct ID/slug changes via PATCH
    const { ...updates } = body as any
    delete updates.id
    delete updates.slug
    delete updates.created_at

    const waas = getWaasAdminClient()
    const { data, error } = await waas
      .from('tenants')
      .update(updates)
      .eq('id', params.id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      console.error('[WaaS API] PATCH /tenants/[id] error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json({ tenant: data })
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

    const waas = getWaasAdminClient()
    const { error } = await waas
      .from('tenants')
      .update({ deleted_at: new Date().toISOString(), status: 'cancelled' } as any)
      .eq('id', params.id)
      .is('deleted_at', null)

    if (error) {
      console.error('[WaaS API] DELETE /tenants/[id] error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[WaaS API] DELETE /tenants/[id] exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}