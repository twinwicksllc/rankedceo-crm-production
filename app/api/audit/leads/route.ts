// =============================================================================
// POST /api/audit/leads
// Captures lead email from the audit report page before PDF download.
// Public endpoint — saves to leads table via capture_audit_lead() RPC.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getWaasAdminClient } from '@/lib/waas/supabase'

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

    const waas = getWaasAdminClient()

    // Call the Supabase RPC
    const { data: leadId, error } = await waas.rpc('capture_audit_lead', {
      p_email:        email.trim().toLowerCase(),
      p_audit_id:     audit_id,
      p_name:         name         ?? null,
      p_phone:        phone        ?? null,
      p_company:      company      ?? null,
      p_target_url:   target_url   ?? null,
      p_industry:     industry     ?? null,
      p_location:     location     ?? null,
      p_utm_source:   utm_source   ?? null,
      p_utm_medium:   utm_medium   ?? null,
      p_utm_campaign: utm_campaign ?? null,
      p_referrer_url: referrer_url ?? null,
    })

    if (error) {
      console.error('[/api/audit/leads] Capture lead error:', error)
      return NextResponse.json({ error: 'Failed to save your information' }, { status: 500 })
    }

    // Link lead_id back to audit
    if (leadId) {
      await waas
        .from('audits')
        .update({ lead_id: leadId, updated_at: new Date().toISOString() })
        .eq('id', audit_id)
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