import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import { CampaignService } from '@/lib/services/campaign-service'
import { CampaignForm } from '@/components/forms/campaign-form'

export default async function EditCampaignPage({ params }: { params: { id: string } }) {
  const campaignService = new CampaignService()
  const campaign = await campaignService.getCampaign(params.id)
  
  if (!campaign) {
    notFound()
  }

  // For now, redirect to the campaign detail page
  // The CampaignForm component doesn't accept props for editing
  // We'll need to enhance the form component to support editing in a future update
  redirect(`/campaigns/${params.id}`)
}
