import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CampaignService } from '@/lib/services/campaign-service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Edit, Play, Pause } from 'lucide-react'

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const campaignService = new CampaignService()

  const campaign = await campaignService.getCampaign(params.id)
  
  if (!campaign) {
    notFound()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'one-time': return 'bg-purple-100 text-purple-800'
      case 'drip': return 'bg-indigo-100 text-indigo-800'
      case 'automation': return 'bg-cyan-100 text-cyan-800'
      case 'ab_test': return 'bg-pink-100 text-pink-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <p className="text-sm text-gray-500">Created {new Date(campaign.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {campaign.status === 'active' && (
            <Button variant="outline">
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
          {campaign.status === 'draft' && (
            <Button>
              <Play className="h-4 w-4 mr-2" />
              Launch Campaign
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <Badge className={getStatusColor(campaign.status)}>
          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
        </Badge>
        <Badge className={getTypeColor(campaign.type)}>
          {campaign.type === 'ab_test' ? 'A/B Test' : campaign.type.charAt(0).toUpperCase() + campaign.type.slice(1)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Description</p>
              <p className="text-sm">{campaign.description || 'No description provided'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Subject Line</p>
              <p className="text-sm">{campaign.subject}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">From Email</p>
              <p className="text-sm">{campaign.from_email}</p>
            </div>
            {campaign.from_name && (
              <div>
                <p className="text-sm font-medium text-gray-500">From Name</p>
                <p className="text-sm">{campaign.from_name}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Targeting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Target Type</p>
              <p className="text-sm">Contacts, Companies, Deals</p>
            </div>
            {campaign.target_contacts && campaign.target_contacts.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-500">Target Contacts</p>
                <p className="text-sm">{campaign.target_contacts.length} selected</p>
              </div>
            )}
            {campaign.target_companies && campaign.target_companies.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-500">Target Companies</p>
                <p className="text-sm">{campaign.target_companies.length} selected</p>
              </div>
            )}
            {campaign.target_deals && campaign.target_deals.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-500">Target Deals</p>
                <p className="text-sm">{campaign.target_deals.length} selected</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {campaign.scheduled_at && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-500">Scheduled For</span>
              <span className="text-sm">{new Date(campaign.scheduled_at).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
