import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SmileAssessmentForm } from '@/components/smile/assessment-form'
import { submitSmileAssessment } from '@/lib/actions/smile-assessment'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function AssessmentClientWrapper() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Server action wrapper for client component
  async function handleSubmit(formData: any) {
    'use server'
    const result = await submitSmileAssessment(formData)
    
    if (result.success) {
      redirect('/smile?success=assessment_submitted')
    } else {
      // In production, you'd handle this more gracefully
      throw new Error(result.error || 'Submission failed')
    }
  }

  return <SmileAssessmentForm onSubmit={handleSubmit} />
}

export default async function SmileAssessmentPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-25">
      {/* Header */}
      <div className="border-b border-purple-200 bg-white bg-opacity-80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/smile">
                <Image
                  src="/smile_logo.png"
                  alt="Smile MakeOver"
                  width={120}
                  height={48}
                  className="h-12 w-auto cursor-pointer"
                  priority
                />
              </Link>
              <div>
                <p className="text-sm text-purple-600 font-medium">Patient Assessment</p>
              </div>
            </div>
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
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">New Patient Assessment</h1>
          <p className="text-gray-500">
            Complete this comprehensive assessment to begin your patient's smile transformation journey
          </p>
        </div>

        <AssessmentClientWrapper />

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
    </div>
  )
}
