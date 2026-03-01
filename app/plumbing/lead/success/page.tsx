import Link from 'next/link'
import { CheckCircle, Wrench, Phone, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatWidget } from '@/components/agent/chat-widget'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function PlumbingLeadSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-25 flex items-center justify-center p-4">
      <div className="mx-auto max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-teal-100 p-4">
            <Wrench className="h-10 w-10 text-teal-600" />
          </div>
        </div>
        <div className="rounded-xl bg-white p-8 shadow-lg border border-teal-100 text-center">
          <div className="mb-5 flex justify-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Request Submitted!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for reaching out. A licensed plumber will review your request and contact you shortly.
          </p>
          <div className="rounded-lg bg-teal-50 border border-teal-200 p-4 mb-6 text-left space-y-3">
            <p className="text-sm font-semibold text-teal-900">What happens next?</p>
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">A plumber will call or text you at the number you provided.</p>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">
                Emergency requests are prioritized for same-day response. Standard requests within 24–48 hours.
              </p>
            </div>
          </div>
          <Link href="/">
            <Button className="w-full bg-teal-600 hover:bg-teal-700">Return to Homepage</Button>
          </Link>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">Plumb Pro · Powered by RankedCEO</p>
      </div>

      <ChatWidget
        source="plumbing"
        primaryColor="#0d9488"
        position="bottom-right"
      />
    </div>
  )
}