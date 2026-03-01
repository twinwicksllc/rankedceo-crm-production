'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, X, ChevronLeft, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CalendlyEventType, CalendlyAvailableSlot, AppointmentSource } from '@/lib/types/appointment'
import { format, addDays, startOfDay, isSameDay } from 'date-fns'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  onBooked?: (schedulingUrl: string) => void
  source: AppointmentSource
  accountId?: string
  leadInfo?: {
    name?: string
    email?: string
    phone?: string
  }
  primaryColor?: string
}

type Step = 'event-type' | 'datetime' | 'details' | 'confirm' | 'success'

export function BookingModal({
  isOpen,
  onClose,
  onBooked,
  source,
  accountId,
  leadInfo,
  primaryColor = '#7c3aed',
}: BookingModalProps) {
  const [step, setStep] = useState<Step>('event-type')
  const [eventTypes, setEventTypes] = useState<CalendlyEventType[]>([])
  const [selectedEventType, setSelectedEventType] = useState<CalendlyEventType | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [slots, setSlots] = useState<CalendlyAvailableSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<CalendlyAvailableSlot | null>(null)
  const [isLoadingEventTypes, setIsLoadingEventTypes] = useState(false)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isBooking, setIsBooking] = useState(false)
  const [schedulingUrl, setSchedulingUrl] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: leadInfo?.name || '',
    email: leadInfo?.email || '',
    phone: leadInfo?.phone || '',
  })
  const [calendarWeekStart, setCalendarWeekStart] = useState(startOfDay(new Date()))

  useEffect(() => {
    if (isOpen) {
      loadEventTypes()
      setStep('event-type')
    }
  }, [isOpen])

  useEffect(() => {
    if (selectedEventType && selectedDate) {
      loadSlots()
    }
  }, [selectedEventType, selectedDate])

  async function loadEventTypes() {
    setIsLoadingEventTypes(true)
    try {
      const params = accountId ? `?account_id=${accountId}` : ''
      const res = await fetch(`/api/calendly/event-types${params}`)
      const data = await res.json()
      if (data.event_types) {
        setEventTypes(data.event_types)
      }
    } catch (err) {
      console.error('Failed to load event types:', err)
    } finally {
      setIsLoadingEventTypes(false)
    }
  }

  async function loadSlots() {
    if (!selectedEventType) return
    setIsLoadingSlots(true)
    setSlots([])
    try {
      const startTime = startOfDay(selectedDate).toISOString()
      const endTime = new Date(startOfDay(selectedDate).getTime() + 24 * 60 * 60 * 1000).toISOString()
      const params = new URLSearchParams({
        event_type_uri: selectedEventType.uri,
        start_time: startTime,
        end_time: endTime,
        ...(accountId ? { account_id: accountId } : {}),
      })
      const res = await fetch(`/api/calendly/availability?${params}`)
      const data = await res.json()
      setSlots(data.slots || [])
    } catch (err) {
      console.error('Failed to load slots:', err)
    } finally {
      setIsLoadingSlots(false)
    }
  }

  function handleSelectEventType(et: CalendlyEventType) {
    setSelectedEventType(et)
    // Use Calendly's hosted scheduling page directly
    setSchedulingUrl(et.scheduling_url)
    setStep('confirm')
  }

  function handleConfirmBooking() {
    if (schedulingUrl) {
      onBooked?.(schedulingUrl)
      setStep('success')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 text-white"
          style={{ backgroundColor: primaryColor }}>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            <h2 className="font-semibold">Schedule an Appointment</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step: Select Event Type */}
        {step === 'event-type' && (
          <div className="p-6">
            <p className="text-sm text-gray-500 mb-4">Choose the type of appointment you'd like to schedule:</p>
            {isLoadingEventTypes ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : eventTypes.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No appointment types available at this time.</p>
                <p className="text-gray-400 text-xs mt-1">Please contact us directly to schedule.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {eventTypes.map(et => (
                  <button
                    key={et.uri}
                    onClick={() => handleSelectEventType(et)}
                    className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-purple-700">{et.name}</p>
                        {et.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{et.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-gray-400 text-sm flex-shrink-0 ml-4">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{et.duration} min</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Confirm & Open Calendly */}
        {step === 'confirm' && selectedEventType && (
          <div className="p-6">
            <button
              onClick={() => setStep('event-type')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <div className="rounded-xl border-2 border-gray-100 p-4 mb-6">
              <p className="font-medium text-gray-900">{selectedEventType.name}</p>
              <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{selectedEventType.duration} minutes</span>
              </div>
              {selectedEventType.description && (
                <p className="text-sm text-gray-500 mt-2">{selectedEventType.description}</p>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-6">
              You'll be taken to our scheduling page to pick a time that works best for you.
            </p>
            <Button
              onClick={handleConfirmBooking}
              className="w-full text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Choose a Time
            </Button>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">You're all set!</h3>
            <p className="text-gray-500 text-sm mb-6">
              The scheduling page has been opened. Complete your booking there and you'll receive a confirmation email.
            </p>
            <Button onClick={onClose} variant="outline" className="w-full">
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}