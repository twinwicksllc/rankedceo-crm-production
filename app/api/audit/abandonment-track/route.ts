// =============================================================================
// app/api/audit/abandonment-track/route.ts
//
// Tracks audit views and "Get Started" CTA events.
// Detects abandonment when audit is viewed but no onboarding starts within time window.
//
// POST /api/audit/abandonment-track
// Body: {
//   auditId: string
//   event: 'view' | 'get_started_click'
//   email?: string (required for view events)
//   tradeType?: string (optional, for analytics)
// }
// =============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrackingRequest {
  auditId:     string
  event:       'view' | 'get_started_click'
  email?:      string
  tradeType?:  string
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TrackingRequest

    const { auditId, event, email, tradeType } = body

    // Validate required fields
    if (!auditId || !event) {
      return NextResponse.json(
        { error: 'auditId and event are required' },
        { status: 400 },
      )
    }

    // For view events, email is required (used to detect abandonment later)
    if (event === 'view' && !email) {
      return NextResponse.json(
        { error: 'email required for view events' },
        { status: 400 },
      )
    }

    // Initialize Supabase
    const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
    const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      console.error('[abandonment-track] Supabase env vars not set')
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      )
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Handle 'view' event: upsert abandonment tracking record
    if (event === 'view') {
      const { error: upsertError } = await supabase
        .from('audit_abandonment_tracking')
        .upsert(
          {
            audit_id: auditId,
            email: email!,
            trade_type: tradeType || null,
            viewed_at: new Date().toISOString(),
            get_started_at: null, // Will be updated if user converts
            abandoned: true,       // Assume abandoned until proven otherwise
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'audit_id,email' },
        )

      if (upsertError) {
        // Gracefully handle if table doesn't exist yet
        if (upsertError.message?.includes('does not exist')) {
          console.warn('[abandonment-track] audit_abandonment_tracking table not found, skipping track')
          return NextResponse.json({ success: true, skipped: true })
        }
        throw upsertError
      }

      return NextResponse.json({ success: true, event: 'view' })
    }

    // Handle 'get_started_click' event: mark as converted (not abandoned)
    if (event === 'get_started_click') {
      const { error: updateError } = await supabase
        .from('audit_abandonment_tracking')
        .update({
          get_started_at: new Date().toISOString(),
          abandoned: false,
          updated_at: new Date().toISOString(),
        })
        .eq('audit_id', auditId)

      if (updateError) {
        if (updateError.message?.includes('does not exist')) {
          console.warn('[abandonment-track] audit_abandonment_tracking table not found, skipping track')
          return NextResponse.json({ success: true, skipped: true })
        }
        throw updateError
      }

      return NextResponse.json({ success: true, event: 'get_started_click' })
    }

    return NextResponse.json({ error: 'Unknown event type' }, { status: 400 })
  } catch (err) {
    console.error('[abandonment-track] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
