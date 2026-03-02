'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Loader2, Calendar, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AgentMessage, AppointmentSource, AgentChatResponse } from '@/lib/types/appointment'
import { IndustryLogo } from '@/components/ui/industry-logo'

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

  useEffect(() => {
    if (isOpen && !hasGreeted) {
      loadStaticGreeting()
      setHasGreeted(true)
    }
  }, [isOpen, hasGreeted])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])


  // ── Restore chat history from server on mount if session exists ──────────
  useEffect(() => {
    const existingSession = typeof window !== 'undefined'
      ? sessionStorage.getItem('agent_session_id')
      : null
    if (!existingSession) return

    fetch(`/api/agent/history?sessionId=${encodeURIComponent(existingSession)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.messages && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages)
          setHasGreeted(true) // skip static greeting since history loaded
          if (data.leadCaptured) setLeadCaptured(true)
        }
      })
      .catch(() => { /* silently fail — history restore is best-effort */ })
  }, []) // run once on mount

  function loadStaticGreeting() {
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

  function handleClose() {
    setIsOpen(false)
    if (!leadCaptured) {
      setTimeout(() => {
        window.location.reload()
      }, 300)
    }
  }

  async function sendMessage(text?: string) {
    const messageText = text || input.trim()
    if (!messageText || isLoading) return

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

      // ── Full response logging ──────────────────────────────────────────
      console.error('[FINAL-CHECK] Full API response:', JSON.stringify(data))
      console.error('[FINAL-CHECK] triggerBooking:', data.triggerBooking, '| type:', typeof data.triggerBooking)
      console.error('[FINAL-CHECK] action:', data.action)
      console.error('[FINAL-CHECK] calendlyUrl:', data.calendlyUrl)
      console.error('[FINAL-CHECK] message snippet:', (data.message || '').substring(0, 80))

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
      }])

      if (data.leadCaptured) {
        setLeadCaptured(true)
      }

      // ── Redirect: ONLY fire when BOTH triggerBooking===true AND action='show_booking'
      //    Prevents eager redirect when lead info captured but booking not yet requested.
      const triggerBookingTrue = data.triggerBooking === true
      const actionIsBooking = data.action === 'show_booking' || data.action === 'booking_confirmed'

      console.error('[FINAL-CHECK] Redirect check:', {
        triggerBooking: data.triggerBooking,
        action: data.action,
        triggerBookingTrue,
        actionIsBooking,
        calendlyUrl: data.calendlyUrl,
      })

      if (triggerBookingTrue && actionIsBooking && data.calendlyUrl) {
        console.error('[FINAL-CHECK] REDIRECT TRIGGERED BY:', { triggerBooking: data.triggerBooking, action: data.action })
        window.location.assign(data.calendlyUrl)
        return
      } else {
        console.error('[FINAL-CHECK] NOT REDIRECTING - waiting for explicit booking intent')
      }

      // ── Show inline Calendly iframe (fallback) ────────────────────────
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
              {/* Industry logo on white pill, or Bot icon fallback */}
              {['hvac', 'plumbing', 'electrical', 'smile'].includes(source) ? (
                <div className="bg-white rounded-full px-2 py-0.5 flex items-center justify-center h-8">
                  <IndustryLogo
                    industry={source}
                    height={24}
                    priority
                    showFallback={false}
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold">AI Assistant</p>
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

              {/* Quick replies */}
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