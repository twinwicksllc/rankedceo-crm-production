// =============================================================================
// WaaS API: Tenants
// GET  /api/waas/tenants  — List all tenants (admin only)
// POST /api/waas/tenants  — Create a new tenant (admin only)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getWaasAdminClient, createTenantRecord } from '@/lib/waas/supabase'
import type { WaasTenantInsert } from '@/lib/waas/supabase'
import type { CreateWaasTenantInput } from '@/lib/waas/types'

// ---------------------------------------------------------------------------
// Auth helper — ensures caller is authenticated CRM user
// ---------------------------------------------------------------------------
async function getCrmUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ---------------------------------------------------------------------------
// GET /api/waas/tenants
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  try {
    const user = await getCrmUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const waas = getWaasAdminClient()

    const { data, error } = await waas
      .from('tenants')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[WaaS API] List tenants error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tenants: data, count: data?.length ?? 0 })
  } catch (err) {
    console.error('[WaaS API] GET /tenants exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/waas/tenants
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const user = await getCrmUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as CreateWaasTenantInput

    // Basic validation
    if (!body.slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 })
    }
    if (!/^[a-z0-9-]+$/.test(body.slug)) {
      return NextResponse.json(
        { error: 'slug must be lowercase letters, numbers, and hyphens only' },
        { status: 400 }
      )
    }
    if (!body.brand_config?.business_name) {
      return NextResponse.json(
        { error: 'brand_config.business_name is required' },
        { status: 400 }
      )
    }
    if (!body.domain && !body.subdomain) {
      return NextResponse.json(
        { error: 'At least one of domain or subdomain is required' },
        { status: 400 }
      )
    }

    const insert: WaasTenantInsert = {
      slug:            body.slug,
      domain:          body.domain          ?? null,
      subdomain:       body.subdomain        ?? null,
      brand_config:    body.brand_config,
      package_tier:    body.package_tier     ?? 'hosting',
      status:          'onboarding',
      target_industry: body.target_industry  ?? null,
      target_location: body.target_location  ?? null,
      crm_account_id:  body.crm_account_id   ?? null,
      domain_verified: false,
    }

    try {
      const tenant = await createTenantRecord(insert)
      return NextResponse.json({ tenant }, { status: 201 })
    } catch (createErr: unknown) {
      const pgErr = createErr as { code?: string; message?: string }
      if (pgErr?.code === '23505') {
        return NextResponse.json(
          { error: 'A tenant with this slug, domain, or subdomain already exists' },
          { status: 409 }
        )
      }
      console.error('[WaaS API] Create tenant error:', createErr)
      return NextResponse.json({ error: pgErr?.message ?? 'Failed to create tenant' }, { status: 500 })
    }
  } catch (err) {
    console.error('[WaaS API] POST /tenants exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}