import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function AssessmentSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-25 flex items-center justify-center">
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <div className="mb-8">
          <Image
            src="/smile_logo.png"
            alt="Smile MakeOver"
            width={150}
            height={60}
            className="h-16 w-auto mx-auto"
            priority
          />
        </div>

        <div className="rounded-lg bg-white p-8 shadow-lg border border-purple-100">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Assessment Submitted Successfully!
          </h1>

          <p className="text-gray-600 mb-6">
            Thank you for completing your smile assessment. Your dentist will review your information and contact you shortly to discuss your smile transformation options.
          </p>

          <div className="rounded-lg bg-purple-50 border border-purple-200 p-4 mb-6">
            <p className="text-sm text-purple-900">
              <strong>What's Next?</strong>
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Your dentist will review your assessment and reach out within 1-2 business days to schedule a consultation.
            </p>
          </div>

          <Link href="/">
            <Button className="w-full bg-purple-600 hover:bg-purple-700">
              Return to Homepage
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
