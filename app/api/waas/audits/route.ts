// =============================================================================
// WaaS API: Audits
// GET  /api/waas/audits        — List audits (admin: all, public: by email token)
// POST /api/waas/audits        — Create a prospect audit (public — no auth needed)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getWaasAdminClient, createProspectAudit } from '@/lib/waas/supabase'
import type { CreateProspectAuditInput } from '@/lib/waas/types'

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
// GET /api/waas/audits
// Admin: all audits. Optional ?tenant_id= and ?status= filters.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const user = await getCrmUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenant_id')
    const status   = searchParams.get('status')
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

    const waas = getWaasAdminClient()
    let query = waas
      .from('audits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (tenantId) query = query.eq('tenant_id', tenantId)
    if (status)   query = query.eq('status', status)

    const { data, error } = await query

    if (error) {
      console.error('[WaaS API] List audits error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ audits: data, count: data?.length ?? 0 })
  } catch (err) {
    console.error('[WaaS API] GET /audits exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/waas/audits — Public (no auth required)
// Creates a prospect audit and queues it for the SEO worker.
// Returns the audit ID for client-side polling.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateProspectAuditInput

    // Validate required fields
    if (!body.target_url?.trim()) {
      return NextResponse.json({ error: 'target_url is required' }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(body.target_url.startsWith('http') ? body.target_url : `https://${body.target_url}`)
    } catch {
      return NextResponse.json({ error: 'target_url must be a valid URL' }, { status: 400 })
    }

    // Validate competitor URLs (max 3 for prospect audits)
    const competitorUrls = (body.competitor_urls ?? []).slice(0, 3)
    for (const url of competitorUrls) {
      try {
        new URL(url.startsWith('http') ? url : `https://${url}`)
      } catch {
        return NextResponse.json(
          { error: `Invalid competitor URL: ${url}` },
          { status: 400 }
        )
      }
    }

    // Validate email if provided
    if (body.requestor_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.requestor_email)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
      }
    }

    // Normalize URLs (ensure they have protocol)
    const normalizedTarget = body.target_url.startsWith('http')
      ? body.target_url
      : `https://${body.target_url}`

    const normalizedCompetitors = competitorUrls.map(url =>
      url.startsWith('http') ? url : `https://${url}`
    )

    // Create the audit record
    const auditId = await createProspectAudit({
      target_url:         normalizedTarget,
      competitor_urls:    normalizedCompetitors,
      requestor_name:     body.requestor_name,
      requestor_email:    body.requestor_email,
      requestor_phone:    body.requestor_phone,
      requestor_company:  body.requestor_company,
    })

    if (!auditId) {
      return NextResponse.json(
        { error: 'Failed to create audit. Please try again.' },
        { status: 500 }
      )
    }

    // TODO (Phase 2): Trigger SEO audit worker via queue/webhook
    // await triggerAuditWorker(auditId)

    return NextResponse.json(
      {
        audit_id:   auditId,
        status:     'pending',
        message:    'Audit queued. Poll /api/waas/audits/[id]/status for updates.',
        poll_url:   `/api/waas/audits/${auditId}/status`,
        expires_in: '90 days',
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[WaaS API] POST /audits exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}