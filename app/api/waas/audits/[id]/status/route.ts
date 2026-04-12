// =============================================================================
// WaaS API: Audit Status Polling
// GET /api/waas/audits/[id]/status — Public polling endpoint (no auth required)
// Used by client after submitting an audit to check completion.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAuditStatus } from '@/lib/waas/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!params.id) {
      return NextResponse.json({ error: 'Audit ID is required' }, { status: 400 })
    }

    const result = await getAuditStatus(params.id)

    if (!result) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    // Set cache headers based on status
    const headers: Record<string, string> = {}

    if (result.status === 'completed') {
      // Cache completed audits for 5 minutes (they don't change)
      headers['Cache-Control'] = 'public, max-age=300, stale-while-revalidate=600'
    } else if (result.status === 'pending' || result.status === 'running') {
      // Don't cache in-progress audits — client is polling
      headers['Cache-Control'] = 'no-store'
    } else {
      headers['Cache-Control'] = 'public, max-age=60'
    }

    return NextResponse.json(result, { headers })
  } catch (err) {
    console.error('[WaaS API] GET /audits/[id]/status exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}