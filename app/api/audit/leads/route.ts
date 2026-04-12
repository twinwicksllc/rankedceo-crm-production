// =============================================================================
// POST /api/audit/leads
// Captures lead email from the audit report page before PDF download.
// Public endpoint — saves to leads table via capture_audit_lead() RPC.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getWaasAdminClient, captureAuditLead } from '@/lib/waas/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      email,
      audit_id,
      name,
      phone,
      company,
      target_url,
      industry,
      location,
      utm_source,
      utm_medium,
      utm_campaign,
      referrer_url,
    } = body

    // Validate
    if (!email?.trim()) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    if (!audit_id) {
      return NextResponse.json({ error: 'audit_id is required' }, { status: 400 })
    }

    // Call the Supabase RPC via typed helper (avoids Supabase 2.x ExactMatch issues)
    const { leadId, error } = await captureAuditLead({
      email:        String(email).trim().toLowerCase(),
      audit_id:     String(audit_id),
      name:         name         != null ? String(name)         : null,
      phone:        phone        != null ? String(phone)        : null,
      company:      company      != null ? String(company)      : null,
      target_url:   target_url   != null ? String(target_url)   : null,
      industry:     industry     != null ? String(industry)     : null,
      location:     location     != null ? String(location)     : null,
      utm_source:   utm_source   != null ? String(utm_source)   : null,
      utm_medium:   utm_medium   != null ? String(utm_medium)   : null,
      utm_campaign: utm_campaign != null ? String(utm_campaign) : null,
      referrer_url: referrer_url != null ? String(referrer_url) : null,
    })

    if (error) {
      console.error('[/api/audit/leads] Capture lead error:', error)
      return NextResponse.json({ error: 'Failed to save your information' }, { status: 500 })
    }

    // Link lead_id back to audit
    if (leadId) {
      const waas = getWaasAdminClient()
      await waas
        .from('audits')
        .update({ lead_id: leadId, updated_at: new Date().toISOString() })
        .eq('id', String(audit_id))
    }

    return NextResponse.json({
      success:  true,
      lead_id:  leadId,
      message:  'Report will be sent to your email shortly.',
    }, { status: 201 })

  } catch (err) {
    console.error('[/api/audit/leads] Exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}