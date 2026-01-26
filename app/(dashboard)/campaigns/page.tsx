import { Suspense } from 'react';
import { CampaignService } from '@/lib/services/campaign-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Mail, Users, Send, TrendingUp, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage your email campaigns and track performance
          </p>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      <Suspense fallback={<div>Loading statistics...</div>}>
        <CampaignsStats />
      </Suspense>

      <Suspense fallback={<div>Loading campaigns...</div>}>
        <CampaignsList />
      </Suspense>
    </div>
  );
}

async function CampaignsStats() {
  const campaignService = new CampaignService();
  const stats = await campaignService.getCampaignStats();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Campaigns"
        value={stats.totalCampaigns}
        icon={<Mail className="h-4 w-4" />}
      />
      <StatCard
        title="Active Campaigns"
        value={stats.activeCampaigns}
        icon={<Send className="h-4 w-4" />}
        trend="+2 this week"
      />
      <StatCard
        title="Emails Sent"
        value={stats.totalEmailsSent}
        icon={<Users className="h-4 w-4" />}
      />
      <StatCard
        title="Avg Open Rate"
        value={`${stats.averageOpenRate.toFixed(1)}%`}
        icon={<TrendingUp className="h-4 w-4" />}
        trend="+5.2% from last month"
      />
    </div>
  );
}

function StatCard({ title, value, icon, trend }: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground mt-1">{trend}</p>
        )}
      </CardContent>
    </Card>
  );
}

async function CampaignsList() {
  const campaignService = new CampaignService();
  const campaigns = await campaignService.getCampaigns();

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Mail className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Create your first email campaign to start reaching your audience
          </p>
          <Button asChild>
            <Link href="/campaigns/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Campaign
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Campaigns</CardTitle>
        <CardDescription>
          View and manage your email campaigns
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignCard({ campaign }: { campaign: any }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'scheduled':
        return 'bg-blue-500';
      case 'draft':
        return 'bg-gray-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'one-time':
        return 'One-time';
      case 'drip':
        return 'Drip Campaign';
      case 'automation':
        return 'Automation';
      case 'ab_test':
        return 'A/B Test';
      default:
        return type;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold">{campaign.name}</h3>
          <Badge variant="outline">{getTypeLabel(campaign.type)}</Badge>
          <Badge className={getStatusColor(campaign.status)}>
            {campaign.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          {campaign.description || 'No description'}
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {campaign.recipient_count || 0} recipients
          </span>
          {campaign.analytics && (
            <>
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {campaign.analytics.total_sent} sent
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {campaign.analytics.open_rate?.toFixed(1)}% open rate
              </span>
            </>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(campaign.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/campaigns/${campaign.id}`}>View</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/campaigns/${campaign.id}/edit`}>Edit</Link>
        </Button>
      </div>
    </div>
  );
}
