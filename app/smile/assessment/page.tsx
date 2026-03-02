import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SmileAssessmentForm } from '@/components/smile/assessment-form'
import { submitSmileAssessment } from '@/lib/actions/smile-assessment'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ChatWidget } from '@/components/agent/chat-widget'
import { IndustryLogo } from '@/components/ui/industry-logo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function AssessmentClientWrapper({ dentistId }: { dentistId?: string }) {
  async function handleSubmit(formData: any) {
    'use server'
    const result = await submitSmileAssessment({ ...formData, dentistId })
    if (result.success) {
      redirect('/smile/assessment/success')
    } else {
      throw new Error(result.error || 'Submission failed')
    }
  }
  return <SmileAssessmentForm onSubmit={handleSubmit} dentistId={dentistId} />
}

export default async function SmileAssessmentPage({
  searchParams,
}: {
  searchParams: { dentistId?: string; company?: string; ref?: string }
}) {
  const dentistId = searchParams.dentistId
  const companyName = searchParams.company
  const referralSource = searchParams.ref
  const POOL_ACCOUNT_ID = '00000000-0000-4000-a000-000000000004'
  const finalDentistId = dentistId || POOL_ACCOUNT_ID

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-25">
      {/* Header */}
      <div className="border-b border-purple-200 bg-white bg-opacity-80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/smile">
              <IndustryLogo industry="smile" height={48} priority className="cursor-pointer" />
            </Link>
            <Link href="/smile">
              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 cursor-pointer">
                <ArrowLeft className="mr-2 h-3 w-3" />
                Back to Dashboard
              </Badge>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Centered logo above form */}
        <div className="mb-8 text-center flex flex-col items-center gap-4">
          <IndustryLogo industry="smile" height={84} priority className="mx-auto" />
          <p className="text-gray-500">
            Complete this comprehensive assessment to begin your smile transformation journey
          </p>
        </div>

        <AssessmentClientWrapper dentistId={finalDentistId} />

        {/* HIPAA Notice */}
        <div className="mt-8 rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-purple-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-purple-900">HIPAA Protected</h3>
              <p className="mt-1 text-xs text-gray-600">
                All patient information is encrypted and protected by HIPAA-compliant security measures.
                Only authorized users can access this data.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ChatWidget
        source="smile"
        primaryColor="#9333ea"
        position="bottom-right"
        {...(companyName ? { companyName: decodeURIComponent(companyName) } : {})}
        {...(referralSource ? { referralSource: decodeURIComponent(referralSource) } : {})}
      />
    </div>
  )
}