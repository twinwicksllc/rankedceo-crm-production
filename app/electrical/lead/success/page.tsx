import Link from 'next/link'
import { ChatWidget } from '@/components/agent/chat-widget'
import { CheckCircle, Lightbulb, Phone, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function ElectricalLeadSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-25 flex items-center justify-center p-4">
      <div className="mx-auto max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-amber-100 p-4">
            <Lightbulb className="h-10 w-10 text-amber-600" />
          </div>
        </div>
        <div className="rounded-xl bg-white p-8 shadow-lg border border-amber-100 text-center">
          <div className="mb-5 flex justify-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Request Submitted!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for reaching out. A licensed electrician will review your request and contact you shortly.
          </p>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-6 text-left space-y-3">
            <p className="text-sm font-semibold text-amber-900">What happens next?</p>
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">An electrician will call or text you at the number you provided.</p>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">
                Emergency requests are prioritized for same-day response. Standard requests within 24–48 hours.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 mb-6">
            <p className="text-xs text-amber-800">
              ⚠️ If this is a safety emergency (sparks, burning smell, or no power), please call 911 or your local utility company immediately.
            </p>
          </div>
          <Link href="/">
            <Button className="w-full bg-amber-600 hover:bg-amber-700">Return to Homepage</Button>
          </Link>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">Spark Pro · Powered by RankedCEO</p>
      </div>

      <ChatWidget
        source="electrical"
        primaryColor="#d97706"
        position="bottom-right"
      />
    </div>
  )
}