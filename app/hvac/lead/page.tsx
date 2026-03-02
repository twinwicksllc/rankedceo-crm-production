import { redirect } from 'next/navigation'
import Link from 'next/link'
import { HvacLeadForm } from '@/components/hvac/hvac-lead-form'
import { submitIndustryLead } from '@/lib/actions/industry-lead'
import type { HvacLeadInput } from '@/lib/validations/industry-lead'
import { ChatWidget } from '@/components/agent/chat-widget'
import { IndustryLogo } from '@/components/ui/industry-logo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function HvacLeadFormWrapper({ operatorId }: { operatorId?: string }) {
  async function handleSubmit(formData: HvacLeadInput) {
    'use server'
    const result = await submitIndustryLead({ ...formData, operator_id: operatorId ?? null })
    if (result.success) {
      redirect('/lead/success')
    } else {
      throw new Error(result.error || 'Submission failed')
    }
  }

  return <HvacLeadForm onSubmit={handleSubmit} operatorId={operatorId} />
}

export default async function HvacLeadPage({
  searchParams,
}: {
  searchParams: { operatorId?: string; company?: string; ref?: string }
}) {
  const operatorId = searchParams.operatorId
  const companyName = searchParams.company
  const referralSource = searchParams.ref

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-25">
      {/* Header */}
      <div className="border-b border-blue-200 bg-white bg-opacity-80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <IndustryLogo industry="hvac" height={48} priority />
            <Link href="/login">
              <span className="text-sm text-blue-600 hover:underline">Operator Login →</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Centered logo above form */}
        <div className="mb-8 text-center flex flex-col items-center gap-4">
          <IndustryLogo industry="hvac" height={126} priority className="mx-auto" />
          <p className="text-gray-500">
            Fill out this quick form and a certified HVAC technician will contact you shortly.
          </p>
        </div>

        <HvacLeadFormWrapper operatorId={operatorId} />

        {/* Trust signals */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          {[
            { icon: '⚡', label: 'Fast Response', sub: 'Same-day available' },
            { icon: '🔧', label: 'Certified Techs', sub: 'Licensed & insured' },
            { icon: '💰', label: 'Free Estimates', sub: 'No obligation' },
          ].map(item => (
            <div key={item.label} className="rounded-lg border border-blue-100 bg-white p-3">
              <div className="text-2xl mb-1">{item.icon}</div>
              <p className="text-xs font-semibold text-gray-700">{item.label}</p>
              <p className="text-xs text-gray-400">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <ChatWidget
        source="hvac"
        primaryColor="#2563eb"
        position="bottom-right"
        {...(companyName ? { companyName: decodeURIComponent(companyName) } : {})}
        {...(referralSource ? { referralSource: decodeURIComponent(referralSource) } : {})}
      />
    </div>
  )
}