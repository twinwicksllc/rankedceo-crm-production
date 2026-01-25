import { notFound } from 'next/navigation';
import { dealService } from '@/lib/services/deal-service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActivityTimeline } from '@/components/activities/activity-timeline';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getDealActivities(dealId: string) {
  const response = await fetch(`/api/activities?deal_id=${dealId}`, {
    cache: 'no-store',
  });
  
  if (!response.ok) {
    return [];
  }
  
  return response.json();
}

export default async function DealDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [deal, activities] = await Promise.all([
    dealService.getDealById(params.id),
    getDealActivities(params.id),
  ]);

  if (!deal) {
    notFound();
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Lead':
        return 'bg-gray-100 text-gray-800';
      case 'Qualified':
        return 'bg-blue-100 text-blue-800';
      case 'Proposal':
        return 'bg-purple-100 text-purple-800';
      case 'Negotiation':
        return 'bg-orange-100 text-orange-800';
      case 'Won':
        return 'bg-green-100 text-green-800';
      case 'Lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/deals" className="text-blue-600 hover:underline text-sm">
            ← Back to Deals
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{deal.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge className={getStageColor(deal.stage)}>
              {deal.stage}
            </Badge>
            <span className="text-gray-600">
              Created on {formatDate(deal.created_at)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/deals/${deal.id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          <Link href={`/activities/new?deal_id=${deal.id}`}>
            <Button>+ Log Activity</Button>
          </Link>
        </div>
      </div>

      {/* Deal Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Deal Information */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Deal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Value</div>
                <div className="font-medium text-2xl">{formatCurrency(deal.value)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Win Probability</div>
                <div className="font-medium">{deal.win_probability}%</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Pipeline</div>
                <div className="font-medium">
                  {deal.pipeline_id ? (
                    <Link href={`/pipelines/${deal.pipeline_id}`} className="text-blue-600 hover:underline">
                      View Pipeline
                    </Link>
                  ) : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Expected Close Date</div>
                <div className="font-medium">
                  {deal.expected_close_date ? formatDate(deal.expected_close_date) : 'N/A'}
                </div>
              </div>
            </div>
          </Card>

          {/* Description */}
          {deal.description && (
            <Card className="p-6">
              <h3 className="font-semibold mb-3">Description</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{deal.description}</p>
            </Card>
          )}

          {/* Activity Timeline */}
          <ActivityTimeline
            title="Activity History"
            activities={activities}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="p-6">
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link href={`/activities/new?deal_id=${deal.id}&type=call`}>
                <Button variant="outline" className="w-full justify-start">
                  📞 Log Call
                </Button>
              </Link>
              <Link href={`/activities/new?deal_id=${deal.id}&type=meeting`}>
                <Button variant="outline" className="w-full justify-start">
                  📅 Schedule Meeting
                </Button>
              </Link>
              <Link href={`/activities/new?deal_id=${deal.id}&type=email`}>
                <Button variant="outline" className="w-full justify-start">
                  📧 Send Email
                </Button>
              </Link>
              <Link href={`/activities/new?deal_id=${deal.id}&type=task`}>
                <Button variant="outline" className="w-full justify-start">
                  ✅ Add Task
                </Button>
              </Link>
            </div>
          </Card>

          {/* Metadata */}
          <Card className="p-6">
            <h3 className="font-semibold mb-3">Details</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600">Created</div>
                <div className="text-sm">{formatDate(deal.created_at)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Last Updated</div>
                <div className="text-sm">{formatDate(deal.updated_at)}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}