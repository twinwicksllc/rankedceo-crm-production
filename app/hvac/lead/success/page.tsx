import Link from 'next/link'
import { CheckCircle, Flame, Phone, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatWidget } from '@/components/agent/chat-widget'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function HvacLeadSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-25 flex items-center justify-center p-4">
      <div className="mx-auto max-w-md w-full">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-blue-100 p-4">
            <Flame className="h-10 w-10 text-blue-600" />
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl bg-white p-8 shadow-lg border border-blue-100 text-center">
          <div className="mb-5 flex justify-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Request Submitted!
          </h1>

          <p className="text-gray-600 mb-6">
            Thank you for reaching out. A certified HVAC technician will review your request and contact you shortly.
          </p>

          {/* What's next */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 mb-6 text-left space-y-3">
            <p className="text-sm font-semibold text-blue-900">What happens next?</p>
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">
                A technician will call or text you at the number you provided.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">
                Emergency requests are prioritized for same-day response. Standard requests within 24–48 hours.
              </p>
            </div>
          </div>

          <Link href="/">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Return to Homepage
            </Button>
          </Link>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          HVAC Pro · Powered by RankedCEO
        </p>
      </div>

      <ChatWidget
        source="hvac"
        primaryColor="#2563eb"
        position="bottom-right"
      />
    </div>
  )
}