'use client'

import { useState, useEffect } from 'react'
import { Calendar, CheckCircle2, ExternalLink, Loader2, Link2Off, RefreshCw, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CalendlyStatus {
  connected: boolean
  user?: {
    name: string | null
    email: string | null
  }
  event_types?: Array<{ name: string; duration: number; scheduling_url: string }>
}

export function IntegrationsSettings() {
  const [calendly, setCalendly] = useState<CalendlyStatus>({ connected: false })
  const [isLoading, setIsLoading] = useState(true)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    // Check for success/error params in URL
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'calendly_connected') {
      setSuccessMessage('Calendly connected successfully!')
      // Clean URL
      window.history.replaceState({}, '', '/settings?tab=integrations')
    }
    if (params.get('error')) {
      const errors: Record<string, string> = {
        calendly_denied: 'Calendly authorization was denied.',
        calendly_invalid: 'Invalid OAuth response from Calendly.',
        calendly_state_mismatch: 'Security check failed. Please try again.',
        calendly_failed: 'Failed to connect Calendly. Please try again.',
      }
      setErrorMessage(errors[params.get('error')!] || 'An error occurred.')
      window.history.replaceState({}, '', '/settings?tab=integrations')
    }

    loadCalendlyStatus()
  }, [])

  async function loadCalendlyStatus() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/calendly/event-types')
      const data = await res.json()
      setCalendly({
        connected: data.connected || false,
        user: data.user,
        event_types: data.event_types || [],
      })
    } catch {
      setCalendly({ connected: false })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect Calendly?')) return
    setIsDisconnecting(true)
    try {
      await fetch('/api/calendly/disconnect', { method: 'POST' })
      setCalendly({ connected: false })
      setSuccessMessage('Calendly disconnected.')
    } catch {
      setErrorMessage('Failed to disconnect. Please try again.')
    } finally {
      setIsDisconnecting(false)
    }
  }

  function handleConnect() {
    window.location.href = '/api/calendly/connect'
  }

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Calendly Integration Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Calendly</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Connect your Calendly account to enable AI-powered appointment booking
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              ) : calendly.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  Not Connected
                </span>
              )}
            </div>
          </div>

          {/* Connected State */}
          {calendly.connected && calendly.user && (
            <div className="mt-5 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Connected as:</p>
              <p className="text-sm text-gray-900 mt-0.5">{calendly.user.name}</p>
              <p className="text-xs text-gray-500">{calendly.user.email}</p>

              {calendly.event_types && calendly.event_types.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Active Event Types ({calendly.event_types.length})
                  </p>
                  <div className="space-y-1.5">
                    {calendly.event_types.map((et, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="w-3 h-3 text-blue-500" />
                          <span className="text-sm text-gray-700">{et.name}</span>
                          <span className="text-xs text-gray-400">({et.duration} min)</span>
                        </div>
                        <a
                          href={et.scheduling_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 flex gap-3">
            {calendly.connected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadCalendlyStatus}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  {isDisconnecting ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Link2Off className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConnect}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <Calendar className="w-3.5 h-3.5 mr-1.5" />
                Connect Calendly
              </Button>
            )}
          </div>
        </div>

        {/* How it works */}
        {!calendly.connected && (
          <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">How it works</p>
            <ul className="space-y-1.5 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                Connect your Calendly account with one click
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                The AI Assistant uses your event types to book appointments
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                Leads on all subdomains can book directly with you
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                Appointments sync automatically to your CRM
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Webhook Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Calendly Webhook</h3>
        <p className="text-sm text-gray-500 mb-3">
          To automatically sync appointment cancellations and reschedules, add this webhook URL in your Calendly developer settings:
        </p>
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <code className="text-xs text-gray-700 flex-1 break-all">
            {typeof window !== 'undefined' ? window.location.origin : 'https://crm.rankedceo.com'}/api/calendly/webhook
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/api/calendly/webhook`)
              setSuccessMessage('Webhook URL copied!')
              setTimeout(() => setSuccessMessage(''), 3000)
            }}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex-shrink-0"
          >
            Copy
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Subscribe to: <code className="bg-gray-100 px-1 rounded">invitee.created</code>, <code className="bg-gray-100 px-1 rounded">invitee.canceled</code>, <code className="bg-gray-100 px-1 rounded">invitee_no_show.created</code>
        </p>
      </div>
    </div>
  )
}