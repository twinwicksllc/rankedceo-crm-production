'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Loader2, Calendar, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AgentMessage, AppointmentSource, AgentChatResponse } from '@/lib/types/appointment'

interface ChatWidgetProps {
  source: AppointmentSource
  accountId?: string
  leadInfo?: {
    name?: string
    email?: string
    phone?: string
    serviceType?: string
  }
  primaryColor?: string
  position?: 'bottom-right' | 'bottom-left'
}

// Extended response type with our new fields
interface EnrichedChatResponse extends AgentChatResponse {
  leadCaptured?: boolean
  leadId?: string | null
  hasCalendly?: boolean
  calendlyUrl?: string | null
  triggerBooking?: boolean
}

function generateSessionId(): string {
  // Reuse session from sessionStorage so refreshes keep the same session
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('agent_session_id')
    if (stored) return stored
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('agent_session_id', newId)
    return newId
  }
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function ChatWidget({
  source,
  accountId,
  leadInfo,
  primaryColor = '#7c3aed',
  position = 'bottom-right',
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => generateSessionId())
  const [bookingUrl, setBookingUrl] = useState<string | null>(null)
  const [showBooking, setShowBooking] = useState(false)
  const [hasGreeted, setHasGreeted] = useState(false)
  const [leadCaptured, setLeadCaptured] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const positionClass = position === 'bottom-right'
    ? 'bottom-6 right-6'
    : 'bottom-6 left-6'

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Load greeting when widget opens
  useEffect(() => {
    if (isOpen && !hasGreeted) {
      loadStaticGreeting()
      setHasGreeted(true)
    }
  }, [isOpen, hasGreeted])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  function loadStaticGreeting() {
    // Static, industry-specific greetings - no AI calls!
    const greetings: Record<AppointmentSource, string> = {
      hvac: "Hi there! 👋 I'm here to help you with your HVAC needs. To get started, could you please share your name, phone number, and email address?",
      plumbing: "Hello! 👋 I'm here to help with your plumbing needs. Could you please provide your name, phone number, and email address so we can assist you?",
      electrical: "Hi! 👋 I'm here to help with your electrical needs. Please share your name, phone number, and email address to get started.",
      smile: "Welcome! 👋 I'm here to help with your smile transformation. Could you please share your name, phone number, and email address?",
      crm: "Hello! 👋 I'm here to help you. Please share your name, phone number, and email address to get started.",
      manual: "Hello! 👋 I'm here to help you. Please share your name, phone number, and email address to get started.",
      ai_agent: "Hello! 👋 I'm here to help you. Please share your name, phone number, and email address to get started.",
    }

    setMessages([{
      role: 'assistant',
      content: greetings[source] || greetings.crm,
      timestamp: new Date().toISOString(),
    }])
  }

  // ───────── Handle close button ───────────────────────────────────────────────────────
  // If lead info was NOT captured, refresh the page so the form is shown again.
  // If lead info WAS captured, just close the widget.
  // CRITICAL: This function ONLY manages isOpen state and refresh logic - NO redirects!
  function handleClose() {
    setIsOpen(false)
    if (!leadCaptured) {
      // Small delay so the close animation plays before refresh
      setTimeout(() => {
        window.location.reload()
      }, 300)
    }
  }

  async function sendMessage(text?: string) {
    const messageText = text || input.trim()
    if (!messageText || isLoading) return

    // CRITICAL: Track widget state at message send time to prevent redirect on close
    const wasOpenWhenSent = isOpen

    setInput('')
    setIsLoading(true)

    const userMessage: AgentMessage = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMessage])

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          sessionId,
          source,
          accountId,
          leadInfo,
        }),
      })

      const data: EnrichedChatResponse = await res.json()

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
      }])

      // Track whether lead info has been captured
      if (data.leadCaptured) {
        setLeadCaptured(true)
      }

      // ── Calendly redirect (ONLY when triggerBooking is true) ───────────────
      // CRITICAL: Only redirect if:
      // 1. triggerBooking=true (API confirmed booking intent + info)
      // 2. Widget is STILL OPEN (user didn't close it)
      // 3. Widget was open when message was sent
      // 
      // IMPORTANT: Do NOT redirect just because calendlyUrl is present.
      // The user must explicitly request booking (e.g., "book a call").
      // This allows users to ask questions (like "pricing") after providing info.
      if (data.triggerBooking && data.calendlyUrl && isOpen && wasOpenWhenSent) {
        console.log('[Chat Widget] Triggering Calendly redirect:', {
          triggerBooking: data.triggerBooking,
          calendlyUrl: data.calendlyUrl,
          isOpen,
          wasOpenWhenSent,
        })
        
        // Open Calendly in new tab after short delay so user sees the message
        setTimeout(() => {
          if (isOpen) { // Double-check before redirecting
            console.log('[Chat Widget] Opening Calendly:', data.calendlyUrl)
            window.open(data.calendlyUrl!, '_blank')
          }
        }, 800)
        return
      }

      // ── Show inline Calendly iframe (fallback for show_booking action) ───────
      if (data.action === 'show_booking' && data.bookingData?.schedulingUrl) {
        console.log('[Chat Widget] Showing inline Calendly iframe')
        setBookingUrl(data.bookingData.schedulingUrl)
        setShowBooking(true)
      }

    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm sorry, I'm having trouble right now. Please try again in a moment.",
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const colorStyle = { '--agent-color': primaryColor } as React.CSSProperties

  return (
    <div className={`fixed ${positionClass} z-50`} style={colorStyle}>
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-80 sm:w-96 rounded-2xl shadow-2xl border border-gray-200 bg-white overflow-hidden flex flex-col"
          style={{ height: showBooking ? '600px' : '480px' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 text-white"
            style={{ backgroundColor: primaryColor }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">RankedCEO AI Assistant</p>
                <p className="text-xs opacity-80">● Online</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Booking iframe or Chat */}
          {showBooking && bookingUrl ? (
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-2 bg-green-50 border-b border-green-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-700">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Schedule Your Appointment</span>
                </div>
                <button
                  onClick={() => setShowBooking(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  ← Back to chat
                </button>
              </div>
              <iframe
                src={bookingUrl}
                className="flex-1 w-full border-0"
                title="Schedule Appointment"
              />
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full flex-shrink-0 mr-2 mt-1 flex items-center justify-center"
                        style={{ backgroundColor: primaryColor }}>
                        <Bot className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'text-white rounded-br-sm'
                          : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
                      }`}
                      style={msg.role === 'user' ? { backgroundColor: primaryColor } : {}}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 rounded-full flex-shrink-0 mr-2 mt-1 flex items-center justify-center"
                      style={{ backgroundColor: primaryColor }}>
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                    <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                      <div className="flex gap-1 items-center h-4">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick replies - shown only on first message */}
              {messages.length === 1 && (
                <div className="px-4 py-2 flex gap-2 flex-wrap border-t border-gray-100 bg-white">
                  {['I need help', 'Book a call', 'Get a quote'].map(reply => (
                    <button
                      key={reply}
                      onClick={() => sendMessage(reply)}
                      className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:text-white"
                      style={{ borderColor: primaryColor, color: primaryColor }}
                      onMouseEnter={e => {
                        (e.target as HTMLElement).style.backgroundColor = primaryColor
                        ;(e.target as HTMLElement).style.color = 'white'
                      }}
                      onMouseLeave={e => {
                        (e.target as HTMLElement).style.backgroundColor = 'transparent'
                        ;(e.target as HTMLElement).style.color = primaryColor
                      }}
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t border-gray-200 bg-white flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  disabled={isLoading}
                  className="flex-1 text-sm border-gray-200 focus:ring-1 rounded-full px-4"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-opacity disabled:opacity-40 flex-shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => isOpen ? handleClose() : setIsOpen(true)}
        className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-95"
        style={{ backgroundColor: primaryColor }}
        aria-label="Open AI Assistant"
      >
        {isOpen
          ? <X className="w-6 h-6" />
          : <MessageCircle className="w-6 h-6" />
        }
      </button>
    </div>
  )
}