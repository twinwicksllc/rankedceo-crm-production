'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { POOL_ACCOUNTS } from '@/lib/data/pool-accounts'
import type {
  IndustryType,
  IndustryLead,
  LeadStats,
  LeadFilters,
  SubmitLeadInput,
  SubmitLeadResult,
  GetLeadsResult,
  UpdateLeadResult,
} from '@/lib/types/industry-lead'
import type { UpdateLeadInput } from '@/lib/validations/industry-lead'

// ---------------------------------------------------------------------------
// Submit Lead (public — no auth required)
// ---------------------------------------------------------------------------
// Called from the public lead form on each industry subdomain.
// If operator_id is provided, looks up their account_id.
// If not, falls back to the industry pool account.
// ---------------------------------------------------------------------------

export async function submitIndustryLead(
  data: SubmitLeadInput
): Promise<SubmitLeadResult> {
  try {
    const supabase = await createClient()

    let accountId: string
    let authUserId: string | null = null

    if (data.operator_id) {
      // Attributed lead — look up operator's account
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('account_id')
        .eq('id', data.operator_id)
        .single()

      if (userError || !userData) {
        // Operator not found — fall back to pool rather than failing
        console.error('[IndustryLead] Operator not found, falling back to pool:', data.operator_id)
        accountId = POOL_ACCOUNTS[data.industry]
      } else {
        accountId = userData.account_id
        authUserId = data.operator_id
      }
    } else {
      // Unattributed lead — use pool account
      accountId = POOL_ACCOUNTS[data.industry]
    }

    // Insert the lead with NEW column names
    const { data: lead, error: insertError } = await supabase
      .from('industry_leads')
      .insert({
        account_id: accountId,
        auth_user_id: authUserId,
        industry: data.industry,
        lead_name: data.customer_name,
        lead_email: data.customer_email,
        lead_phone: data.customer_phone,
        service_address: data.service_address || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        urgency: data.urgency,
        preferred_contact_method: data.preferred_contact_method,
        preferred_time: data.preferred_time || null,
        notes: data.notes || null,
        service_details: data.service_details || {},
        status: 'new',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[IndustryLead] Insert failed:', insertError.code, insertError.message)
      return { success: false, error: 'Failed to submit your request. Please try again.' }
    }

    // Revalidate the operator's dashboard
    revalidatePath(`/${data.industry}`)

    return { success: true, leadId: lead.id }
  } catch (err) {
    console.error('[IndustryLead] Unexpected error during submission:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

// ---------------------------------------------------------------------------
// Get Leads (authenticated — operator dashboard)
// ---------------------------------------------------------------------------

export async function getIndustryLeads(
  industry: IndustryType,
  filters?: LeadFilters
): Promise<GetLeadsResult> {
  try {
    const supabase = await createClient()

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, data: [], error: 'Not authenticated' }
    }

    // Get user's account_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('account_id')
      .eq('email', user.email)
      .single()

    if (userError || !userData) {
      return { success: false, data: [], error: 'Account not found' }
    }

    // Build query
    let query = supabase
      .from('industry_leads')
      .select('*')
      .eq('account_id', userData.account_id)
      .eq('industry', industry)
      .order('submitted_at', { ascending: false })

    // Apply optional filters
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }
    if (filters?.urgency && filters.urgency !== 'all') {
      query = query.eq('urgency', filters.urgency)
    }
    if (filters?.search) {
      // Updated to use NEW column names
      query = query.or(
        `lead_name.ilike.%${filters.search}%,lead_email.ilike.%${filters.search}%,lead_phone.ilike.%${filters.search}%,city.ilike.%${filters.search}%`
      )
    }
    if (filters?.date_from) {
      query = query.gte('submitted_at', filters.date_from)
    }
    if (filters?.date_to) {
      query = query.lte('submitted_at', filters.date_to)
    }

    const { data: leads, error: fetchError } = await query

    if (fetchError) {
      console.error('[IndustryLead] Fetch failed:', fetchError.code)
      return { success: false, data: [], error: 'Failed to load leads' }
    }

    return { success: true, data: (leads as IndustryLead[]) || [] }
  } catch (err) {
    console.error('[IndustryLead] Unexpected error fetching leads')
    return { success: false, data: [], error: 'Unexpected error' }
  }
}

// ---------------------------------------------------------------------------
// Get Single Lead
// ---------------------------------------------------------------------------

export async function getIndustryLead(
  leadId: string
): Promise<{ success: boolean; data: IndustryLead | null; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, data: null, error: 'Not authenticated' }
    }

    const { data: lead, error: fetchError } = await supabase
      .from('industry_leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (fetchError || !lead) {
      return { success: false, data: null, error: 'Lead not found' }
    }

    return { success: true, data: lead as IndustryLead }
  } catch (err) {
    console.error('[IndustryLead] Unexpected error fetching lead')
    return { success: false, data: null, error: 'Unexpected error' }
  }
}

// ---------------------------------------------------------------------------
// Update Lead Status (operator dashboard action)
// ---------------------------------------------------------------------------

export async function updateIndustryLead(
  leadId: string,
  updates: UpdateLeadInput
): Promise<UpdateLeadResult> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error: updateError } = await supabase
      .from('industry_leads')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)

    if (updateError) {
      console.error('[IndustryLead] Update failed:', updateError.code)
      return { success: false, error: 'Failed to update lead' }
    }

    return { success: true }
  } catch (err) {
    console.error('[IndustryLead] Unexpected error updating lead')
    return { success: false, error: 'Unexpected error' }
  }
}

// ---------------------------------------------------------------------------
// Get Lead Stats (operator dashboard)
// ---------------------------------------------------------------------------

export async function getIndustryLeadStats(
  industry: IndustryType
): Promise<{ success: boolean; data: LeadStats | null; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, data: null, error: 'Not authenticated' }
    }

    // Get user's account_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('account_id')
      .eq('email', user.email)
      .single()

    if (userError || !userData) {
      return { success: false, data: null, error: 'Account not found' }
    }

    // Fetch all leads for stats calculation
    const { data: leads, error: fetchError } = await supabase
      .from('industry_leads')
      .select('status, urgency, estimated_value')
      .eq('account_id', userData.account_id)
      .eq('industry', industry)

    if (fetchError) {
      return { success: false, data: null, error: 'Failed to load stats' }
    }

    const all = leads || []
    const total = all.length
    const new_count = all.filter(l => l.status === 'new').length
    const emergency_count = all.filter(l => l.urgency === 'emergency').length
    const urgent_count = all.filter(l => l.urgency === 'urgent').length
    const scheduled_count = all.filter(l => l.status === 'scheduled').length
    const completed_count = all.filter(l => l.status === 'completed').length
    const lost_count = all.filter(l => l.status === 'lost').length

    const closedCount = completed_count + lost_count
    const conversion_rate = closedCount > 0
      ? Math.round((completed_count / closedCount) * 100)
      : 0

    const leadsWithValue = all.filter(l => l.estimated_value != null)
    const avg_estimated_value = leadsWithValue.length > 0
      ? leadsWithValue.reduce((sum, l) => sum + (l.estimated_value || 0), 0) / leadsWithValue.length
      : null

    const total_pipeline_value = all.reduce((sum, l) => sum + (l.estimated_value || 0), 0)

    const stats: LeadStats = {
      total,
      new_count,
      emergency_count,
      urgent_count,
      scheduled_count,
      completed_count,
      lost_count,
      conversion_rate,
      avg_estimated_value,
      total_pipeline_value,
    }

    return { success: true, data: stats }
  } catch (err) {
    console.error('[IndustryLead] Unexpected error fetching stats')
    return { success: false, data: null, error: 'Unexpected error' }
  }
}