import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chat, getGreetingMessage, extractLeadInfo } from '@/lib/services/ai-agent-service'
import { getEventTypes } from '@/lib/services/calendly-service'
import { agentConversationService } from '@/lib/services/agent-conversation-service'
import { agentChatSchema } from '@/lib/validations/appointment'
import type { AgentMessage, AppointmentSource } from '@/lib/types/appointment'

export const dynamic = 'force-dynamic'

// Default account ID for general company bookings
const DEFAULT_ACCOUNT_ID = process.env.DEFAULT_ACCOUNT_ID || '00000000-0000-4000-a000-000000000001'

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

    const supabase = await createClient()

    // Get or create conversation using service
    const conversation = await agentConversationService.getOrCreateConversation(
      sessionId,
      source,
      resolvedAccountId
    )

    let messages: AgentMessage[] = conversation?.messages || []

    // Get Calendly event types for this account
    let eventTypes: any[] = []
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

    // Get AI response
    const response = await chat(message, messages, context, eventTypes)

    // Update messages
    const updatedMessages: AgentMessage[] = [
      ...messages,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: response.message, timestamp: new Date().toISOString() },
    ]

    // Extract any new lead info from conversation
    const extracted = extractLeadInfo(updatedMessages)
    const updatedLeadInfo = {
      name: context.leadInfo?.name || extracted.name || conversation?.lead_name || undefined,
      email: context.leadInfo?.email || extracted.email || conversation?.lead_email || undefined,
      phone: context.leadInfo?.phone || extracted.phone || conversation?.lead_phone || undefined,
    }

    // Update conversation with new messages and lead info
    if (conversation) {
      // Update messages
      await agentConversationService.addMessage(
        conversation.id,
        'user',
        message
      )
      await agentConversationService.addMessage(
        conversation.id,
        'assistant',
        response.message
      )

      // Update lead info if we have new information
      if (updatedLeadInfo.name || updatedLeadInfo.email || updatedLeadInfo.phone) {
        await agentConversationService.updateLeadInfo(
          conversation.id,
          updatedLeadInfo
        )
      }

      // Update status if booking was confirmed
      if (response.action === 'booking_confirmed') {
        await agentConversationService.updateStatus(
          conversation.id,
          'booked'
        )
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Agent Chat] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process message', message: "I'm sorry, I'm having trouble right now. Please try again in a moment." },
      { status: 500 }
    )
  }
}

// GET - Get greeting message for a new session
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const source = (searchParams.get('source') || 'crm') as AppointmentSource
  const leadName = searchParams.get('lead_name') || undefined

  const greeting = getGreetingMessage(source, leadName)
  return NextResponse.json({ message: greeting })
}