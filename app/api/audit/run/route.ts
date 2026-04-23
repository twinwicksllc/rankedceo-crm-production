// =============================================================================
// POST /api/audit/run
// Main audit runner — accepts target + competitor URLs, runs the full engine,
// saves results to the WaaS Supabase audits table.
// Public endpoint (no auth required) — rate limiting via Supabase RLS.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAuditRecord, updateAuditRecord } from '@/lib/waas/supabase'
import type { WaasAuditInsert, WaasAuditUpdate } from '@/lib/waas/supabase'
import type { AuditSeoProvider } from '@/lib/waas/types'
import { runFullAudit } from '@/lib/waas/services/audit-engine'
import { extractDomain } from '@/lib/waas/services/serper'
import { buildAuditReportPath } from '@/lib/waas/utils/audit-report-url'

const AUDIT_EXPIRY_DAYS = 30

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
      audit_id,
    } = body

    // ── Validate inputs ──────────────────────────────────────────────────────
    if (!target_url?.trim()) {
      return NextResponse.json({ error: 'target_url is required' }, { status: 400 })
    }

    const normalizeUrl = (url: string) =>
      url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`

    const normalizedTarget      = normalizeUrl(String(target_url))
    const normalizedCompetitors = ((competitor_urls ?? []) as unknown[])
      .filter(Boolean)
      .slice(0, 3)
      .map((u) => normalizeUrl(String(u)))

    try { new URL(normalizedTarget) } catch {
      return NextResponse.json({ error: 'target_url must be a valid URL' }, { status: 400 })
    }

    if (normalizedCompetitors.length === 0) {
      return NextResponse.json(
        { error: 'At least one competitor_url is required' },
        { status: 400 }
      )
    }

    // ── Create or update audit record (status: running) ──────────────────────
    let auditId: string | null = audit_id ? String(audit_id) : null

    if (auditId) {
      await updateAuditRecord(auditId, {
        status:     'running',
        started_at: new Date().toISOString(),
      })
    } else {
      const insert: WaasAuditInsert = {
        audit_type:        'prospect',
        status:            'running',
        target_url:        normalizedTarget,
        competitor_urls:   normalizedCompetitors,
        requestor_name:    requestor_name    ? String(requestor_name)    : null,
        requestor_email:   requestor_email   ? String(requestor_email)   : null,
        requestor_phone:   requestor_phone   ? String(requestor_phone)   : null,
        requestor_company: requestor_company ? String(requestor_company) : null,
        started_at:        new Date().toISOString(),
        expires_at:        new Date(Date.now() + AUDIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        seo_provider:      (process.env.WAAS_SEO_PROVIDER ?? 'mock') as AuditSeoProvider,
      }

      auditId = await createAuditRecord(insert)

      if (!auditId) {
        return NextResponse.json(
          { error: 'Failed to initialize audit record' },
          { status: 500 }
        )
      }
    }

    // ── Run the audit engine ─────────────────────────────────────────────────
    let engineResult
    try {
      engineResult = await runFullAudit(
        normalizedTarget,
        normalizedCompetitors,
        industry ? String(industry) : null,
        location ? String(location) : null
      )
    } catch (engineErr) {
      console.error('[/api/audit/run] Engine error:', engineErr)

      await updateAuditRecord(auditId, {
        status:             'failed',
        error_message:      String(engineErr).slice(0, 500),
        manual_review:      true,
        manual_review_note: `Engine exception: ${String(engineErr).slice(0, 300)}`,
      })

      notifyAdmin(auditId, normalizedTarget, String(engineErr)).catch(console.error)

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

    // ── Save results to Supabase ─────────────────────────────────────────────
    const updatePayload: WaasAuditUpdate = {
      status:             engineResult.manualReview ? 'failed' : 'completed',
      report_data:        engineResult.reportData,
      completed_at:       engineResult.manualReview ? null : new Date().toISOString(),
      seo_provider:       engineResult.provider,
      keywords_used:      engineResult.keywordsUsed,
      location_detected:  engineResult.locationDetected,
      manual_review:      engineResult.manualReview,
      manual_review_note: engineResult.manualReviewNote,
    }

    if (requestor_email)   updatePayload.requestor_email   = String(requestor_email)
    if (requestor_name)    updatePayload.requestor_name    = String(requestor_name)
    if (requestor_phone)   updatePayload.requestor_phone   = String(requestor_phone)
    if (requestor_company) updatePayload.requestor_company = String(requestor_company)

    await updateAuditRecord(auditId, updatePayload)

    if (engineResult.manualReview) {
      notifyAdmin(auditId, normalizedTarget, engineResult.manualReviewNote ?? 'Unknown').catch(console.error)
    }

    const elapsed = Date.now() - startTime

    return NextResponse.json({
      audit_id:          auditId,
      status:            engineResult.manualReview ? 'failed' : 'completed',
      manual_review:     engineResult.manualReview,
      elapsed_ms:        elapsed,
      report_url:        buildAuditReportPath(auditId, {
        requestorCompany: requestor_company ? String(requestor_company) : null,
        requestorName: requestor_name ? String(requestor_name) : null,
        targetUrl: normalizedTarget,
      }),
      poll_url:          `/api/waas/audits/${auditId}/status`,
      summary: {
        overall_score:   engineResult.reportData.summary?.overall_score ?? 0,
        grade:           (engineResult.reportData as Record<string, unknown>)?.grade ?? 'F',
        keywords_tested: engineResult.keywordsUsed.length,
        location:        engineResult.locationDetected,
        top_search_result: engineResult.reportData.summary?.top_search_result ?? null,
        bottom_search_result: engineResult.reportData.summary?.bottom_search_result ?? null,
        mean_position: engineResult.reportData.summary?.mean_position ?? null,
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
    await updateAuditRecord(auditId, {
      admin_notified:    true,
      admin_notified_at: new Date().toISOString(),
    })

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