// =============================================================================
// POST /api/audit/run
// Main audit runner — accepts target + competitor URLs, runs the full engine,
// saves results to the WaaS Supabase audits table.
// Public endpoint (no auth required) — rate limiting via Supabase RLS.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getWaasAdminClient }        from '@/lib/waas/supabase'
import { runFullAudit }              from '@/lib/waas/services/audit-engine'
import { extractDomain }             from '@/lib/waas/services/serper'

// ---------------------------------------------------------------------------
// POST /api/audit/run
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await req.json()
    const {
      target_url,
      competitor_urls,
      industry,
      location,
      requestor_name,
      requestor_email,
      requestor_phone,
      requestor_company,
      audit_id,          // optional: pre-created audit ID from the form step
    } = body

    // ── Validate inputs ───────────────────────────────────────────────────
    if (!target_url?.trim()) {
      return NextResponse.json({ error: 'target_url is required' }, { status: 400 })
    }

    const normalizeUrl = (url: string) =>
      url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`

    const normalizedTarget      = normalizeUrl(target_url)
    const normalizedCompetitors = ((competitor_urls ?? []) as string[])
      .filter(Boolean)
      .slice(0, 3)
      .map(normalizeUrl)

    // Validate URL format
    try { new URL(normalizedTarget) } catch {
      return NextResponse.json({ error: 'target_url must be a valid URL' }, { status: 400 })
    }

    if (normalizedCompetitors.length === 0) {
      return NextResponse.json(
        { error: 'At least one competitor_url is required' },
        { status: 400 }
      )
    }

    // ── Create or update audit record (status: running) ───────────────────
    const waas = getWaasAdminClient()
    let auditId = (audit_id as string | null) ?? null

    if (auditId) {
      // Update existing audit to 'running'
      await waas.from('audits').update({
        status:     'running'    as const,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', auditId)
    } else {
      // Create new audit record
      const { data: newAudit, error: createError } = await waas
        .from('audits')
        .insert({
          audit_type:        'prospect'  as const,
          status:            'running'   as const,
          target_url:        normalizedTarget,
          competitor_urls:   normalizedCompetitors,
          requestor_name:    requestor_name    ?? null,
          requestor_email:   requestor_email   ?? null,
          requestor_phone:   requestor_phone   ?? null,
          requestor_company: requestor_company ?? null,
          started_at:        new Date().toISOString(),
          expires_at:        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          seo_provider:      (process.env.WAAS_SEO_PROVIDER ?? 'mock') as 'mock' | 'serper' | 'dataforseo',
          // Migration 004 columns
          lead_id:            null,
          admin_notified:     false,
          admin_notified_at:  null,
          manual_review:      false,
          manual_review_note: null,
          keywords_used:      null,
          location_detected:  null,
        })
        .select('id')
        .single()

      if (createError || !newAudit) {
        console.error('[/api/audit/run] Create audit failed:', createError)
        return NextResponse.json(
          { error: 'Failed to initialize audit record' },
          { status: 500 }
        )
      }

      auditId = newAudit.id
    }

    // ── Run the audit engine ──────────────────────────────────────────────
    let engineResult
    try {
      engineResult = await runFullAudit(
        normalizedTarget,
        normalizedCompetitors,
        (industry as string | null) ?? null,
        (location as string | null) ?? null
      )
    } catch (engineErr) {
      console.error('[/api/audit/run] Engine error:', engineErr)

      // Mark audit as failed + trigger manual review
      await waas.from('audits').update({
        status:             'failed'     as const,
        error_message:      String(engineErr).slice(0, 500),
        manual_review:      true,
        manual_review_note: `Engine exception: ${String(engineErr).slice(0, 300)}`,
        updated_at:         new Date().toISOString(),
      }).eq('id', auditId)

      // Notify admin asynchronously (don't await to avoid blocking response)
      notifyAdmin(auditId!, normalizedTarget, String(engineErr)).catch(console.error)

      return NextResponse.json(
        {
          audit_id:      auditId,
          status:        'failed',
          manual_review: true,
          message:       'Audit could not be completed automatically. Our team has been notified and will review your site within 24 hours.',
          poll_url:      `/api/waas/audits/${auditId}/status`,
        },
        { status: 202 }
      )
    }

    // ── Save results to Supabase ──────────────────────────────────────────
    const grade = (engineResult.reportData as Record<string, unknown>).grade as string ?? 'F'

    const { error: saveError } = await waas
      .from('audits')
      .update({
        status:             (engineResult.manualReview ? 'failed' : 'completed') as const,
        report_data:        engineResult.reportData as Record<string, unknown>,
        completed_at:       engineResult.manualReview ? null : new Date().toISOString(),
        seo_provider:       engineResult.provider as 'mock' | 'serper' | 'dataforseo',
        keywords_used:      engineResult.keywordsUsed,
        location_detected:  engineResult.locationDetected,
        manual_review:      engineResult.manualReview,
        manual_review_note: engineResult.manualReviewNote,
        requestor_email:    requestor_email   ?? null,
        requestor_name:     requestor_name    ?? null,
        requestor_phone:    requestor_phone   ?? null,
        requestor_company:  requestor_company ?? null,
        updated_at:         new Date().toISOString(),
      })
      .eq('id', auditId)

    if (saveError) {
      console.error('[/api/audit/run] Save results failed:', saveError)
    }

    // If manual review needed, notify admin
    if (engineResult.manualReview) {
      notifyAdmin(auditId!, normalizedTarget, engineResult.manualReviewNote ?? 'Unknown').catch(console.error)
    }

    const elapsed = Date.now() - startTime

    return NextResponse.json({
      audit_id:          auditId,
      status:            engineResult.manualReview ? 'failed' : 'completed',
      manual_review:     engineResult.manualReview,
      elapsed_ms:        elapsed,
      report_url:        `/audit/${auditId}`,
      poll_url:          `/api/waas/audits/${auditId}/status`,
      summary: {
        overall_score:   engineResult.reportData.summary?.overall_score ?? 0,
        grade,
        keywords_tested: engineResult.keywordsUsed.length,
        location:        engineResult.locationDetected,
      },
    })

  } catch (err) {
    console.error('[/api/audit/run] Unhandled exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Notify admin of manual review needed (async — fire and forget)
// ---------------------------------------------------------------------------
async function notifyAdmin(
  auditId:   string,
  targetUrl: string,
  reason:    string
): Promise<void> {
  try {
    const waas = getWaasAdminClient()

    // Mark as notified in DB
    await waas.from('audits').update({
      admin_notified:    true,
      admin_notified_at: new Date().toISOString(),
    }).eq('id', auditId)

    // Send email via SendGrid if configured
    const sendgridKey = process.env.SENDGRID_API_KEY
    const adminEmail  = process.env.WAAS_ADMIN_EMAIL ?? 'darrick@rankedceo.com'

    if (!sendgridKey) {
      console.log(`[Admin Notify] SendGrid not configured. Manual review needed for audit ${auditId}: ${targetUrl}`)
      return
    }

    const domain   = extractDomain(targetUrl)
    const auditUrl = `${process.env.NEXT_PUBLIC_APP_URL_PROD ?? 'https://crm.rankedceo.com'}/waas/audits/${auditId}`

    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${sendgridKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: adminEmail, name: 'Darrick' }],
          subject: `⚠️ Manual Audit Required: ${domain}`,
        }],
        from: {
          email: process.env.SENDGRID_FROM_EMAIL ?? 'noreply@rankedceo.com',
          name:  'RankedCEO Audit System',
        },
        content: [{
          type:  'text/html',
          value: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #DC2626;">⚠️ Manual Audit Required</h2>
              <p>An audit could not be completed automatically and requires your review.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px; background: #F9FAFB; font-weight: bold; width: 140px;">Audit ID</td><td style="padding: 8px;">${auditId}</td></tr>
                <tr><td style="padding: 8px; background: #F9FAFB; font-weight: bold;">Target URL</td><td style="padding: 8px;"><a href="${targetUrl}">${targetUrl}</a></td></tr>
                <tr><td style="padding: 8px; background: #F9FAFB; font-weight: bold;">Reason</td><td style="padding: 8px; color: #DC2626;">${reason}</td></tr>
                <tr><td style="padding: 8px; background: #F9FAFB; font-weight: bold;">Time</td><td style="padding: 8px;">${new Date().toLocaleString()}</td></tr>
              </table>
              <a href="${auditUrl}" style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                Review Audit →
              </a>
            </div>
          `,
        }],
      }),
    })

    console.log(`[Admin Notify] Email sent to ${adminEmail} for audit ${auditId}`)
  } catch (err) {
    console.error('[Admin Notify] Failed to notify admin:', err)
  }
}