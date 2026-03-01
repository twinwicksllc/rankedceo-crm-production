import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chat, getGreetingMessage, extractLeadInfo } from '@/lib/services/ai-agent-service'
import { getEventTypes } from '@/lib/services/calendly-service'
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

    // Load or create conversation session
    const { data: session, error: sessionError } = await supabase
      .from('agent_conversations')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    let messages: AgentMessage[] = session?.messages || []

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
        ...(session?.lead_name ? { name: session.lead_name } : {}),
        ...(session?.lead_email ? { email: session.lead_email } : {}),
        ...(session?.lead_phone ? { phone: session.lead_phone } : {}),
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
      lead_name: context.leadInfo?.name || extracted.name || session?.lead_name || null,
      lead_email: context.leadInfo?.email || extracted.email || session?.lead_email || null,
      lead_phone: context.leadInfo?.phone || extracted.phone || session?.lead_phone || null,
    }

    // Upsert conversation session
    await supabase
      .from('agent_conversations')
      .upsert({
        session_id: sessionId,
        account_id: resolvedAccountId,
        source,
        messages: updatedMessages,
        status: response.action === 'booking_confirmed' ? 'booked' : 'active',
        ...updatedLeadInfo,
      }, { onConflict: 'session_id' })

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