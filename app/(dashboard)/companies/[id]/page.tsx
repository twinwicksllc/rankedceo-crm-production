import { notFound } from 'next/navigation';
import { companyService } from '@/lib/services/company-service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActivityTimeline } from '@/components/activities/activity-timeline';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getCompanyActivities(companyId: string) {
  const response = await fetch(`/api/activities?company_id=${companyId}`, {
    cache: 'no-store',
  });
  
  if (!response.ok) {
    return [];
  }
  
  return response.json();
}

export default async function CompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [company, activities] = await Promise.all([
    companyService.getCompanyById(params.id),
    getCompanyActivities(params.id),
  ]);

  if (!company) {
    notFound();
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/companies" className="text-blue-600 hover:underline text-sm">
            ← Back to Companies
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{company.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge className={
              company.status === 'active' ? 'bg-green-100 text-green-800' : 
              company.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 
              'bg-blue-100 text-blue-800'
            }>
              {company.status}
            </Badge>
            <span className="text-gray-600">
              Added on {formatDate(company.created_at)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/companies/${company.id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          <Link href={`/activities/new?company_id=${company.id}`}>
            <Button>+ Log Activity</Button>
          </Link>
        </div>
      </div>

      {/* Company Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Information */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Company Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Industry</div>
                <div className="font-medium">{company.industry || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Website</div>
                <div className="font-medium">
                  {company.website ? (
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {company.website}
                    </a>
                  ) : 'N/A'}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-sm text-gray-600">Address</div>
                <div className="font-medium">
                  {[company.address, company.city, company.state, company.zip_code, company.country]
                    .filter(Boolean)
                    .join(', ') || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Phone</div>
                <div className="font-medium">{company.phone || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Employee Count</div>
                <div className="font-medium">{company.employee_count || 'N/A'}</div>
              </div>
            </div>
          </Card>

          {/* Description */}
          {company.description && (
            <Card className="p-6">
              <h3 className="font-semibold mb-3">Description</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{company.description}</p>
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
              <Link href={`/activities/new?company_id=${company.id}&type=call`}>
                <Button variant="outline" className="w-full justify-start">
                  📞 Log Call
                </Button>
              </Link>
              <Link href={`/activities/new?company_id=${company.id}&type=meeting`}>
                <Button variant="outline" className="w-full justify-start">
                  📅 Schedule Meeting
                </Button>
              </Link>
              <Link href={`/activities/new?company_id=${company.id}&type=email`}>
                <Button variant="outline" className="w-full justify-start">
                  📧 Send Email
                </Button>
              </Link>
              <Link href={`/activities/new?company_id=${company.id}&type=task`}>
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
                <div className="text-sm">{formatDate(company.created_at)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Last Updated</div>
                <div className="text-sm">{formatDate(company.updated_at)}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}