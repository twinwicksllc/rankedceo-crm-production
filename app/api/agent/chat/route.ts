import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chat, extractLeadInfo } from '@/lib/services/ai-agent-service'
import { getEventTypes } from '@/lib/services/calendly-service'
import { agentConversationService } from '@/lib/services/agent-conversation-service'
import { agentChatSchema } from '@/lib/validations/appointment'
import type { AgentMessage, AppointmentSource } from '@/lib/types/appointment'
import type { IndustryType } from '@/lib/types/industry-lead'

export const dynamic = 'force-dynamic'

// Default account ID for general company bookings
const DEFAULT_ACCOUNT_ID = process.env.DEFAULT_ACCOUNT_ID || '00000000-0000-4000-a000-000000000001'

// ───────── Duplicate Check & Lead Upsert ─────────────────────────────────────────────────────
// Checks if a lead already exists by email or phone within the same account.
// If found, updates their record. If not, creates a new one.
// Returns the lead ID.
async function upsertChatLead(
  supabase: any,
  accountId: string,
  source: AppointmentSource,
  leadInfo: { name?: string; email?: string; phone?: string }
): Promise<string | null> {
  try {
    console.log('[Agent Chat] upsertChatLead called with:', {
      accountId,
      source,
      leadInfo,
    })

    const industry = ['hvac', 'plumbing', 'electrical'].includes(source)
      ? source as IndustryType
      : null

    // Only create industry_leads for industry subdomains
    if (!industry) {
      console.log('[Agent Chat] Not an industry subdomain, skipping lead creation')
      return null
    }

    // ── Duplicate check on email OR phone ───────────────────────────────────────────────
    let existingLead: any = null

    if (leadInfo.email) {
      console.log('[Agent Chat] Checking for existing lead by email:', leadInfo.email)
      const { data, error } = await supabase
        .from('industry_leads')
        .select('id, customer_name, customer_email, customer_phone')
        .eq('account_id', accountId)
        .eq('industry', industry)
        .ilike('customer_email', leadInfo.email)
        .maybeSingle()
      
      if (error) {
        console.error('[Agent Chat] Email lookup error:', error)
      } else {
        existingLead = data
        console.log('[Agent Chat] Email lookup result:', existingLead ? 'Found' : 'Not found')
      }
    }

    if (!existingLead && leadInfo.phone) {
      const normalizedPhone = leadInfo.phone.replace(/\D/g, '')
      console.log('[Agent Chat] Checking for existing lead by phone (normalized):', normalizedPhone)
      
      // Fetch leads for this account/industry and normalize stored phones client-side
      // to handle formats like (555) 123-4567 vs 5551234567 vs 555-123-4567
      const { data: phoneLeads, error } = await supabase
        .from('industry_leads')
        .select('id, customer_name, customer_email, customer_phone')
        .eq('account_id', accountId)
        .eq('industry', industry)
        .not('customer_phone', 'is', null)

      if (error) {
        console.error('[Agent Chat] Phone lookup error:', error)
      } else if (phoneLeads) {
        existingLead = phoneLeads.find((lead: any) => {
          const storedNormalized = (lead.customer_phone || '').replace(/\D/g, '')
          return storedNormalized === normalizedPhone && normalizedPhone.length >= 10
        }) || null
        console.log('[Agent Chat] Phone lookup result:', existingLead ? 'Found' : 'Not found')
      }
    }

    if (existingLead) {
      // ── Update existing lead with any new info ─────────────────────────────────────────
      console.log('[Agent Chat] Existing lead found, updating:', existingLead.id)
      const updates: any = { updated_at: new Date().toISOString() }
      if (leadInfo.name && !existingLead.customer_name) updates.customer_name = leadInfo.name
      if (leadInfo.email && !existingLead.customer_email) updates.customer_email = leadInfo.email
      if (leadInfo.phone && !existingLead.customer_phone) updates.customer_phone = leadInfo.phone

      console.log('[Agent Chat] Updates to apply:', updates)
      
      const { error: updateError } = await supabase
        .from('industry_leads')
        .update(updates)
        .eq('id', existingLead.id)
      
      if (updateError) {
        console.error('[Agent Chat] Failed to update existing lead:', updateError)
        return null
      }
      
      console.log('[Agent Chat] Successfully updated existing lead:', existingLead.id)
      return existingLead.id
    }

    // ── Create new lead ─────────────────────────────────────────────────────────────────
    // Only create if we have at minimum a name AND (email OR phone)
    if (!leadInfo.name || (!leadInfo.email && !leadInfo.phone)) {
      console.log('[Agent Chat] Insufficient info for lead creation:', {
        hasName: !!leadInfo.name,
        hasEmail: !!leadInfo.email,
        hasPhone: !!leadInfo.phone,
      })
      return null
    }

    console.log('[Agent Chat] Creating new lead from chat for industry:', industry)
    console.log('[Agent Chat] Lead data to insert:', {
      account_id: accountId,
      industry,
      customer_name: leadInfo.name,
      customer_email: leadInfo.email || '',
      customer_phone: leadInfo.phone || '',
    })

    const { data: newLead, error } = await supabase
      .from('industry_leads')
      .insert({
        account_id: accountId,
        industry,
        customer_name: leadInfo.name,
        customer_email: leadInfo.email || '',
        customer_phone: leadInfo.phone || '',
        urgency: 'scheduled',
        preferred_contact_method: leadInfo.email ? 'email' : 'phone',
        service_details: { source: 'chat_widget' },
        status: 'new',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Agent Chat] Failed to create lead:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      return null
    }

    console.log('[Agent Chat] Successfully created new lead:', newLead.id)
    return newLead.id
  } catch (err) {
    console.error('[Agent Chat] upsertChatLead unexpected error:', err)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = agentChatSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { message, sessionId, source, accountId, leadInfo } = parsed.data
    const resolvedAccountId = accountId || DEFAULT_ACCOUNT_ID

    console.log('[Agent Chat] Processing message:', {
      sessionId,
      source,
      accountId: resolvedAccountId,
      message: message.substring(0, 100),
    })

    // Use admin client so writes bypass RLS (public visitors have no session)
    const supabase = createAdminClient()

    // Get or create conversation using service
    const conversation = await agentConversationService.getOrCreateConversation(
      sessionId,
      source,
      resolvedAccountId
    )

    let messages: AgentMessage[] = conversation?.messages || []

    // Get Calendly event types for this account
    let eventTypes: any[] = []
    let calendlySchedulingUrl: string | null = null
    try {
      const { data: connection } = await supabase
        .from('calendly_connections')
        .select('access_token, calendly_user_uri')
        .eq('account_id', resolvedAccountId)
        .eq('is_active', true)
        .single()

      if (connection) {
        eventTypes = await getEventTypes(
          connection.access_token,
          connection.calendly_user_uri
        )
        calendlySchedulingUrl = eventTypes?.[0]?.scheduling_url || null
        console.log('[Agent Chat] Calendly scheduling URL:', calendlySchedulingUrl ? 'Found' : 'Not found')
      }
    } catch (err) {
      console.warn('[Agent Chat] Could not fetch event types:', err)
    }

    // Build context
    const context = {
      source: source as AppointmentSource,
      accountId: resolvedAccountId,
      sessionId,
      leadInfo: {
        ...leadInfo,
        ...(conversation?.lead_name ? { name: conversation.lead_name } : {}),
        ...(conversation?.lead_email ? { email: conversation.lead_email } : {}),
        ...(conversation?.lead_phone ? { phone: conversation.lead_phone } : {}),
      },
      availableEventTypes: eventTypes,
    }

    // ── Quick booking intent check (keyword-based, no AI cost) ───────────────────────
    // REFINED: Only trigger on explicit booking-related keywords, not agreement words
    const BOOKING_KEYWORDS = [
      'book', 'schedule', 'appointment', 'call', 'meeting', 'available',
      'availability', 'time', 'slot', 'calendar', 'talk', 'speak',
      'consult', 'consultation', 'set up', 'arrange', 'reserve',
    ]
    const msgLower = message.toLowerCase()
    const hasBookingIntent = BOOKING_KEYWORDS.some(kw => msgLower.includes(kw))
    
    console.log('[Agent Chat] Booking intent check:', {
      message: msgLower.substring(0, 50),
      hasBookingIntent,
      keywordsFound: BOOKING_KEYWORDS.filter(kw => msgLower.includes(kw)),
    })

    // ── Resolve lead info from conversation + current message ─────────────────────────
    // Do this BEFORE calling AI so we can short-circuit if possible
    const preExtracted = extractLeadInfo([
      ...messages,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
    ])
    const preLeadInfo = {
      name: context.leadInfo?.name || preExtracted.name || conversation?.lead_name || undefined,
      email: context.leadInfo?.email || preExtracted.email || conversation?.lead_email || undefined,
      phone: context.leadInfo?.phone || preExtracted.phone || conversation?.lead_phone || undefined,
    }
    const hasEnoughInfoAlready = !!(preLeadInfo.name && (preLeadInfo.email || preLeadInfo.phone))

    console.log('[Agent Chat] Pre-extraction check:', {
      hasEnoughInfoAlready,
      leadInfo: preLeadInfo,
    })

    // ── SHORT-CIRCUIT: If we have info + booking intent → skip AI entirely ───────
    // This prevents the AI from asking "Would you like to see times?" again.
    if (hasEnoughInfoAlready && hasBookingIntent && calendlySchedulingUrl) {
      console.log('[Agent Chat] SHORT-CIRCUIT: Skipping AI, direct booking trigger')
      
      const confirmMsg = `Perfect${preLeadInfo.name ? `, ${preLeadInfo.name}` : ''}! I'm opening our booking calendar for you now. Please select a time that works best for you. 📅`

      // Persist the user message + confirmation
      if (conversation) {
        await agentConversationService.addMessage(conversation.id, 'user', message)
        await agentConversationService.addMessage(conversation.id, 'assistant', confirmMsg)
        await agentConversationService.updateStatus(conversation.id, 'booked')
      }

      return NextResponse.json({
        message: confirmMsg,
        action: 'show_booking',
        bookingData: { schedulingUrl: calendlySchedulingUrl },
        leadCaptured: true,
        leadId: null,
        hasCalendly: true,
        calendlyUrl: calendlySchedulingUrl,
        triggerBooking: true,
      })
    }

    // ── Normal AI response path ───────────────────────────────────────────────────────
    const response = await chat(message, messages, context, eventTypes)

    // Update messages array for extraction
    const updatedMessages: AgentMessage[] = [
      ...messages,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: response.message, timestamp: new Date().toISOString() },
    ]

    // Extract any new lead info from full conversation
    const extracted = extractLeadInfo(updatedMessages)
    const updatedLeadInfo = {
      name: context.leadInfo?.name || extracted.name || conversation?.lead_name || undefined,
      email: context.leadInfo?.email || extracted.email || conversation?.lead_email || undefined,
      phone: context.leadInfo?.phone || extracted.phone || conversation?.lead_phone || undefined,
    }

    console.log('[Agent Chat] Post-extraction check:', {
      leadInfo: updatedLeadInfo,
    })

    // ── Auto-create/update industry lead when we have enough info ─────────────────────
    let leadId: string | null = null
    const hasEnoughInfo = !!(updatedLeadInfo.name && (updatedLeadInfo.email || updatedLeadInfo.phone))
    if (hasEnoughInfo) {
      console.log('[Agent Chat] Attempting to upsert lead...')
      leadId = await upsertChatLead(supabase, resolvedAccountId, source, updatedLeadInfo)
      console.log('[Agent Chat] Lead upsert result:', leadId ? `Created/Updated: ${leadId}` : 'Failed')
    }

    // ── Update conversation record ─────────────────────────────────────────────────────
    if (conversation) {
      await agentConversationService.addMessage(conversation.id, 'user', message)
      await agentConversationService.addMessage(conversation.id, 'assistant', response.message)

      if (updatedLeadInfo.name || updatedLeadInfo.email || updatedLeadInfo.phone) {
        await agentConversationService.updateLeadInfo(conversation.id, updatedLeadInfo)
      }

      if (response.action === 'booking_confirmed' || response.action === 'show_booking') {
        await agentConversationService.updateStatus(conversation.id, 'booked')
      }
    }

    // ── Attach Calendly URL to response when booking is requested ─────────────────────
    const wantsBooking = response.action === 'show_booking' || response.action === 'booking_confirmed'
    if (wantsBooking && hasEnoughInfo && calendlySchedulingUrl) {
      response.bookingData = {
        ...response.bookingData,
        schedulingUrl: calendlySchedulingUrl,
      }
    }

    // ── Return enriched response ───────────────────────────────────────────────────────
    return NextResponse.json({
      ...response,
      leadCaptured: hasEnoughInfo,
      leadId,
      hasCalendly: !!calendlySchedulingUrl,
      calendlyUrl: wantsBooking && hasEnoughInfo ? calendlySchedulingUrl : null,
      triggerBooking: wantsBooking && hasEnoughInfo && !!calendlySchedulingUrl,
    })

  } catch (error) {
    console.error('[Agent Chat] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process message', message: "I'm sorry, I'm having trouble right now. Please try again in a moment." },
      { status: 500 }
    )
  }
}