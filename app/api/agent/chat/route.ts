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

// ─────────── Duplicate Check & Lead Upsert ─────────────────────────────────
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

    if (!industry) {
      console.log('[Agent Chat] Not an industry subdomain, skipping lead creation')
      return null
    }

    let existingLead: any = null

    if (leadInfo.email) {
      console.log('[Agent Chat] Checking for existing lead by email:', leadInfo.email)
      const { data, error } = await supabase
        .from('industry_leads')
        .select('id, lead_name, lead_email, lead_phone')
        .eq('account_id', accountId)
        .eq('industry', industry)
        .ilike('lead_email', leadInfo.email)
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

      const { data: phoneLeads, error } = await supabase
        .from('industry_leads')
        .select('id, lead_name, lead_email, lead_phone')
        .eq('account_id', accountId)
        .eq('industry', industry)
        .not('lead_phone', 'is', null)

      if (error) {
        console.error('[Agent Chat] Phone lookup error:', error)
      } else if (phoneLeads) {
        existingLead = phoneLeads.find((lead: any) => {
          const storedNormalized = (lead.lead_phone || '').replace(/\D/g, '')
          return storedNormalized === normalizedPhone && normalizedPhone.length >= 10
        }) || null
        console.log('[Agent Chat] Phone lookup result:', existingLead ? 'Found' : 'Not found')
      }
    }

    if (existingLead) {
      console.log('[Agent Chat] Existing lead found, updating:', existingLead.id)
      const updates: any = { updated_at: new Date().toISOString() }
      if (
        leadInfo.name &&
        leadInfo.name !== 'Unknown' &&
        leadInfo.name !== 'Valued Lead' &&
        (!existingLead.lead_name || existingLead.lead_name === 'Unknown' || existingLead.lead_name === 'Valued Lead')
      ) {
        updates.lead_name = leadInfo.name
      }
      if (leadInfo.email && !existingLead.lead_email) updates.lead_email = leadInfo.email
      if (leadInfo.phone && !existingLead.lead_phone) updates.lead_phone = leadInfo.phone

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

    if (!leadInfo.email && !leadInfo.phone) {
      console.log('[Agent Chat] Insufficient info for lead creation:', {
        hasName: !!leadInfo.name,
        hasEmail: !!leadInfo.email,
        hasPhone: !!leadInfo.phone,
      })
      return null
    }

    const leadData = {
      account_id: accountId,
      industry,
      lead_name: leadInfo.name || 'Valued Lead',
      lead_email: leadInfo.email || '',
      lead_phone: leadInfo.phone || '',
    }

    console.error('[CRITICAL] Upserting Lead:', {
      name: leadData.lead_name,
      email: leadData.lead_email,
      phone: leadData.lead_phone,
      industry: leadData.industry,
    })

    const { data: newLead, error } = await supabase
      .from('industry_leads')
      .insert(leadData)
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

    const supabase = createAdminClient()

    const conversation = await agentConversationService.getOrCreateConversation(
      sessionId,
      source,
      resolvedAccountId
    )

    const messages: AgentMessage[] = conversation?.messages || []

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

    const response = await chat(message, messages, context, eventTypes)

    const updatedMessages: AgentMessage[] = [
      ...messages,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: response.message, timestamp: new Date().toISOString() },
    ]

    const extracted = extractLeadInfo(updatedMessages)

    console.log('[Agent Chat] Extraction results:', {
      extracted,
      contextLeadInfo: context.leadInfo,
      conversationLead: {
        name: conversation?.lead_name,
        email: conversation?.lead_email,
        phone: conversation?.lead_phone,
      },
    })

    // ── Step 1: Try existing extraction pipeline ──────────────────────────
    let finalName = context.leadInfo?.name || extracted.name || conversation?.lead_name || undefined

    if (!finalName) {
      const userMessagesText = updatedMessages
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join(' ')

      const namePatterns = [
        /(?:i am|i'm|my name is|this is|call me|name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?)/i,
        /(?:^|[.!?]\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?)(?:\s+(?:is|here|speaking|calling|available))?/i,
      ]

      for (const pattern of namePatterns) {
        const match = userMessagesText.match(pattern)
        if (match && match[1]) {
          const commonWords = ['This', 'That', 'There', 'Here', 'Hello', 'Hi', 'Hey', 'Good', 'Great', 'Thanks', 'Please', 'Sorry', 'Yes', 'No', 'Okay', 'Sure', 'Alright', 'Well', 'Now', 'Today', 'Tomorrow', 'Yesterday']
          if (!commonWords.includes(match[1])) {
            finalName = match[1]
            console.log('[Agent Chat] Name found via regex fallback:', finalName)
            break
          }
        }
      }
    }

    const updatedLeadInfo = {
      name: finalName,
      email: context.leadInfo?.email || extracted.email || conversation?.lead_email || undefined,
      phone: context.leadInfo?.phone || extracted.phone || conversation?.lead_phone || undefined,
    }

    // ── Step 2: HARD-CODED FALLBACK — broader regex catches "I am / My name is / I'm" ──
    console.error('[DEPLOYMENT-TIMESTAMP] Code executed at:', new Date().toISOString())
    if (!updatedLeadInfo.name || updatedLeadInfo.name === 'Valued Lead') {
      const fullHistory = updatedMessages.map(m => m.content).join(' ')
      const nameRegex = /(?:I am|My name is|I'm)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i
      const nameMatch = fullHistory.match(nameRegex)
      if (nameMatch && nameMatch[1]) {
        updatedLeadInfo.name = nameMatch[1]
        console.error('[EMERGENCY] Name found via fallback:', updatedLeadInfo.name)
      }
    }

    console.log('[Agent Chat] Post-extraction check:', {
      leadInfo: updatedLeadInfo,
    })

    // ── Auto-create/update industry lead when we have email OR phone ──────
    let leadId: string | null = null
    const hasEnoughInfo = !!(updatedLeadInfo.email || updatedLeadInfo.phone)
    if (hasEnoughInfo) {
      console.log('[Agent Chat] Attempting to upsert lead...')
      leadId = await upsertChatLead(supabase, resolvedAccountId, source, updatedLeadInfo)
      console.log('[Agent Chat] Lead upsert result:', leadId ? `Created/Updated: ${leadId}` : 'Failed')
    }

    // ── Update conversation record ────────────────────────────────────────
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

    // ── Attach Calendly URL only when AI explicitly requests booking ──────
    const wantsBooking = response.action === 'show_booking' || response.action === 'booking_confirmed'
    if (wantsBooking && hasEnoughInfo && calendlySchedulingUrl) {
      response.bookingData = {
        ...response.bookingData,
        schedulingUrl: calendlySchedulingUrl,
      }
    }

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