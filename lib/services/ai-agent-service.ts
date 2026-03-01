// ============================================================
// RankedCEO AI Assistant - Gemini-powered booking agent
// ============================================================

import type {
  AgentMessage,
  AgentContext,
  AgentChatResponse,
  CalendlyEventType,
  AppointmentSource,
} from '@/lib/types/appointment'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Model selection:
// - gemini-2.5-flash: fast, cost-effective for chat responses
// - gemini-2.5-pro: advanced reasoning for intent detection
const GEMINI_CHAT_MODEL = 'gemini-2.5-flash'
const GEMINI_INTENT_MODEL = 'gemini-2.5-pro'

// Source-specific context for the agent
const SOURCE_CONTEXT: Record<AppointmentSource, string> = {
  hvac: 'HVAC (heating, ventilation, and air conditioning) services including installation, repair, and maintenance',
  plumbing: 'plumbing services including pipe repair, drain cleaning, water heater installation, and emergency plumbing',
  electrical: 'electrical services including wiring, panel upgrades, outlet installation, and electrical repairs',
  smile: 'dental and smile makeover services including cosmetic dentistry, teeth whitening, and smile assessments',
  crm: 'business services and general inquiries',
  manual: 'business services and general inquiries',
  ai_agent: 'business services and general inquiries',
}

function buildSystemPrompt(context: AgentContext, eventTypes: CalendlyEventType[]): string {
  const serviceContext = SOURCE_CONTEXT[context.source] || SOURCE_CONTEXT.crm
  const eventTypeList = eventTypes.length > 0
    ? eventTypes.map(et => `- ${et.name} (${et.duration} minutes): ${et.description || 'Available for booking'}`).join('\n')
    : '- 30-minute consultation call\n- 60-minute in-depth consultation'

  const leadContext = context.leadInfo
    ? `\nKnown lead information:\n- Name: ${context.leadInfo.name || 'Not provided'}\n- Email: ${context.leadInfo.email || 'Not provided'}\n- Phone: ${context.leadInfo.phone || 'Not provided'}\n- Service interest: ${context.leadInfo.serviceType || 'Not specified'}`
    : ''

  return `You are the RankedCEO AI Assistant, a professional and helpful scheduling assistant for a company offering ${serviceContext}.

Your primary goal is to help prospects and customers book a call or appointment with our team.

Available appointment types:
${eventTypeList}
${leadContext}

Guidelines:
1. Be professional, warm, and concise. Keep responses under 3 sentences when possible.
2. Collect the following information if not already known: full name, email address, phone number (optional), and preferred appointment type.
3. Once you have their name and email, offer to show them available booking times.
4. When the user is ready to book, respond with the action "show_booking" to display the calendar.
5. Never make up availability - always direct users to the booking calendar for actual time selection.
6. If asked about services, pricing, or technical questions, acknowledge the question and suggest booking a call to discuss in detail.
7. Do not discuss competitors or make guarantees about pricing.
8. If the user seems frustrated or has an urgent issue, empathize and prioritize getting them booked quickly.

Current date/time: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} Eastern Time.

Respond in plain text only - no markdown, no bullet points, no special formatting.`
}

// ── Intent Detection ─────────────────────────────────────────

function detectBookingIntent(message: string): boolean {
  const bookingKeywords = [
    'book', 'schedule', 'appointment', 'call', 'meeting', 'available',
    'availability', 'time', 'slot', 'calendar', 'talk', 'speak', 'chat',
    'consult', 'consultation', 'set up', 'arrange', 'reserve', 'yes',
    'sure', 'sounds good', 'let\'s do it', 'ready', 'proceed',
  ]
  const lower = message.toLowerCase()
  return bookingKeywords.some(kw => lower.includes(kw))
}

// Advanced intent detection using gemini-2.5-pro for higher accuracy
export async function detectAdvancedBookingIntent(
  messages: AgentMessage[]
): Promise<{ detected: boolean; confidence: number; notes?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { detected: false, confidence: 0 }

  const recentMessages = messages
    .slice(-6)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  const prompt = `Analyze this conversation and determine if the user wants to book an appointment or schedule a call.

Conversation:
${recentMessages}

Respond ONLY with valid JSON (no markdown, no code blocks):
{"detected": true or false, "confidence": 0.0 to 1.0, "notes": "brief reason"}`

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_INTENT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 128,
          },
        }),
      }
    )

    if (!response.ok) {
      console.warn('[AI Agent] Intent detection API error:', response.status)
      return { detected: false, confidence: 0 }
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      detected: parsed.detected ?? false,
      confidence: parsed.confidence ?? 0,
      notes: parsed.notes,
    }
  } catch (err) {
    console.warn('[AI Agent] Intent detection failed, falling back to keyword detection:', err)
    return { detected: false, confidence: 0 }
  }
}


function detectInfoComplete(
  messages: AgentMessage[],
  leadInfo?: AgentContext['leadInfo']
): boolean {
  if (leadInfo?.name && leadInfo?.email) return true

  // Check if name and email were mentioned in conversation
  const allText = messages.map(m => m.content).join(' ').toLowerCase()
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(allText)
  const hasName = messages.some(m =>
    m.role === 'assistant' && m.content.toLowerCase().includes('thank you')
  )
  return hasEmail && hasName
}

// ── Extract lead info from conversation ─────────────────────

export function extractLeadInfo(messages: AgentMessage[]): {
  name?: string
  email?: string
  phone?: string
} {
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content).join(' ')

  // Extract email
  const emailMatch = userMessages.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  const email = emailMatch?.[0]

  // Extract phone
  const phoneMatch = userMessages.match(/(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/)
  const phone = phoneMatch?.[0]

  // Extract name (improved heuristic with multiple patterns)
  let name: string | undefined

  // Pattern 1: "I'm [Name]", "I am [Name]", "My name is [Name]", "This is [Name]", "Call me [Name]"
  const nameMatch1 = userMessages.match(
    /(?:i'm|i am|my name is|this is|call me|name is|it's|its)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?)/i
  )
  if (nameMatch1?.[1]) {
    name = nameMatch1[1]
  }

  // Pattern 2: Look for capitalized words that look like names (2-3 words, not at start of sentence)
  if (!name) {
    const nameMatch2 = userMessages.match(
      /(?:^|[.!?]\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?)(?:\s+(?:is|here|speaking|calling|available))?/i
    )
    if (nameMatch2?.[1]) {
      // Filter out common words that might match the pattern
      const commonWords = ['This', 'That', 'There', 'Here', 'Hello', 'Hi', 'Hey', 'Good', 'Great', 'Thanks', 'Please', 'Sorry', 'Yes', 'No', 'Okay', 'Sure', 'Alright', 'Well', 'Now', 'Today', 'Tomorrow', 'Yesterday']
      const potentialName = nameMatch2[1]
      if (!commonWords.includes(potentialName)) {
        name = potentialName
      }
    }
  }

  // Pattern 3: Look for name-like patterns near email/phone
  if (!name && (email || phone)) {
    // Find words before email or phone that might be a name
    const beforeEmail = email ? userMessages.substring(0, userMessages.indexOf(email)).trim() : ''
    const beforePhone = phone ? userMessages.substring(0, userMessages.indexOf(phone)).trim() : ''
    
    // Try to extract name from the text before email/phone
    const nameMatch3 = (beforeEmail || beforePhone).match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?)$/i)
    if (nameMatch3?.[1]) {
      const commonWords = ['This', 'That', 'There', 'Here', 'Hello', 'Hi', 'Hey', 'Good', 'Great', 'Thanks', 'Please', 'Sorry', 'Yes', 'No', 'Okay', 'Sure', 'Alright', 'Well', 'Now', 'Today', 'Tomorrow', 'Yesterday', 'My', 'Name', 'Is', 'Email', 'Phone', 'Contact', 'Number']
      const potentialName = nameMatch3[1]
      if (!commonWords.includes(potentialName)) {
        name = potentialName
      }
    }
  }

  console.log('[extractLeadInfo] Extraction result:', { name, email, phone, userMessages: userMessages.substring(0, 100) })

  return { name, email, phone }
}

// ── Main Chat Function ───────────────────────────────────────

export async function chat(
  userMessage: string,
  history: AgentMessage[],
  context: AgentContext,
  eventTypes: CalendlyEventType[] = []
): Promise<AgentChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const systemPrompt = buildSystemPrompt(context, eventTypes)

  // Build Gemini conversation history
  const geminiHistory = history
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      ...geminiHistory,
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 512,
      topP: 0.9,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  }

  const response = await fetch(
    `${GEMINI_API_BASE}/models/${GEMINI_CHAT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('[AI Agent] Gemini API error:', error)
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  const assistantMessage: string =
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    "I'm sorry, I'm having trouble responding right now. Please try again in a moment."

  // Determine action based on conversation state
  const updatedHistory = [
    ...history,
    { role: 'user' as const, content: userMessage },
    { role: 'assistant' as const, content: assistantMessage },
  ]

  const extractedInfo = extractLeadInfo(updatedHistory)
  const hasLeadInfo = !!(
    (context.leadInfo?.name || extractedInfo.name) &&
    (context.leadInfo?.email || extractedInfo.email)
  )

  // Use keyword detection as fast first pass, then gemini-2.5-pro for accuracy
  const keywordIntent = detectBookingIntent(userMessage) || detectBookingIntent(assistantMessage)
  let wantsToBook = keywordIntent

  if (!keywordIntent && updatedHistory.length >= 4) {
    // Only call pro model when keyword detection misses and conversation is established
    const advancedIntent = await detectAdvancedBookingIntent(updatedHistory)
    if (advancedIntent.detected && advancedIntent.confidence >= 0.75) {
      wantsToBook = true
      console.log('[AI Agent] Advanced intent detected:', advancedIntent.notes)
    }
  }

  let action: AgentChatResponse['action'] = 'none'
  let bookingData: AgentChatResponse['bookingData'] = undefined

  // ── If we have lead info AND booking intent → trigger booking immediately ──
  // Do NOT let the AI ask "Would you like to see times?" — just act.
  if (hasLeadInfo && wantsToBook) {
    action = 'show_booking'
    if (eventTypes.length > 0) {
      const primaryEventType = eventTypes[0]
      bookingData = {
        eventTypeUri: primaryEventType.uri,
        eventTypeName: primaryEventType.name,
        schedulingUrl: primaryEventType.scheduling_url,
      }
    }
  } else if (!hasLeadInfo) {
    action = 'collect_info'
  }

  return {
    message: assistantMessage,
    action,
    bookingData,
  }
}

// ── Generate greeting message ────────────────────────────────

export function getGreetingMessage(
  source: AppointmentSource,
  leadName?: string
): string {
  const greetings: Record<AppointmentSource, string> = {
    hvac: `Hi${leadName ? ` ${leadName}` : ''}! I'm the RankedCEO AI Assistant. I see you're interested in HVAC services. I'd love to help you schedule a call with one of our specialists. What's the best way to reach you?`,
    plumbing: `Hi${leadName ? ` ${leadName}` : ''}! I'm the RankedCEO AI Assistant. Thanks for reaching out about plumbing services. Let me help you get connected with our team. Can I get your name and email to get started?`,
    electrical: `Hi${leadName ? ` ${leadName}` : ''}! I'm the RankedCEO AI Assistant. I see you're looking for electrical services. I'd be happy to schedule a consultation for you. What's your name and best email address?`,
    smile: `Hi${leadName ? ` ${leadName}` : ''}! I'm the RankedCEO AI Assistant. Thank you for completing your smile assessment! Our dental team would love to discuss your results. Can I help you schedule a consultation?`,
    crm: `Hello${leadName ? ` ${leadName}` : ''}! I'm the RankedCEO AI Assistant. I'm here to help you schedule a call or appointment. How can I assist you today?`,
    manual: `Hello${leadName ? ` ${leadName}` : ''}! I'm the RankedCEO AI Assistant. How can I help you today?`,
    ai_agent: `Hello${leadName ? ` ${leadName}` : ''}! I'm the RankedCEO AI Assistant. How can I help you today?`,
  }

  return greetings[source] || greetings.crm
}