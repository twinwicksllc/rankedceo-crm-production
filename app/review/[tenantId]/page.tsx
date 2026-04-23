import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ReviewClient } from './review-client'

interface TenantReviewData {
  id: string
  slug: string
  businessName: string
}

async function getTenantReviewData(tenantId: string): Promise<TenantReviewData | null> {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  const client = createClient(url, key)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('tenants')
    .select('id, slug, brand_config')
    .eq('id', tenantId)
    .single()

  if (error || !data) return null

  const brandConfig = (data as { brand_config?: Record<string, unknown> }).brand_config ?? {}
  const businessName = typeof brandConfig.business_name === 'string'
    ? brandConfig.business_name
    : 'Your Business'

  return {
    id: (data as { id: string }).id,
    slug: (data as { slug: string }).slug,
    businessName,
  }
}

export default async function ReviewPage({ params }: { params: { tenantId: string } }) {
  const tenant = await getTenantReviewData(params.tenantId)
  if (!tenant) notFound()

  return (
    <ReviewClient
      tenantId={tenant.id}
      slug={tenant.slug}
      businessName={tenant.businessName}
    />
  )
}
