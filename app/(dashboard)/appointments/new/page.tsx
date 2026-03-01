'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CalendlyEventType } from '@/lib/types/appointment'

export default function NewAppointmentPage() {
  const router = useRouter()
  const [eventTypes, setEventTypes] = useState<CalendlyEventType[]>([])
  const [isLoadingEventTypes, setIsLoadingEventTypes] = useState(true)
  const [isCalendlyConnected, setIsCalendlyConnected] = useState(false)
  const [selectedEventType, setSelectedEventType] = useState<CalendlyEventType | null>(null)
  const [formData, setFormData] = useState({
    invitee_name: '',
    invitee_email: '',
    invitee_phone: '',
    notes: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadEventTypes()
  }, [])

  async function loadEventTypes() {
    try {
      const res = await fetch('/api/calendly/event-types')
      const data = await res.json()
      if (data.connected) {
        setIsCalendlyConnected(true)
        setEventTypes(data.event_types || [])
      }
    } catch (err) {
      console.error('Failed to load event types:', err)
    } finally {
      setIsLoadingEventTypes(false)
    }
  }

  function handleOpenCalendly() {
    if (!selectedEventType) return
    // Pre-fill name/email in Calendly URL if possible
    const url = new URL(selectedEventType.scheduling_url)
    if (formData.invitee_name) url.searchParams.set('name', formData.invitee_name)
    if (formData.invitee_email) url.searchParams.set('email', formData.invitee_email)
    window.open(url.toString(), '_blank')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/appointments" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Appointment</h1>
          <p className="text-gray-500 text-sm mt-0.5">Book a call or meeting with a lead</p>
        </div>
      </div>

      {!isCalendlyConnected && !isLoadingEventTypes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-amber-800 mb-1">Calendly Not Connected</h3>
          <p className="text-sm text-amber-700 mb-3">
            Connect your Calendly account to enable smart scheduling with real-time availability.
          </p>
          <Link
            href="/settings?tab=integrations"
            className="inline-flex items-center gap-2 text-sm font-medium text-amber-800 hover:text-amber-900 underline"
          >
            Connect Calendly in Settings
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Lead Info */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Lead Information</h2>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.invitee_name}
                onChange={e => setFormData(p => ({ ...p, invitee_name: e.target.value }))}
                placeholder="John Smith"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.invitee_email}
                onChange={e => setFormData(p => ({ ...p, invitee_email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.invitee_phone}
                onChange={e => setFormData(p => ({ ...p, invitee_phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Any notes about this appointment..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Event Type Selection */}
        {isCalendlyConnected && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Appointment Type</h2>
            {isLoadingEventTypes ? (
              <div className="flex items-center gap-2 text-gray-400 py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading event types...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {eventTypes.map(et => (
                  <button
                    key={et.uri}
                    onClick={() => setSelectedEventType(et)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedEventType?.uri === et.uri
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{et.name}</p>
                        {et.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{et.description}</p>
                        )}
                      </div>
                      <span className="text-sm text-gray-400 ml-4">{et.duration} min</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Link href="/appointments" className="flex-1">
            <Button variant="outline" className="w-full">Cancel</Button>
          </Link>
          {isCalendlyConnected ? (
            <Button
              onClick={handleOpenCalendly}
              disabled={!selectedEventType || !formData.invitee_name || !formData.invitee_email}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Open Calendly Scheduler
              <ExternalLink className="w-3.5 h-3.5 ml-2" />
            </Button>
          ) : (
            <Button
              disabled
              className="flex-1 bg-gray-200 text-gray-400 cursor-not-allowed"
            >
              Connect Calendly First
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}