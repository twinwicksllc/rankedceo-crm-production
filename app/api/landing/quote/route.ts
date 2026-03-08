import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Pool account UUIDs — pre-seeded in the industry_leads migration
const POOL_ACCOUNTS: Record<string, string> = {
  hvac:       '00000000-0000-0000-0001-000000000001',
  plumbing:   '00000000-0000-0000-0002-000000000002',
  electrical: '00000000-0000-0000-0003-000000000003',
}

const VALID_INDUSTRIES = ['hvac', 'plumbing', 'electrical']

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse form body (application/x-www-form-urlencoded from HTML form POST)
    const contentType = request.headers.get('content-type') || ''
    let fields: Record<string, string> = {}

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text()
      const params = new URLSearchParams(text)
      params.forEach((value, key) => { fields[key] = value.trim() })
    } else {
      // Also support JSON (for future fetch() calls)
      fields = await request.json()
    }

    const {
      firstname,
      lastname,
      email,
      phone,
      zipcode,
      industry,
      notes,
      urgency,
      preferred_contact_method,
    } = fields

    // ── 2. Validate required fields
    const missing: string[] = []
    if (!firstname)  missing.push('firstname')
    if (!lastname)   missing.push('lastname')
    if (!email)      missing.push('email')
    if (!phone)      missing.push('phone')
    if (!zipcode)    missing.push('zipcode')
    if (!industry)   missing.push('industry')

    if (missing.length > 0) {
      return NextResponse.redirect(
        new URL(`/thank-you?status=error&missing=${missing.join(',')}`, request.url)
      )
    }

    // ── 3. Validate industry
    const industryLower = industry.toLowerCase()
    if (!VALID_INDUSTRIES.includes(industryLower)) {
      console.error('[Landing Quote] Invalid industry:', industry)
      return NextResponse.redirect(
        new URL('/thank-you?status=error&reason=invalid_industry', request.url)
      )
    }

    // ── 4. Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
    if (!emailRegex.test(email)) {
      return NextResponse.redirect(
        new URL('/thank-you?status=error&reason=invalid_email', request.url)
      )
    }

    // ── 5. Resolve account_id (pool account for public submissions)
    const account_id = POOL_ACCOUNTS[industryLower]

    // ── 6. Insert into industry_leads using admin client (bypasses RLS)
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('industry_leads')
      .insert({
        account_id,
        industry:                 industryLower,
        customer_name:            `${firstname} ${lastname}`.trim(),
        customer_email:           email.toLowerCase(),
        customer_phone:           phone,
        zip_code:                 zipcode,
        urgency:                  urgency || 'scheduled',
        preferred_contact_method: preferred_contact_method || 'phone',
        notes:                    notes || null,
        service_details:          {},
        status:                   'new',
      })

    if (error) {
      console.error('[Landing Quote] Supabase insert error:', error)
      // Redirect to thank-you with error so user isn't left hanging
      return NextResponse.redirect(
        new URL('/thank-you?status=error&reason=db_error', request.url)
      )
    }

    // ── 7. Success — redirect to thank-you page with industry context
    return NextResponse.redirect(
      new URL(`/thank-you?industry=${industryLower}`, request.url),
      { status: 303 } // 303 See Other — correct for POST → GET redirect
    )

  } catch (err: any) {
    console.error('[Landing Quote] Unexpected error:', err)
    return NextResponse.redirect(
      new URL('/thank-you?status=error&reason=server_error', request.url)
    )
  }
}