import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PlumbingLeadForm } from '@/components/plumbing/plumbing-lead-form'
import { submitIndustryLead } from '@/lib/actions/industry-lead'
import type { PlumbingLeadInput } from '@/lib/validations/industry-lead'
import { ChatWidget } from '@/components/agent/chat-widget'
import { IndustryLogo } from '@/components/ui/industry-logo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function PlumbingLeadFormWrapper({ operatorId }: { operatorId?: string }) {
  async function handleSubmit(formData: PlumbingLeadInput) {
    'use server'
    const result = await submitIndustryLead({ ...formData, operator_id: operatorId ?? null })
    if (result.success) {
      redirect('/lead/success')
    } else {
      throw new Error(result.error || 'Submission failed')
    }
  }
  return <PlumbingLeadForm onSubmit={handleSubmit} operatorId={operatorId} />
}

export default async function PlumbingLeadPage({
  searchParams,
}: {
  searchParams: { operatorId?: string }
}) {
  const operatorId = searchParams.operatorId

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-25">
      {/* Header */}
      <div className="border-b border-teal-200 bg-white bg-opacity-80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <IndustryLogo industry="plumbing" height={48} priority />
            <Link href="/login">
              <span className="text-sm text-teal-600 hover:underline">Operator Login →</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Centered logo above form */}
        <div className="mb-8 text-center flex flex-col items-center gap-4">
          <IndustryLogo industry="plumbing" height={56} priority className="mx-auto" />
          <p className="text-gray-500">
            Fill out this quick form and a licensed plumber will contact you shortly.
          </p>
        </div>

        <PlumbingLeadFormWrapper operatorId={operatorId} />

        {/* Trust signals */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          {[
            { icon: '⚡', label: 'Fast Response',    sub: 'Emergency same-day' },
            { icon: '🔧', label: 'Licensed Plumbers', sub: 'Fully insured' },
            { icon: '💰', label: 'Free Estimates',    sub: 'No obligation' },
          ].map(item => (
            <div key={item.label} className="rounded-lg border border-teal-100 bg-white p-3">
              <div className="text-2xl mb-1">{item.icon}</div>
              <p className="text-xs font-semibold text-gray-700">{item.label}</p>
              <p className="text-xs text-gray-400">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <ChatWidget
        source="plumbing"
        primaryColor="#0d9488"
        position="bottom-right"
      />
    </div>
  )
}