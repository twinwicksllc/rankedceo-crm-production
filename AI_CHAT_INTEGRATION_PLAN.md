# AI Chat Integration Plan - RankedCEO CRM

## Overview
Build an intelligent AI chat widget that can:
- Engage visitors in natural conversation
- Qualify leads through dialogue
- Book appointments via Calendly
- Answer questions about services
- Work across all subdomains (HVAC, Plumbing, Electrical, Smile)

---

## Architecture

### Components
```
┌─────────────────────────────────────────────────────────────┐
│                    AI Chat Widget                            │
│  - Floating chat bubble (bottom-right)                      │
│  - Chat window with message history                         │
│  - Typing indicators                                        │
│  - Quick action buttons                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Chat Widget Component (Client)                  │
│  - State management (messages, status)                       │
│  - Message rendering                                         │
│  - Input handling                                            │
│  - Streaming response handling                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              API Route: /api/agent/chat                     │
│  - Receives user messages                                    │
│  - Maintains conversation context                             │
│  - Calls Gemini AI                                           │
│  - Streams responses back                                    │
│  - Detects booking intent                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              AI Agent Service                                │
│  - Conversation management                                   │
│  - Intent detection (booking, inquiry, support)              │
│  - Lead qualification logic                                  │
│  - Calendly integration                                      │
│  - Context building (industry, services)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Gemini AI (Google)                              │
│  - Natural language processing                               │
│  - Conversation history                                      │
│  - Industry-specific knowledge                               │
│  - Booking intent detection                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Calendly API                                    │
│  - Get available time slots                                  │
│  - Create booking                                            │
│  - Send confirmation                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation (2-3 hours)

### 1.1 Database Schema
**File:** `supabase/migrations/20240301000003_create_agent_conversations.sql`

```sql
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Multi-tenant
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  
  -- Session tracking
  session_id TEXT NOT NULL UNIQUE,
  
  -- Lead capture
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone TEXT,
  
  -- Conversation state
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'qualified', 'booked', 'closed')),
  intent TEXT, -- 'booking', 'inquiry', 'support', 'general'
  
  -- Industry context
  industry TEXT, -- 'hvac', 'plumbing', 'electrical', 'smile', 'crm'
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- RLS
  CONSTRAINT valid_session CHECK (session_id IS NOT NULL)
);

CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  
  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- Message metadata
  metadata JSONB DEFAULT '{}',
  
  -- Intent detection
  detected_intent TEXT,
  confidence_score NUMERIC
);

-- Indexes
CREATE INDEX idx_agent_conversations_session ON agent_conversations(session_id);
CREATE INDEX idx_agent_conversations_account ON agent_conversations(account_id);
CREATE INDEX idx_agent_conversations_status ON agent_conversations(status);
CREATE INDEX idx_agent_messages_conversation ON agent_messages(conversation_id);
CREATE INDEX idx_agent_messages_created ON agent_messages(created_at);

-- RLS Policies
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view account conversations" ON agent_conversations
  FOR SELECT TO authenticated
  USING (account_id = get_current_user_account_id());

CREATE POLICY "Users can manage account conversations" ON agent_conversations
  FOR ALL TO authenticated
  USING (account_id = get_current_user_account_id())
  WITH CHECK (account_id = get_current_user_account_id());

CREATE POLICY "Users can view account messages" ON agent_messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM agent_conversations 
      WHERE account_id = get_current_user_account_id()
    )
  );

CREATE POLICY "Users can manage account messages" ON agent_messages
  FOR ALL TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM agent_conversations 
      WHERE account_id = get_current_user_account_id()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM agent_conversations 
      WHERE account_id = get_current_user_account_id()
    )
  );
```

### 1.2 TypeScript Types
**File:** `lib/types/agent.ts`

```typescript
export interface AgentConversation {
  id: string
  created_at: string
  updated_at: string
  account_id: string
  session_id: string
  visitor_name?: string
  visitor_email?: string
  visitor_phone?: string
  status: 'active' | 'qualified' | 'booked' | 'closed'
  intent?: string
  industry?: string
  metadata: Record<string, any>
}

export interface AgentMessage {
  id: string
  created_at: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata: Record<string, any>
  detected_intent?: string
  confidence_score?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isTyping?: boolean
}

export interface BookingIntent {
  detected: boolean
  confidence: number
  preferredDate?: string
  preferredTime?: string
  serviceType?: string
  notes?: string
}

export interface IndustryContext {
  industry: 'hvac' | 'plumbing' | 'electrical' | 'smile' | 'crm'
  services: string[]
  operatingHours: string
  serviceArea: string
  contactInfo: {
    phone?: string
    email?: string
  }
}
```

### 1.3 AI Agent Service
**File:** `lib/services/ai-agent-service.ts`

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createAdminClient } from '@/lib/supabase/admin'
import type { 
  AgentConversation, 
  AgentMessage, 
  ChatMessage,
  BookingIntent,
  IndustryContext 
} from '@/lib/types/agent'

export class AIAgentService {
  private genAI: GoogleGenerativeAI
  private model: any
  private supabase: any

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    })
    this.supabase = createAdminClient()
  }

  // Get industry-specific system prompt
  private getSystemPrompt(industry: string): string {
    const prompts = {
      hvac: `You are a helpful HVAC service assistant for RankedCEO HVAC Pro. 
      Your role is to:
      - Engage visitors in friendly conversation
      - Understand their HVAC needs (heating, cooling, maintenance, repairs)
      - Qualify leads by asking relevant questions
      - Offer to book appointments when appropriate
      - Answer questions about HVAC services
      
      Services offered: AC repair, heating installation, maintenance plans, emergency service
      Operating hours: 7AM-7PM, 7 days a week
      Service area: Greater Chicago area
      
      Be conversational, professional, and helpful. Don't be overly salesy.`,
      
      plumbing: `You are a helpful plumbing service assistant for RankedCEO Plumb Pro.
      Your role is to:
      - Engage visitors in friendly conversation
      - Understand their plumbing needs (repairs, installations, maintenance)
      - Qualify leads by asking relevant questions
      - Offer to book appointments when appropriate
      - Answer questions about plumbing services
      
      Services offered: Emergency repairs, drain cleaning, water heater installation, pipe repairs
      Operating hours: 24/7 emergency service, 7AM-6PM regular hours
      Service area: Greater Chicago area
      
      Be conversational, professional, and helpful. Don't be overly salesy.`,
      
      electrical: `You are a helpful electrical service assistant for RankedCEO Spark Pro.
      Your role is to:
      - Engage visitors in friendly conversation
      - Understand their electrical needs (repairs, installations, inspections)
      - Qualify leads by asking relevant questions
      - Offer to book appointments when appropriate
      - Answer questions about electrical services
      
      Services offered: Electrical repairs, panel upgrades, lighting installation, inspections
      Operating hours: 7AM-7PM, 7 days a week
      Service area: Greater Chicago area
      
      Be conversational, professional, and helpful. Don't be overly salesy.`,
      
      smile: `You are a helpful dental assistant for RankedCEO Smile Dashboard.
      Your role is to:
      - Engage visitors in friendly conversation
      - Understand their dental needs (checkups, cosmetic procedures, emergencies)
      - Qualify leads by asking relevant questions
      - Offer to book appointments when appropriate
      - Answer questions about dental services
      
      Services offered: General dentistry, cosmetic procedures, orthodontics, emergency care
      Operating hours: 8AM-5PM, Monday-Friday
      Service area: Chicago metropolitan area
      
      Be conversational, professional, and helpful. Don't be overly salesy.`,
      
      crm: `You are a helpful assistant for RankedCEO CRM.
      Your role is to:
      - Engage visitors in friendly conversation
      - Understand their business needs
      - Qualify leads by asking relevant questions
      - Offer to book consultations when appropriate
      - Answer questions about CRM services
      
      Services offered: CRM implementation, training, support, custom development
      Operating hours: 9AM-5PM, Monday-Friday
      Service area: Nationwide (remote services)
      
      Be conversational, professional, and helpful. Don't be overly salesy.`
    }
    
    return prompts[industry as keyof typeof prompts] || prompts.crm
  }

  // Detect booking intent from conversation
  async detectBookingIntent(
    messages: ChatMessage[]
  ): Promise<BookingIntent> {
    const recentMessages = messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')
    
    const prompt = `Analyze this conversation and determine if the user wants to book an appointment.

Conversation:
${recentMessages}

Respond in JSON format:
{
  "detected": true/false,
  "confidence": 0.0-1.0,
  "preferredDate": "date mentioned or null",
  "preferredTime": "time mentioned or null",
  "serviceType": "service mentioned or null",
  "notes": "summary of what they need"
}`

    try {
      const result = await this.model.generateContent(prompt)
      const response = result.response.text()
      const parsed = JSON.parse(response)
      
      return {
        detected: parsed.detected || false,
        confidence: parsed.confidence || 0,
        preferredDate: parsed.preferredDate,
        preferredTime: parsed.preferredTime,
        serviceType: parsed.serviceType,
        notes: parsed.notes
      }
    } catch (error) {
      console.error('Error detecting booking intent:', error)
      return { detected: false, confidence: 0 }
    }
  }

  // Generate AI response
  async generateResponse(
    conversationId: string,
    userMessage: string,
    industry: string
  ): Promise<string> {
    // Get conversation history
    const { data: messages } = await this.supabase
      .from('agent_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10)

    // Build conversation context
    const history = messages?.map(m => `${m.role}: ${m.content}`).join('\n') || ''
    
    const systemPrompt = this.getSystemPrompt(industry)
    
    const prompt = `${systemPrompt}

Previous conversation:
${history}

User: ${userMessage}

Respond as the assistant. Be concise (2-3 sentences max) and conversational.`

    try {
      const result = await this.model.generateContent(prompt)
      return result.response.text()
    } catch (error) {
      console.error('Error generating response:', error)
      return "I'm having trouble understanding. Could you please rephrase that?"
    }
  }

  // Create or get conversation
  async getOrCreateConversation(
    sessionId: string,
    industry: string
  ): Promise<AgentConversation> {
    const { data: existing } = await this.supabase
      .from('agent_conversations')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (existing) {
      return existing
    }

    // Get account ID from industry
    const { data: account } = await this.supabase
      .from('accounts')
      .select('id')
      .eq('slug', industry === 'crm' ? 'my-account' : `${industry}-pool`)
      .single()

    if (!account) {
      throw new Error(`Account not found for industry: ${industry}`)
    }

    const { data: newConversation } = await this.supabase
      .from('agent_conversations')
      .insert({
        account_id: account.id,
        session_id: sessionId,
        industry,
        status: 'active'
      })
      .select()
      .single()

    return newConversation
  }

  // Save message
  async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    detectedIntent?: string,
    confidenceScore?: number
  ): Promise<void> {
    await this.supabase
      .from('agent_messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        detected_intent: detectedIntent,
        confidence_score: confidenceScore
      })
  }

  // Update conversation status
  async updateConversationStatus(
    conversationId: string,
    status: 'active' | 'qualified' | 'booked' | 'closed',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.supabase
      .from('agent_conversations')
      .update({ 
        status,
        ...(metadata && { metadata })
      })
      .eq('id', conversationId)
  }
}
```

---

## Phase 2: API Routes (1-2 hours)

### 2.1 Chat API Route
**File:** `app/api/agent/chat/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { AIAgentService } from '@/lib/services/ai-agent-service'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, industry } = await request.json()

    if (!message || !sessionId || !industry) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const service = new AIAgentService()
    
    // Get or create conversation
    const conversation = await service.getOrCreateConversation(sessionId, industry)
    
    // Save user message
    await service.saveMessage(conversation.id, 'user', message)
    
    // Generate AI response
    const response = await service.generateResponse(
      conversation.id,
      message,
      industry
    )
    
    // Save AI response
    await service.saveMessage(conversation.id, 'assistant', response)
    
    // Detect booking intent
    const { data: messages } = await service.supabase
      .from('agent_messages')
      .select('role, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(10)

    const chatMessages = messages?.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.created_at
    })) || []

    const bookingIntent = await service.detectBookingIntent(chatMessages)
    
    // Update conversation if booking intent detected
    if (bookingIntent.detected && bookingIntent.confidence > 0.7) {
      await service.updateConversationStatus(
        conversation.id,
        'qualified',
        { bookingIntent }
      )
    }

    return NextResponse.json({
      response,
      bookingIntent: bookingIntent.detected ? bookingIntent : null,
      conversationId: conversation.id
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    )
  }
}
```

### 2.2 Get Conversation History
**File:** `app/api/agent/conversation/[sessionId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = createAdminClient()
    
    const { data: conversation } = await supabase
      .from('agent_conversations')
      .select('*')
      .eq('session_id', params.sessionId)
      .single()

    if (!conversation) {
      return NextResponse.json({ messages: [] })
    }

    const { data: messages } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      conversation,
      messages: messages || []
    })
  } catch (error) {
    console.error('Get conversation error:', error)
    return NextResponse.json(
      { error: 'Failed to get conversation' },
      { status: 500 }
    )
  }
}
```

---

## Phase 3: UI Components (3-4 hours)

### 3.1 Chat Widget Component
**File:** `components/agent/chat-widget.tsx`

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Calendar, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ChatWidgetProps {
  industry: 'hvac' | 'plumbing' | 'electrical' | 'smile' | 'crm'
  calendlyUrl?: string
}

export function ChatWidget({ industry, calendlyUrl }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => {
    // Generate or retrieve session ID from localStorage
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('chat_session_id')
      if (!id) {
        id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        localStorage.setItem('chat_session_id', id)
      }
      return id
    }
    return `session_${Date.now()}`
  })
  const [bookingIntent, setBookingIntent] = useState<any>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load conversation history on mount
  useEffect(() => {
    loadConversation()
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversation = async () => {
    try {
      const response = await fetch(`/api/agent/conversation/${sessionId}`)
      const data = await response.json()
      
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.created_at
        })))
      }
    } catch (error) {
      console.error('Error loading conversation:', error)
    }
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId,
          industry
        })
      })

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, assistantMessage])
      
      if (data.bookingIntent) {
        setBookingIntent(data.bookingIntent)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => [...prev, {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: "I'm having trouble connecting. Please try again.",
        timestamp: new Date().toISOString()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700 transition-all hover:scale-105"
        aria-label="Open chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="bg-purple-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Chat with us</h3>
          <p className="text-sm text-purple-100">We typically reply in minutes</p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-purple-700 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-purple-200" />
            <p className="text-sm">Start a conversation with us!</p>
            <p className="text-xs text-gray-400 mt-1">We're here to help</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <p className="text-xs mt-1 opacity-70">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Booking Intent Actions */}
      {bookingIntent && bookingIntent.detected && calendlyUrl && (
        <div className="px-4 pb-2">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-sm text-purple-900 font-medium mb-2">
              Would you like to book an appointment?
            </p>
            <a
              href={calendlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              <Calendar className="w-4 h-4" />
              Book Appointment
            </a>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Phase 4: Integration (1-2 hours)

### 4.1 Add to Industry Landing Pages

**HVAC:** `app/hvac/page.tsx`
```typescript
import { ChatWidget } from '@/components/agent/chat-widget'

export default function HVACPage() {
  return (
    <div>
      {/* Existing HVAC content */}
      
      <ChatWidget 
        industry="hvac"
        calendlyUrl="https://calendly.com/your-hvac-calendly"
      />
    </div>
  )
}
```

**Plumbing:** `app/plumbing/page.tsx`
```typescript
import { ChatWidget } from '@/components/agent/chat-widget'

export default function PlumbingPage() {
  return (
    <div>
      {/* Existing plumbing content */}
      
      <ChatWidget 
        industry="plumbing"
        calendlyUrl="https://calendly.com/your-plumbing-calendly"
      />
    </div>
  )
}
```

**Electrical:** `app/electrical/page.tsx`
```typescript
import { ChatWidget } from '@/components/agent/chat-widget'

export default function ElectricalPage() {
  return (
    <div>
      {/* Existing electrical content */}
      
      <ChatWidget 
        industry="electrical"
        calendlyUrl="https://calendly.com/your-electrical-calendly"
      />
    </div>
  )
}
```

**Smile:** `app/smile/page.tsx`
```typescript
import { ChatWidget } from '@/components/agent/chat-widget'

export default function SmilePage() {
  return (
    <div>
      {/* Existing smile content */}
      
      <ChatWidget 
        industry="smile"
        calendlyUrl="https://calendly.com/your-smile-calendly"
      />
    </div>
  )
}
```

**CRM:** `app/page.tsx`
```typescript
import { ChatWidget } from '@/components/agent/chat-widget'

export default function HomePage() {
  return (
    <div>
      {/* Existing CRM landing page */}
      
      <ChatWidget 
        industry="crm"
        calendlyUrl="https://calendly.com/your-crm-calendly"
      />
    </div>
  )
}
```

---

## Phase 5: Testing & Polish (1-2 hours)

### 5.1 Testing Checklist
- [ ] Chat widget opens/closes correctly
- [ ] Messages send and receive correctly
- [ ] Conversation history persists across page refreshes
- [ ] AI responses are relevant and helpful
- [ ] Booking intent detection works
- [ ] Calendly booking link appears when intent detected
- [ ] Works across all subdomains
- [ ] Mobile responsive
- [ ] Loading states display correctly
- [ ] Error handling works

### 5.2 Performance Optimization
- [ ] Implement message caching
- [ ] Add rate limiting
- [ ] Optimize Gemini API calls
- [ ] Add conversation cleanup (old conversations)

### 5.3 Analytics
- [ ] Track chat opens
- [ ] Track message sends
- [ ] Track booking intents
- [ ] Track conversion rates

---

## Environment Variables Required

```bash
# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Calendly (optional - can be hardcoded per industry)
HVAC_CALENDLY_URL=https://calendly.com/your-hvac
PLUMBING_CALENDLY_URL=https://calendly.com/your-plumbing
ELECTRICAL_CALENDLY_URL=https://calendly.com/your-electrical
SMILE_CALENDLY_URL=https://calendly.com/your-smile
CRM_CALENDLY_URL=https://calendly.com/your-crm
```

---

## Estimated Timeline

- **Phase 1: Foundation** - 2-3 hours
- **Phase 2: API Routes** - 1-2 hours
- **Phase 3: UI Components** - 3-4 hours
- **Phase 4: Integration** - 1-2 hours
- **Phase 5: Testing & Polish** - 1-2 hours

**Total: 8-13 hours**

---

## Success Metrics

- Chat widget loads in < 2 seconds
- AI response time < 3 seconds
- Booking intent detection accuracy > 80%
- User satisfaction score > 4/5
- Conversion rate (chat → booking) > 15%

---

## Next Steps

1. Review and approve this plan
2. Set up Gemini API key
3. Create database migration
4. Build AI Agent Service
5. Create API routes
6. Build Chat Widget component
7. Integrate into all subdomains
8. Test thoroughly
9. Deploy to production
10. Monitor and iterate

---

## Future Enhancements

- Multi-language support
- Voice input/output
- File sharing
- Screen sharing
- Video chat integration
- CRM lead auto-creation
- Email follow-up automation
- Analytics dashboard
- A/B testing for prompts
- Custom branding per industry