// =============================================================================
// app/api/audit/abandonment-check/route.ts
//
// Background job (cron or manual) to detect abandoned audits and trigger emails.
// Runs on schedule to find audits viewed but not converted, then sends
// abandonment emails at progressive intervals: 1h, 24h, 48h, 72h
//
// Call via: GET /api/audit/abandonment-check?token=YOUR_SECRET
// Or configure as Vercel Cron: /api/audit/abandonment-check
//
// =============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTenantNotification } from '@/lib/waas/services/notifications'
import type { NotificationType, NotificationTemplateData } from '@/lib/waas/services/notifications'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ABANDONMENT_STAGES = [
  { hours: 1, type: 'audit_abandoned_stage_1' as NotificationType },
  { hours: 24, type: 'audit_abandoned_stage_2' as NotificationType },
  { hours: 48, type: 'audit_abandoned_stage_3' as NotificationType },
  { hours: 72, type: 'audit_abandoned_stage_4' as NotificationType },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTimeAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

async function getAuditDetails(
  supabase: any,
  auditId: string,
): Promise<{
  businessName?: string
  auditScore?: number
  auditGrade?: string
  tradeType?: string
  topOpportunities?: string[]
} | null> {
  try {
    const { data } = await supabase
      .from('audits')
      .select('report_data')
      .eq('id', auditId)
      .single()

    if (!data) return null

    const report = (data as { report_data: unknown } | null)?.report_data as Record<string, unknown> | null
    if (!report) return null

    // Extract key details from report
    const summary = report.summary as Record<string, unknown> | null
    const businessName = (report.provider_meta as Record<string, unknown> | null)?.keyword_detected_business as string | undefined
    const topOpportunities = (report.opportunities as Array<{ type?: string }> | null)
      ?.slice(0, 2)
      .map((o) => o.type)
      .filter(Boolean) as string[] | undefined

    return {
      businessName: businessName || 'Your Business',
      auditScore: (summary?.overall_score as number | undefined) ?? undefined,
      auditGrade: (summary?.grade as string | undefined) ?? 'B',
      tradeType: (report.provider_meta as Record<string, unknown> | null)?.keyword_detected_industry as string | undefined,
      topOpportunities: topOpportunities && topOpportunities.length > 0 ? topOpportunities : ['Improve site structure'],
    }
  } catch (err) {
    console.error('[abandonment-check] Error fetching audit details:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// GET Handler: Cron Job Execution
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // Optional authentication via token query param
  const token = req.nextUrl.searchParams.get('token')
  const secretToken = process.env.ABANDONMENT_CHECK_SECRET
  if (secretToken && token !== secretToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
    const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      console.error('[abandonment-check] Supabase env vars not set')
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Check if abandonment_email_sent column exists (schema guard)
    try {
      await supabase.from('audit_abandonment_tracking').select('abandonment_email_sent').limit(1)
    } catch (err) {
      const msg = (err as { message?: string }).message ?? ''
      if (msg.includes('does not exist')) {
        console.warn('[abandonment-check] audit_abandonment_tracking table not ready, skipping')
        return NextResponse.json({ success: true, processed: 0, reason: 'schema_not_ready' })
      }
    }

    let processed = 0

    // For each abandonment stage, find candidates and send emails
    for (const stage of ABANDONMENT_STAGES) {
      const viewedBefore = getTimeAgo(stage.hours)

      // Find abandoned audits that haven't had this stage email sent yet
      const { data: abandoned, error: selectError } = await supabase
        .from('audit_abandonment_tracking')
        .select('audit_id, email, trade_type, viewed_at')
        .eq('abandoned', true)
        .lte('viewed_at', viewedBefore)
        .eq('get_started_at', null)
        .or(`abandonment_email_sent->${stage.type}.eq.false,abandonment_email_sent->${stage.type}.is.null`)

      if (selectError) {
        console.error(`[abandonment-check] Query error for stage ${stage.hours}h:`, selectError)
        continue
      }

      if (!abandoned || abandoned.length === 0) continue

      // Process each abandoned audit
      for (const record of abandoned) {
        const { audit_id: auditId, email, trade_type: tradeType } = record as {
          audit_id: string
          email: string
          trade_type?: string
          viewed_at: string
        }

        try {
          // Fetch audit details for email context
          const details = await getAuditDetails(supabase, auditId)

          // Build template data
          const templateData: NotificationTemplateData = {
            businessName: details?.businessName || 'Your Business',
            businessTrade: details?.tradeType || tradeType || 'Your Business',
            auditScore: details?.auditScore,
            auditGrade: details?.auditGrade,
            topOpportunities: details?.topOpportunities,
            getStartedUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://ranked-ceo-crm.vercel.app'}/get-started?auditId=${auditId}`,
            abandonmentStage: (`stage_${stage.hours}` as unknown) as 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4',
          }

          // Send email via notification service
          const result = await sendTenantNotification({
            type: stage.type,
            tenantId: auditId,      // Use auditId as tenant ID for this tracking
            data: templateData,
            recipientEmail: email,
            dedupKey: `${auditId}-${stage.type}`,
            dedupWindowHours: 23, // Don't resend same stage within 23h
          })

          if (result.sent) {
            // Mark this stage's email as sent
            const sendResult = await supabase.from('audit_abandonment_tracking').update({
              abandonment_email_sent: {
                ...(await supabase
                  .from('audit_abandonment_tracking')
                  .select('abandonment_email_sent')
                  .eq('audit_id', auditId)
                  .eq('email', email)
                  .single()
                  .then((r) => (r.data as Record<string, Record<string, boolean> | null> | null)?.abandonment_email_sent || {})),
                [stage.type]: true,
              },
            }).eq('audit_id', auditId).eq('email', email)

            if (sendResult.error) {
              console.warn(`[abandonment-check] Failed to mark stage ${stage.hours}h sent:`, sendResult.error)
            }

            processed++
          }
        } catch (err) {
          console.error(`[abandonment-check] Error processing ${auditId} at stage ${stage.hours}h:`, err)
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      message: `Processed ${processed} abandonment emails across all stages`,
    })
  } catch (err) {
    console.error('[abandonment-check] Cron job error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// POST Handler: Manual Trigger (for testing)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Require auth header for POST
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const secretToken = process.env.ABANDONMENT_CHECK_SECRET

  if (!secretToken || token !== secretToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Delegate to GET handler
  return GET(req)
}
