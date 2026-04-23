import { notFound } from 'next/navigation'
import { getClientReviewSession } from '@/lib/waas/actions/admin'
import { ReviewClient } from './review-client'

export default async function ReviewPage({ params }: { params: { tenantId: string } }) {
  const sessionResult = await getClientReviewSession(params.tenantId)
  if (!sessionResult.success || !sessionResult.data) notFound()

  const session = sessionResult.data

  return (
    <ReviewClient
      tenantId={session.tenantId}
      slug={session.slug}
      businessName={session.businessName}
      reviewToken={session.reviewToken}
      initialSelectedTemplate={session.selectedTemplateSlug}
      initialFeedback={session.feedback}
      initialMix={session.mix}
      versions={session.versions}
    />
  )
}
